import json

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import Client, TestCase

from decimal import Decimal

from taller.models import ApiToken, Cliente, MovimientoCuenta, Presupuesto, PresupuestoItem, Trabajo, Turno, Vehiculo
from taller.services import resolver_vehiculo_express_para_usuario


class VehiculoExpressIsolationTests(TestCase):
    def setUp(self):
        self.http = Client()

        self.owner_1 = User.objects.create_user(
            username="owner1@example.com",
            email="owner1@example.com",
            password="clave-segura-1",
        )
        self.owner_2 = User.objects.create_user(
            username="owner2@example.com",
            email="owner2@example.com",
            password="clave-segura-2",
        )

        self.cliente_owner_1 = Cliente.objects.create(owner=self.owner_1, nombre="Cliente Uno")
        self.cliente_owner_2 = Cliente.objects.create(owner=self.owner_2, nombre="Cliente Dos")

    def test_resolver_vehiculo_express_reutiliza_vehiculo_del_mismo_cliente(self):
        vehiculo = Vehiculo.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_owner_1,
            patente="AB123CD",
            marca="Ford",
            modelo="Fiesta",
        )

        resultado = resolver_vehiculo_express_para_usuario(
            cliente=self.cliente_owner_1,
            patente_raw="AB 123 CD",
            marca_modelo="Ford",
            user=self.owner_1,
        )

        self.assertEqual(resultado.id, vehiculo.id)

    def test_turno_express_crea_vehiculo_independiente_con_misma_patente_en_otro_taller(self):
        Vehiculo.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_owner_1,
            patente="AB123CD",
            marca="Ford",
            modelo="Fiesta",
        )
        token = ApiToken.objects.create(user=self.owner_2)

        response = self.http.post(
            "/api/turnos/",
            data=json.dumps(
                {
                    "fecha_hora": "2026-04-20T10:00:00-03:00",
                    "motivo": "Diagnostico inicial",
                    "notas": "",
                    "cliente_express": {
                        "nombre": "Nuevo Taller",
                        "telefono": "3510000000",
                    },
                    "vehiculo_express": {
                        "patente": "AB123CD",
                        "marca": "Toyota",
                    },
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {token.key}",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Turno.objects.filter(owner=self.owner_2).count(), 1)
        vehiculo_owner_2 = Vehiculo.objects.get(owner=self.owner_2, patente="AB123CD")
        self.assertEqual(vehiculo_owner_2.cliente.owner_id, self.owner_2.id)
        self.assertEqual(Vehiculo.objects.filter(patente="AB123CD").count(), 2)

    def test_resolver_vehiculo_express_permite_patente_repetida_en_otro_taller(self):
        vehiculo_owner_1 = Vehiculo.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_owner_1,
            patente="AB123CD",
            marca="Ford",
            modelo="Fiesta",
        )

        vehiculo_owner_2 = resolver_vehiculo_express_para_usuario(
            cliente=self.cliente_owner_2,
            patente_raw="AB123CD",
            marca_modelo="Toyota",
            user=self.owner_2,
        )

        self.assertNotEqual(vehiculo_owner_1.id, vehiculo_owner_2.id)
        self.assertEqual(vehiculo_owner_2.owner_id, self.owner_2.id)
        self.assertEqual(Vehiculo.objects.filter(patente="AB123CD").count(), 2)

    def test_resolver_vehiculo_express_rechaza_patente_duplicada_en_el_mismo_taller(self):
        Vehiculo.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_owner_1,
            patente="AB123CD",
            marca="Ford",
            modelo="Fiesta",
        )
        otro_cliente_mismo_taller = Cliente.objects.create(owner=self.owner_1, nombre="Cliente Tres")

        with self.assertRaises(ValidationError):
            resolver_vehiculo_express_para_usuario(
                cliente=otro_cliente_mismo_taller,
                patente_raw="AB123CD",
                marca_modelo="Toyota",
                user=self.owner_1,
            )


class PortalPublicoTests(TestCase):
    def setUp(self):
        self.http = Client()
        self.owner = User.objects.create_user(
            username="portal@example.com",
            email="portal@example.com",
            password="clave-segura-3",
        )
        self.cliente = Cliente.objects.create(
            owner=self.owner,
            nombre="Cliente Portal",
            telefono="3511111111",
            email="cliente@portal.com",
        )
        self.vehiculo = Vehiculo.objects.create(
            owner=self.owner,
            cliente=self.cliente,
            patente="AC987ZT",
            marca="Peugeot",
            modelo="208",
            kilometraje_actual=54321,
        )
        self.presupuesto = Presupuesto.objects.create(
            owner=self.owner,
            cliente=self.cliente,
            vehiculo=self.vehiculo,
            estado="ENVIADO",
            resumen_corto="Cambio de distribucion",
            total_mano_obra=Decimal("100000.00"),
            total_repuestos=Decimal("50000.00"),
            total=Decimal("150000.00"),
        )
        PresupuestoItem.objects.create(
            presupuesto=self.presupuesto,
            tipo="MANO_OBRA",
            descripcion="Cambio de distribucion",
            cantidad=Decimal("1.00"),
            precio_unitario=Decimal("100000.00"),
            subtotal=Decimal("100000.00"),
        )

    def test_presupuesto_publico_responde_por_token(self):
        response = self.http.get(f"/api/public/presupuestos/{self.presupuesto.token}/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], self.presupuesto.id)
        self.assertEqual(payload["token"], str(self.presupuesto.token))
        self.assertEqual(payload["vehiculo"]["token"], str(self.vehiculo.token))

    def test_portal_publico_puede_aprobar_presupuesto_enviado(self):
        response = self.http.patch(
            f"/api/public/presupuestos/{self.presupuesto.token}/estado/",
            data=json.dumps({"estado": "APROBADO"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.presupuesto.refresh_from_db()
        self.assertEqual(self.presupuesto.estado, "APROBADO")

    def test_api_admin_detalle_presupuesto_serializa_token_como_string_json(self):
        api_token = ApiToken.objects.create(user=self.owner)

        response = self.http.get(
            f"/api/presupuestos/{self.presupuesto.id}",
            HTTP_AUTHORIZATION=f"Token {api_token.key}",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], self.presupuesto.id)
        self.assertEqual(payload["token"], str(self.presupuesto.token))


class OwnerOperacionesTests(TestCase):
    def setUp(self):
        self.http = Client()
        self.owner_1 = User.objects.create_user(
            username="ops1@example.com",
            email="ops1@example.com",
            password="clave-ops-1",
        )
        self.owner_2 = User.objects.create_user(
            username="ops2@example.com",
            email="ops2@example.com",
            password="clave-ops-2",
        )
        self.token_1 = ApiToken.objects.create(user=self.owner_1)
        self.token_2 = ApiToken.objects.create(user=self.owner_2)

        self.cliente_1 = Cliente.objects.create(owner=self.owner_1, nombre="Cliente Ops 1")
        self.cliente_2 = Cliente.objects.create(owner=self.owner_2, nombre="Cliente Ops 2")

        self.vehiculo_1 = Vehiculo.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_1,
            patente="ZZ111AA",
            marca="Fiat",
            modelo="Uno",
        )
        self.vehiculo_2 = Vehiculo.objects.create(
            owner=self.owner_2,
            cliente=self.cliente_2,
            patente="ZZ222BB",
            marca="Ford",
            modelo="Ka",
        )

    def test_trabajo_y_movimiento_sin_owner_explicito_lo_heredan_del_cliente(self):
        trabajo = Trabajo.objects.create(
            cliente=self.cliente_1,
            vehiculo=self.vehiculo_1,
            kilometraje=120000,
            resumen_trabajos="Service general",
        )
        movimiento = MovimientoCuenta.objects.create(
            cliente=self.cliente_1,
            trabajo=trabajo,
            tipo=MovimientoCuenta.TIPO_DEUDA,
            monto=Decimal("50000.00"),
            descripcion="Cargo test",
        )

        self.assertEqual(trabajo.owner_id, self.owner_1.id)
        self.assertEqual(movimiento.owner_id, self.owner_1.id)

    def test_api_trabajos_lista_solo_los_del_owner(self):
        Trabajo.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_1,
            vehiculo=self.vehiculo_1,
            kilometraje=120000,
            resumen_trabajos="Trabajo owner 1",
        )
        Trabajo.objects.create(
            owner=self.owner_2,
            cliente=self.cliente_2,
            vehiculo=self.vehiculo_2,
            kilometraje=98000,
            resumen_trabajos="Trabajo owner 2",
        )

        response = self.http.get(
            "/api/trabajos/",
            HTTP_AUTHORIZATION=f"Token {self.token_1.key}",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["resumen"], "Trabajo owner 1")

    def test_api_movimientos_y_caja_quedan_aislados_por_owner(self):
        MovimientoCuenta.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_1,
            tipo=MovimientoCuenta.TIPO_PAGO,
            monto=Decimal("10000.00"),
            metodo_pago="EFECTIVO",
            descripcion="Pago owner 1",
        )
        MovimientoCuenta.objects.create(
            owner=self.owner_2,
            cliente=self.cliente_2,
            tipo=MovimientoCuenta.TIPO_PAGO,
            monto=Decimal("20000.00"),
            metodo_pago="TRANSFERENCIA",
            descripcion="Pago owner 2",
        )

        response_movs = self.http.get(
            f"/api/clientes/{self.cliente_1.id}/movimientos",
            HTTP_AUTHORIZATION=f"Token {self.token_1.key}",
        )
        response_caja = self.http.get(
            "/api/finanzas/caja",
            HTTP_AUTHORIZATION=f"Token {self.token_1.key}",
        )

        self.assertEqual(response_movs.status_code, 200)
        self.assertEqual(len(response_movs.json()), 1)
        self.assertEqual(response_movs.json()[0]["descripcion"], "Pago owner 1")

        self.assertEqual(response_caja.status_code, 200)
        self.assertEqual(len(response_caja.json()), 1)
        self.assertIn("Pago owner 1", response_caja.json()[0]["concepto"])


class AuthTokenLifecycleTests(TestCase):
    def setUp(self):
        self.http = Client()
        self.owner = User.objects.create_user(
            username="auth@example.com",
            email="auth@example.com",
            password="clave-auth-1",
        )
        self.api_token = ApiToken.objects.create(user=self.owner)

    def test_logout_revoca_el_token_actual(self):
        response = self.http.post(
            "/api/auth/logout/",
            HTTP_AUTHORIZATION=f"Token {self.api_token.key}",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(ApiToken.objects.filter(user=self.owner).exists())

    def test_rotate_token_invalida_el_anterior(self):
        previous_key = self.api_token.key

        response = self.http.post(
            "/api/auth/rotate-token/",
            HTTP_AUTHORIZATION=f"Token {previous_key}",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertNotEqual(payload["token"], previous_key)

        self.api_token.refresh_from_db()
        self.assertEqual(self.api_token.key, payload["token"])

        protected_with_old = self.http.get(
            "/api/dashboard/stats",
            HTTP_AUTHORIZATION=f"Token {previous_key}",
        )
        protected_with_new = self.http.get(
            "/api/dashboard/stats",
            HTTP_AUTHORIZATION=f"Token {payload['token']}",
        )

        self.assertEqual(protected_with_old.status_code, 401)
        self.assertEqual(protected_with_new.status_code, 200)
