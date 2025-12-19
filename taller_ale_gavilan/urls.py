# taller_ale_gavilan/urls.py
from django.urls import path, include
from django.contrib.auth import views as auth_views

urlpatterns = [
    # Admin oculto (no expuesto)
    # path("admin/", admin.site.urls),

    # Auth
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

    # App
    path("", include(("taller.urls", "taller"), namespace="taller")),
]
