# taller_ale_gavilan/urls.py
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path, include

# Importación de la instancia de la API (creada en el paso anterior)
from taller.api import api 

urlpatterns = [
    # =========================
    # 1. API ROUTES (Punto de entrada para el futuro frontend en Next.js)
    # =========================
    path("api/", api.urls),

    # =========================
    # 2. PANEL DE ADMINISTRACIÓN
    # =========================
    # Recomendación de seguridad: En producción, cambiar "admin/" por una ruta ofuscada 
    # (por ejemplo, "panel-taller-admin/") para evitar ataques de fuerza bruta automatizados.
    path("admin/", admin.site.urls),

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

# =========================
# 5. SERVIDOR DE ARCHIVOS ESTÁTICOS Y MULTIMEDIA (Solo en Desarrollo)
# =========================
# Esta configuración garantiza que las imágenes subidas por los usuarios y los estilos
# carguen correctamente en el entorno local (DEBUG = True) sin necesidad de configurar un servidor web como Nginx.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)