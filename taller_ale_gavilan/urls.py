# taller_ale_gavilan/urls.py
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, re_path
from django.views.generic import RedirectView
from django.views.static import serve

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
    # 1. API ROUTES (única superficie de la aplicación)
    # =========================
    # La app monolítica de Django (login por sesión, vistas y templates) se dio
    # de baja: duplicaba la funcionalidad del frontend Next.js, no aplicaba el
    # corte por trial vencido y su formulario de login no tenía límite de
    # intentos, así que servía para saltear el de /api/auth/login/.
    path("api/", api.urls),
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

# Quien tenga guardado el enlace viejo del backend (o entre por la URL de
# Railway) termina en la aplicación real en vez de ver un 404 sin explicación.
if settings.FRONTEND_URL:
    urlpatterns.append(
        path("", RedirectView.as_view(url=settings.FRONTEND_URL, permanent=False)),
    )

# =========================
# SERVIDOR DE ARCHIVOS ESTÁTICOS Y MULTIMEDIA (Solo en Desarrollo)
# =========================
# Esta configuración garantiza que las imágenes subidas por los usuarios y los estilos
# carguen correctamente en el entorno local (DEBUG = True) sin necesidad de configurar un servidor web como Nginx.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
