from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import CustomTokenObtainPairSerializer


def _set_jwt_cookies(response: Response, refresh: RefreshToken) -> None:
    refresh_str = str(refresh)
    access_str = str(refresh.access_token)
    secure = getattr(settings, "JWT_COOKIE_SECURE", False)
    samesite = getattr(settings, "JWT_COOKIE_SAMESITE", "Lax")
    access_cookie = getattr(settings, "JWT_ACCESS_COOKIE", "access_token")
    refresh_cookie = getattr(settings, "JWT_REFRESH_COOKIE", "refresh_token")
    access_ttl = int(
        getattr(settings, "SIMPLE_JWT", {})
        .get("ACCESS_TOKEN_LIFETIME", timezone.timedelta(minutes=15))
        .total_seconds()
    )
    refresh_ttl = int(
        getattr(settings, "SIMPLE_JWT", {})
        .get("REFRESH_TOKEN_LIFETIME", timezone.timedelta(days=7))
        .total_seconds()
    )
    response.set_cookie(
        access_cookie,
        access_str,
        max_age=access_ttl,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )
    response.set_cookie(
        refresh_cookie,
        refresh_str,
        max_age=refresh_ttl,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


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
        try:
            refresh = RefreshToken(token_str)
            response = Response({"detail": "Token renovado."})
            _set_jwt_cookies(response, refresh)
            return response
        except TokenError:
            resp = Response(
                {"detail": "Refresh token inválido ou expirado."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_jwt_cookies(resp)
            return resp


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
