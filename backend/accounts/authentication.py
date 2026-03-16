from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """
    Autenticação JWT que lê o access token do cookie HttpOnly
    quando o cabeçalho Authorization não está presente.
    """

    def authenticate(self, request):
        # Primeiro tenta o cabeçalho padrão (Authorization: Bearer <token>)
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        # Se não houver header, tenta ler do cookie configurado
        cookie_name = getattr(settings, "JWT_ACCESS_COOKIE", "access_token")
        raw_token = request.COOKIES.get(cookie_name)
        if not raw_token:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token

