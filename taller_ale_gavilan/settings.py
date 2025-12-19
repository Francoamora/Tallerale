# settings.py (READY TO REPLACE)
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# =========================
# ENV HELPERS
# =========================
def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)

def env_bool(name: str, default: bool = False) -> bool:
    val = env(name, "")
    if val == "":
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")

def env_list(name: str, default: str = "") -> list[str]:
    raw = env(name, default).strip()
    if not raw:
        return []
    # separado por coma
    return [x.strip() for x in raw.split(",") if x.strip()]

# =========================
# CORE
# =========================
# ⚠️ IMPORTANTE:
# - En local podés dejar DJANGO_SECRET_KEY vacío y usar fallback.
# - En prod (PythonAnywhere) SI O SI setear DJANGO_SECRET_KEY.
SECRET_KEY = env("DJANGO_SECRET_KEY", "django-insecure-LOCAL-DEV-ONLY-change-me")

DEBUG = env_bool("DJANGO_DEBUG", True)

# Hosts: en local funciona con 127.0.0.1/localhost
# En prod: setear DJANGO_ALLOWED_HOSTS="tuuser.pythonanywhere.com"
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")

INSTALLED_APPS = [
    "django.contrib.admin",   # lo dejamos instalado (admin)
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "taller",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "taller_ale_gavilan.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],  # ok
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

WSGI_APPLICATION = "taller_ale_gavilan.wsgi.application"

# =========================
# DATABASE
# =========================
# Por ahora SQLite (OK para arrancar).
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-ar"
TIME_ZONE = "America/Argentina/Buenos_Aires"
USE_I18N = True
USE_TZ = True

# =========================
# STATIC / MEDIA
# =========================
STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]  # tus assets
STATIC_ROOT = BASE_DIR / "staticfiles"    # collectstatic acá

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# =========================
# AUTH / LOGIN OBLIGATORIO
# =========================
LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "taller:dashboard"
LOGOUT_REDIRECT_URL = "login"

# =========================
# SECURITY (PROD)
# =========================
# Para PythonAnywhere / HTTPS:
# Seteá DJANGO_CSRF_TRUSTED_ORIGINS="https://tuuser.pythonanywhere.com"
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", "")

if not DEBUG:
    # Si estás detrás de proxy (PythonAnywhere), esto evita problemas con HTTPS
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

    # Cookies seguras en prod
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    # Clickjacking / sniffing
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

    # HSTS (podés subir de a poco; arrancamos suave)
    SECURE_HSTS_SECONDS = int(env("DJANGO_HSTS_SECONDS", "3600"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = False

    # Extra
    REFERRER_POLICY = "same-origin"
