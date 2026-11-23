"""Barrido de humo: ningún GET debe devolver 500, ni con taller vacío ni con datos."""
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client, TestCase
from django.utils import timezone

from taller.models import (
    ApiToken, Cliente, Gasto, MovimientoCuenta, Presupuesto, PresupuestoItem,
    Trabajo, TrabajoItem, Turno, Vehiculo,
)


GETS = [
    "/api/dashboard/stats", "/api/avisos", "/api/clientes", "/api/vehiculos",
    "/api/trabajos/", "/api/trabajos/tablero", "/api/turnos/",
    "/api/presupuestos/", "/api/finanzas/gastos", "/api/finanzas/gastos/resumen",
    "/api/finanzas/caja", "/api/finanzas/caja/resumen", "/api/auth/session",
]


class SmokeVacioTests(TestCase):
    """Taller recién creado, sin un solo dato."""

    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="vacio@example.com", password="clave-vacia")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}

    def test_ningun_get_explota_con_taller_vacio(self):
        fallos = []
        for path in GETS:
            r = self.http.get(path, **self.auth)
            if r.status_code >= 500:
                fallos.append(f"{path} -> {r.status_code}")
        self.assertEqual(fallos, [], f"Endpoints rotos: {fallos}")


class SmokeConDatosTests(TestCase):
    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="lleno@example.com", password="clave-llena")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}

        c = Cliente.objects.create(owner=self.owner, nombre="Ana", apellido="Gómez", saldo_balance=Decimal("1500"))
        v = Vehiculo.objects.create(
            owner=self.owner, cliente=c, patente="AAA111", marca="Ford", modelo="Focus",
            kilometraje_actual=100_000, proximo_service_km=100_500,
        )
        t = Trabajo.objects.create(
            owner=self.owner, cliente=c, vehiculo=v, kilometraje=100_000,
            resumen_trabajos="Service", estado="FINALIZADO", total=Decimal("50000"),
        )
        TrabajoItem.objects.create(trabajo=t, descripcion="Mano de obra", cantidad=1, precio_unitario=Decimal("50000"))
        p = Presupuesto.objects.create(owner=self.owner, cliente=c, vehiculo=v, resumen_corto="Presu", estado="ENVIADO")
        PresupuestoItem.objects.create(presupuesto=p, descripcion="Filtro", cantidad=1, precio_unitario=Decimal("9000"))
        Turno.objects.create(owner=self.owner, cliente=c, vehiculo=v, fecha_hora=timezone.now(), motivo="Revisión")
        MovimientoCuenta.objects.create(owner=self.owner, cliente=c, tipo="PAGO", monto=Decimal("1000"), metodo_pago="EFECTIVO")
        Gasto.objects.create(owner=self.owner, descripcion="Aceite", monto=Decimal("3000"))
        self.c, self.v, self.t, self.p = c, v, t, p

    def test_ningun_get_explota_con_datos(self):
        rutas = GETS + [
            f"/api/clientes/{self.c.id}",
            f"/api/vehiculos/{self.v.id}",
            f"/api/vehiculos/{self.v.id}/historial/",
            f"/api/trabajos/{self.t.id}",
            f"/api/presupuestos/{self.p.id}",
            f"/api/clientes/{self.c.id}/movimientos",
            f"/api/public/presupuestos/{self.p.token}/",
            f"/api/public/vehiculos/{self.v.token}/",
        ]
        fallos = []
        for path in rutas:
            r = self.http.get(path, **self.auth)
            if r.status_code >= 500:
                fallos.append(f"{path} -> {r.status_code}")
        self.assertEqual(fallos, [], f"Endpoints rotos: {fallos}")

    def test_busquedas_con_texto_raro_no_explotan(self):
        fallos = []
        for q in ["%", "_", "'", '"', "a" * 300, "ñ", "100%", "\\", "<script>"]:
            for path in ("/api/clientes", "/api/vehiculos", "/api/trabajos/", "/api/presupuestos/", "/api/turnos/"):
                r = self.http.get(path, {"q": q}, **self.auth)
                if r.status_code >= 500:
                    fallos.append(f"{path}?q={q!r} -> {r.status_code}")
        self.assertEqual(fallos, [], f"Búsquedas rotas: {fallos}")
