"""Regresiones del gráfico de ingresos del panel.

El riesgo está en la zona horaria: un pago de las 23:00 del 30/4 hora local es
01:00 UTC del 1/5. Tiene que contarse en abril, que es cuando el taller lo cobró.
"""
from datetime import datetime, timedelta, timezone as dt_timezone
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from taller.models import Cliente, MovimientoCuenta
from taller.services import obtener_dashboard_snapshot


class IngresosMensualesTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="graf@example.com", password="clave-graf")
        self.cliente = Cliente.objects.create(owner=self.owner, nombre="Cliente Gráfico")

    def _pago(self, cuando_utc: datetime, monto: str):
        MovimientoCuenta.objects.create(
            owner=self.owner, cliente=self.cliente, tipo=MovimientoCuenta.TIPO_PAGO,
            monto=Decimal(monto), fecha=cuando_utc,
        )

    def _serie(self):
        snap = obtener_dashboard_snapshot(user=self.owner)
        return {m["month"]: (m["total"], m["trabajos"]) for m in snap["ingresos_mensuales"]}

    def test_pago_del_ultimo_dia_del_mes_en_hora_local_no_se_corre_al_siguiente(self):
        # Se usan el mes actual y el anterior porque siempre caen dentro de la
        # ventana de 6 meses del gráfico: con meses fijos el test se salteaba
        # solo durante la mitad del año.
        inicio_mes = timezone.localtime(timezone.now()).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        ultimo_dia_23hs = inicio_mes - timedelta(hours=1)
        # El caso filoso: en hora local es el último día del mes, en UTC ya es día 1.
        self.assertEqual(ultimo_dia_23hs.astimezone(dt_timezone.utc).day, 1)

        self._pago(ultimo_dia_23hs, "1000.00")
        self._pago(inicio_mes + timedelta(hours=1), "500.00")

        serie = self._serie()
        mes_anterior = f"{ultimo_dia_23hs.year}-{ultimo_dia_23hs.month:02d}-01"
        mes_actual = f"{inicio_mes.year}-{inicio_mes.month:02d}-01"
        self.assertEqual(serie[mes_anterior], (1000.0, 1), "el cobro de las 23:00 del último día debe quedar en ese mes")
        self.assertEqual(serie[mes_actual], (500.0, 1))

    def test_suma_y_cuenta_por_mes(self):
        hoy = timezone.localtime(timezone.now())
        mes = f"{hoy.year}-{hoy.month:02d}-01"
        self._pago(timezone.now(), "1500.50")
        self._pago(timezone.now(), "2499.50")

        serie = self._serie()
        self.assertEqual(serie[mes], (4000.0, 2))

    def test_meses_sin_pagos_quedan_en_cero_y_la_grilla_tiene_seis(self):
        serie = self._serie()
        self.assertEqual(len(serie), 6)
        self.assertTrue(all(total == 0.0 for total, _ in serie.values()))

    def test_los_pagos_de_otro_taller_no_entran(self):
        otro = User.objects.create_user(username="otro-graf@example.com", password="x")
        otro_cliente = Cliente.objects.create(owner=otro, nombre="Ajeno")
        MovimientoCuenta.objects.create(
            owner=otro, cliente=otro_cliente, tipo=MovimientoCuenta.TIPO_PAGO,
            monto=Decimal("9999.00"), fecha=timezone.now(),
        )
        hoy = timezone.localtime(timezone.now())
        serie = self._serie()
        self.assertEqual(serie[f"{hoy.year}-{hoy.month:02d}-01"], (0.0, 0))

    def test_las_deudas_no_cuentan_como_ingreso(self):
        MovimientoCuenta.objects.create(
            owner=self.owner, cliente=self.cliente, tipo=MovimientoCuenta.TIPO_DEUDA,
            monto=Decimal("7000.00"), fecha=timezone.now(),
        )
        hoy = timezone.localtime(timezone.now())
        serie = self._serie()
        self.assertEqual(serie[f"{hoy.year}-{hoy.month:02d}-01"], (0.0, 0))
