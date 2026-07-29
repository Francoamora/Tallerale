# taller_ale_gavilan/urls.py
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path, include, re_path
from django.views.static import serve

# Importación de la instancia de la API (creada en el paso anterior)
from taller.api import api


def public_taller_logo(request, path):
    """Sirve exclusivamente el branding público desde el volumen persistente."""
    return serve(
        request,
        path,
        document_root=settings.MEDIA_ROOT / "taller" / "logos",
    )


urlpatterns = [
    # /healthz/ lo resuelve HealthcheckMiddleware, antes de llegar acá.

    # =========================
    # 1. API ROUTES (Punto de entrada para el futuro frontend en Next.js)
    # =========================
    path("api/", api.urls),

    # =========================
    # 3. AUTENTICACIÓN TRADICIONAL
    # =========================
    # Mantenemos este bloque activo hasta que la autenticación (vía JWT o Tokens)
    # sea completamente delegada al nuevo frontend.
    path(
        "login/",
        auth_views.LoginView.as_view(
            template_name="taller/auth/login.html",
            redirect_authenticated_user=True
        ),
        name="login",
    ),
    path(
        "logout/",
        auth_views.LogoutView.as_view(next_page="login"),
        name="logout"
    ),

    # =========================
    # 4. APP CLÁSICA (Vistas monolíticas actuales)
    # =========================
    path("", include(("taller.urls", "taller"), namespace="taller")),
]

# Solo soporte debe conocer y usar este panel. En producción no existe ninguna
# ruta de administración si DJANGO_ADMIN_URL no fue configurada.
if settings.ADMIN_URL:
    urlpatterns.append(path(f"{settings.ADMIN_URL}/", admin.site.urls))

# Los logos son branding público y deben seguir disponibles con DEBUG=False.
# La ruta está deliberadamente limitada a logos: fotos de trabajos y otros
# adjuntos nunca quedan publicados por este mecanismo.
urlpatterns += [
    re_path(
        r"^media/taller/logos/(?P<path>.*)$",
        public_taller_logo,
    ),
]

# =========================
# 5. SERVIDOR DE ARCHIVOS ESTÁTICOS Y MULTIMEDIA (Solo en Desarrollo)
# =========================
# Esta configuración garantiza que las imágenes subidas por los usuarios y los estilos
# carguen correctamente en el entorno local (DEBUG = True) sin necesidad de configurar un servidor web como Nginx.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
