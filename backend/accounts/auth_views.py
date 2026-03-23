from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import CustomTokenObtainPairSerializer


def _set_jwt_cookie_strings(response: Response, access_str: str, refresh_str: str) -> None:
    """Define cookies JWT como session cookies (sem max_age/expires).
    O browser elimina-os automaticamente ao encerrar — sem sessão persistente."""
    secure = getattr(settings, "JWT_COOKIE_SECURE", False)
    samesite = getattr(settings, "JWT_COOKIE_SAMESITE", "Lax")
    access_cookie = getattr(settings, "JWT_ACCESS_COOKIE", "access_token")
    refresh_cookie = getattr(settings, "JWT_REFRESH_COOKIE", "refresh_token")
    # Sem max_age → session cookie: desaparece ao fechar o browser.
    # Os tokens JWT têm o seu próprio prazo de validade interno (access=15min,
    # refresh=7dias), mas o cookie não persiste entre sessões do browser.
    response.set_cookie(
        access_cookie,
        access_str,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )
    response.set_cookie(
        refresh_cookie,
        refresh_str,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


def _set_jwt_cookies(response: Response, refresh: RefreshToken) -> None:
    _set_jwt_cookie_strings(response, str(refresh.access_token), str(refresh))


def _clear_jwt_cookies(response: Response) -> None:
    access_cookie = getattr(settings, "JWT_ACCESS_COOKIE", "access_token")
    refresh_cookie = getattr(settings, "JWT_REFRESH_COOKIE", "refresh_token")
    response.delete_cookie(access_cookie)
    response.delete_cookie(refresh_cookie)


class CookieTokenObtainPairView(TokenObtainPairView):
    """Login: aceita identifier (username ou email) + password. Define JWT em cookies."""

    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]

    def post(self, request: Request, *args, **kwargs) -> Response:
        resp = super().post(request, *args, **kwargs)
        if resp.status_code == status.HTTP_200_OK:
            refresh = RefreshToken(resp.data["refresh"])
            _set_jwt_cookies(resp, refresh)
            resp.data.pop("refresh", None)
            resp.data.pop("access", None)
            resp.data["detail"] = "Autenticação realizada com sucesso."
        return resp


class CookieTokenRefreshView(APIView):
    """Refresh do access token a partir do refresh em cookie."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        refresh_cookie = getattr(settings, "JWT_REFRESH_COOKIE", "refresh_token")
        token_str = request.COOKIES.get(refresh_cookie)
        if not token_str:
            return Response(
                {"detail": "Refresh token não encontrado."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        serializer = TokenRefreshSerializer(data={"refresh": token_str})
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError:
            resp = Response(
                {"detail": "Refresh token inválido ou expirado."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_jwt_cookies(resp)
            return resp
        data = serializer.validated_data
        access_str = data["access"]
        # Sem rotação, o serializer só devolve access; mantém o mesmo refresh no cookie.
        refresh_str = data.get("refresh", token_str)
        response = Response({"detail": "Token renovado."})
        _set_jwt_cookie_strings(response, access_str, refresh_str)
        return response


class CookieLogoutView(APIView):
    """Logout: coloca refresh em blacklist e remove cookies."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        refresh_cookie = getattr(settings, "JWT_REFRESH_COOKIE", "refresh_token")
        token_str = request.COOKIES.get(refresh_cookie)
        if token_str:
            try:
                token = RefreshToken(token_str)
                token.blacklist()
            except TokenError:
                pass
        response = Response({"detail": "Logout realizado."})
        _clear_jwt_cookies(response)
        return response
