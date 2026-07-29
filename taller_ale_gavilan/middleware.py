# taller_ale_gavilan/middleware.py
from django.db import connection
from django.http import JsonResponse


class HealthcheckMiddleware:
    """Atiende /healthz/ antes que cualquier otro middleware.

    El probe interno de Railway le pega al contenedor por su red privada,
    con un Host header que nunca va a estar en ALLOWED_HOSTS (esa lista solo
    conoce el dominio público). Si dejamos que la request siga la cadena
    normal, SecurityMiddleware/CommonMiddleware terminan llamando
    request.get_host() y Django la tira con 400 antes de llegar a la vista.
    Resolver acá, primero en la lista, evita que cualquier chequeo de host
    se dispare para esta ruta puntual.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/healthz/":
            try:
                connection.ensure_connection()
            except Exception:
                return JsonResponse({"status": "unavailable"}, status=503)
            return JsonResponse({"status": "ok"})
        return self.get_response(request)
