import os

from django.apps import AppConfig
from django.conf import settings
from django.core.checks import Warning as CheckWarning, register


class TallerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'taller'
    verbose_name = 'Tallerista'


@register()
def check_rate_limit_cache(app_configs, **kwargs):
    """Avisa si se escala a varios workers sin un cache compartido.

    El límite de intentos de login se guarda en el cache. Con LocMemCache cada
    worker lleva su propio contador, así que N workers permiten N veces más
    intentos sin que nada falle de forma visible.
    """
    if settings.REDIS_URL:
        return []

    try:
        workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
    except ValueError:
        return []

    if workers <= 1:
        return []

    return [
        CheckWarning(
            f"WEB_CONCURRENCY={workers} sin REDIS_URL: el límite de intentos de "
            f"login se cuenta por worker, así que en la práctica se permiten "
            f"{workers} veces más intentos.",
            hint="Configurá REDIS_URL para compartir el cache entre workers.",
            id="taller.W001",
        )
    ]
