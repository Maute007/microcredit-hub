import os
from datetime import timedelta
from pathlib import Path

from django.core.management.utils import get_random_secret_key

# Carrega variáveis do ficheiro .env (se existir) antes de qualquer os.getenv()
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass  # python-dotenv não instalado — usa variáveis de ambiente do sistema


BASE_DIR = Path(__file__).resolve().parent.parent


def _csv_env(name: str, default: str = "") -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


# SECURITY ---------------------------------------------------------------------

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", get_random_secret_key())

DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() == "true"

# Inclui o domínio do frontend por defeito porque o Nginx do frontend
# passa Host: euro-credito.makira7.com ao fazer proxy de /api/ para este socket
ALLOWED_HOSTS: list[str] = _csv_env(
    "DJANGO_ALLOWED_HOSTS",
    "euro-server.makira7.com,euro-credito.makira7.com,localhost,127.0.0.1",
)

# Frontend origin (Vite default + optional env override)
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://euro-credito.makira7.com").rstrip("/")
BACKEND_URL = os.getenv("BACKEND_URL", "https://euro-server.makira7.com").rstrip("/")
CORS_ALLOWED_ORIGINS_EXTRA = _csv_env("CORS_ALLOWED_ORIGINS_EXTRA", "")


# APPLICATION DEFINITION ------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "drf_spectacular",
    "rest_framework_simplejwt.token_blacklist",
    "channels",
    "corsheaders",
    "simple_history",
    # Project apps
    "accounts",
    "clients",
    "loans",
    "hr",
    "accounting",
    "calendario",
    "reports",
    "dashboard",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "simple_history.middleware.HistoryRequestMiddleware",
]

ROOT_URLCONF = "Server_microcredit.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "Server_microcredit.wsgi.application"
ASGI_APPLICATION = "Server_microcredit.asgi.application"


# DATABASE --------------------------------------------------------------------
# Por defeito: SQLite. Para produção com PostgreSQL, defina DATABASE_URL.
# Ex: DATABASE_URL=postgres://user:pass@localhost:5432/dbname
# Requer: pip install dj-database-url psycopg2-binary

if os.getenv("DATABASE_URL"):
    import dj_database_url

    DATABASES = {
        "default": dj_database_url.config(
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
elif os.getenv("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", ""),
            "USER": os.getenv("POSTGRES_USER", ""),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
            "HOST": os.getenv("POSTGRES_HOST", "localhost"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
            "OPTIONS": {
                "sslmode": os.getenv("POSTGRES_SSLMODE", "prefer"),
            },
            "CONN_MAX_AGE": 600,
            "CONN_HEALTH_CHECKS": True,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


# PASSWORD VALIDATION ---------------------------------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# INTERNATIONALIZATION --------------------------------------------------------

LANGUAGE_CODE = "pt-br"

TIME_ZONE = "America/Sao_Paulo"

USE_I18N = True

USE_TZ = True


# STATIC & MEDIA --------------------------------------------------------------

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


# CACHES ----------------------------------------------------------------------
# LocMem por defeito. Para produção com múltiplos workers, use Redis:
# CACHES["default"]["BACKEND"] = "django.core.cache.backends.redis.RedisCache"
# CACHES["default"]["LOCATION"] = "redis://127.0.0.1:6379/1"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "microcredit-locmem-cache",
        "TIMEOUT": 60 * 5,  # 5 minutos
    }
}


# CHANNELS --------------------------------------------------------------------
# InMemoryChannelLayer: 1 processo. Para produção (WebSockets), use Redis:
# pip install channels-redis
# CHANNEL_LAYERS["default"]["BACKEND"] = "channels_redis.core.RedisChannelLayer"
# CHANNEL_LAYERS["default"]["CONFIG"] = {"hosts": [("127.0.0.1", 6379)]}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}


# REST FRAMEWORK & JWT --------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "MicroCrédito Hub API",
    "DESCRIPTION": "API para gestão de microcrédito: clientes, empréstimos, pagamentos, RH e contabilidade.",
    "VERSION": "1.0.0",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
}

# Modelo de usuário customizado (app accounts)
AUTH_USER_MODEL = "accounts.User"

# Login por username ou email
AUTHENTICATION_BACKENDS = [
    "accounts.backends.UsernameOrEmailBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# Cookies para JWT (tokens em cookies HttpOnly + SameSite)
JWT_ACCESS_COOKIE = "access_token"
JWT_REFRESH_COOKIE = "refresh_token"
JWT_COOKIE_SECURE = not DEBUG  # Em produção, exige HTTPS
JWT_COOKIE_SAMESITE = "Lax"


# CORS & CSRF (comunicação segura com frontend) -------------------------------

if DEBUG:
    CORS_ALLOWED_ORIGINS = list(
        dict.fromkeys(
            [
                FRONTEND_URL,
                "http://localhost:5173",
                "http://localhost:8080",
                "http://127.0.0.1:8080",
                *CORS_ALLOWED_ORIGINS_EXTRA,
            ]
        )
    )
else:
    CORS_ALLOWED_ORIGINS = list(dict.fromkeys([FRONTEND_URL, *CORS_ALLOWED_ORIGINS_EXTRA]))

CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

CORS_ALLOW_CREDENTIALS = True

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False  # Django usa cookie CSRF legível pelo JS (header)

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

if not DEBUG:
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 7  # 7 dias
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True


# DEFAULTS --------------------------------------------------------------------

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

