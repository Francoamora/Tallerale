import json
from io import BytesIO
from pathlib import Path
import tempfile
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from django.utils import timezone
from PIL import Image

from decimal import Decimal

from taller.models import ApiToken, Cliente, Gasto, MembresiaTaller, MovimientoCuenta, PerfilTaller, Presupuesto, PresupuestoItem, Producto, Taller, Trabajo, TrabajoItem, Turno, Vehiculo
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

    def test_logo_valido_se_aisla_por_taller_y_aparece_en_portal_publico(self):
        token = ApiToken.objects.create(user=self.owner)
        PerfilTaller.objects.create(
            user=self.owner,
            nombre="Dueño Portal",
            taller_nombre="Taller Portal",
        )
        contenido = BytesIO()
        Image.new("RGB", (32, 32), "#ff6b00").save(contenido, format="PNG")

        with tempfile.TemporaryDirectory() as media_root, self.settings(MEDIA_ROOT=Path(media_root)):
            subida = self.http.post(
                "/api/perfil/logo/",
                {"archivo": SimpleUploadedFile("mi-logo.png", contenido.getvalue(), content_type="image/png")},
                HTTP_AUTHORIZATION=f"Token {token.key}",
            )
            self.assertEqual(subida.status_code, 200)
            logo_url = subida.json()["logo_url"]
            self.assertIn(f"/media/taller/logos/{self.owner.id}/", logo_url)
            self.assertNotIn("mi-logo", logo_url)

            archivo_publico = self.http.get(logo_url)
            self.assertEqual(archivo_publico.status_code, 200)

            portal = self.http.get(f"/api/public/presupuestos/{self.presupuesto.token}/")
            self.assertEqual(portal.status_code, 200)
            self.assertEqual(portal.json()["taller_nombre"], "Taller Portal")
            self.assertEqual(portal.json()["taller_logo_url"], logo_url)

    def test_logo_falso_o_svg_es_rechazado(self):
        token = ApiToken.objects.create(user=self.owner)
        PerfilTaller.objects.create(
            user=self.owner,
            nombre="Dueño Portal",
            taller_nombre="Taller Portal",
        )
        casos = (
            SimpleUploadedFile("logo.svg", b"<svg></svg>", content_type="image/svg+xml"),
            SimpleUploadedFile("logo.png", b"esto no es una imagen", content_type="image/png"),
        )
        for archivo in casos:
            response = self.http.post(
                "/api/perfil/logo/",
                {"archivo": archivo},
                HTTP_AUTHORIZATION=f"Token {token.key}",
            )
            self.assertEqual(response.status_code, 400)

    def test_administrador_invitado_actualiza_el_logo_unico_del_taller(self):
        perfil_owner = PerfilTaller.objects.create(
            user=self.owner,
            nombre="Dueño Portal",
            taller_nombre="Taller Portal",
        )
        taller = Taller.objects.create(owner=self.owner, nombre="Taller Portal")
        MembresiaTaller.objects.create(
            taller=taller,
            user=self.owner,
            rol=MembresiaTaller.ROL_ADMIN,
        )
        administrador = User.objects.create_user(
            username="admin-invitado@portal.com",
            email="admin-invitado@portal.com",
            password="clave-segura-admin",
        )
        MembresiaTaller.objects.create(
            taller=taller,
            user=administrador,
            rol=MembresiaTaller.ROL_ADMIN,
        )
        token = ApiToken.objects.create(user=administrador)
        contenido = BytesIO()
        Image.new("RGB", (32, 32), "#ff6b00").save(contenido, format="PNG")

        with tempfile.TemporaryDirectory() as media_root, self.settings(MEDIA_ROOT=Path(media_root)):
            subida = self.http.post(
                "/api/perfil/logo/",
                {"archivo": SimpleUploadedFile("logo.png", contenido.getvalue(), content_type="image/png")},
                HTTP_AUTHORIZATION=f"Token {token.key}",
            )

            self.assertEqual(subida.status_code, 200)
            perfil_owner.refresh_from_db()
            self.assertTrue(perfil_owner.logo.name)
            self.assertIn(f"/media/taller/logos/{self.owner.id}/", subida.json()["logo_url"])
            self.assertFalse(PerfilTaller.objects.filter(user=administrador).exists())

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

    def test_portal_publico_rechaza_link_vencido_o_revocado(self):
        self.presupuesto.portal_expires_at = timezone.now() - timedelta(seconds=1)
        self.presupuesto.save(update_fields=["portal_expires_at"])
        self.assertEqual(
            self.http.get(f"/api/public/presupuestos/{self.presupuesto.token}/").status_code,
            404,
        )
        self.presupuesto.portal_expires_at = timezone.now() + timedelta(days=1)
        self.presupuesto.portal_activo = False
        self.presupuesto.save(update_fields=["portal_expires_at", "portal_activo"])
        self.assertEqual(
            self.http.get(f"/api/public/presupuestos/{self.presupuesto.token}/").status_code,
            404,
        )

    def test_legajo_publico_muestra_solo_trabajos_realizados_y_estado_de_cuenta(self):
        terminado = Trabajo.objects.create(
            owner=self.owner,
            cliente=self.cliente,
            vehiculo=self.vehiculo,
            kilometraje=86_000,
            estado=Trabajo.ESTADO_ENTREGADO,
            resumen_trabajos="Cambio de aceite y filtros",
            observaciones_internas="No exponer nunca",
            finalizado_en=timezone.now(),
        )
        TrabajoItem.objects.create(
            trabajo=terminado,
            tipo="MANO_OBRA",
            descripcion="Cambio de aceite",
            cantidad=Decimal("1"),
            precio_unitario=Decimal("1000"),
            completado=True,
        )
        TrabajoItem.objects.create(
            trabajo=terminado,
            tipo="REPUESTO",
            descripcion="Filtro pendiente",
            cantidad=Decimal("1"),
            precio_unitario=Decimal("1000"),
            completado=False,
        )
        Trabajo.objects.create(
            owner=self.owner,
            cliente=self.cliente,
            vehiculo=self.vehiculo,
            kilometraje=87_000,
            estado=Trabajo.ESTADO_EN_PROCESO,
            resumen_trabajos="Trabajo que sigue abierto",
        )
        MovimientoCuenta.objects.create(
            owner=self.owner,
            cliente=self.cliente,
            tipo=MovimientoCuenta.TIPO_DEUDA,
            monto=Decimal("25000"),
            descripcion="Service pendiente de pago",
        )
        self.cliente.saldo_balance = Decimal("25000")
        self.cliente.save(update_fields=["saldo_balance"])

        response = self.http.get(f"/api/public/vehiculos/{self.vehiculo.token}/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["saldo_pendiente"], 25000.0)
        self.assertEqual(len(payload["historial"]), 1)
        self.assertEqual(payload["historial"][0]["resumen_trabajos"], "Cambio de aceite y filtros")
        self.assertEqual(payload["historial"][0]["items"], [{"descripcion": "Cambio de aceite", "cantidad": 1.0}])
        self.assertNotIn("total", payload["historial"][0])
        self.assertNotIn("observaciones_internas", payload["historial"][0])
        self.assertEqual(payload["movimientos_cuenta"][0]["descripcion"], "Service pendiente de pago")

    def test_owner_puede_revocar_y_regenerar_link_publico(self):
        api_token = ApiToken.objects.create(user=self.owner)
        old_token = self.presupuesto.token

        revoked = self.http.patch(
            f"/api/presupuestos/{self.presupuesto.id}/portal",
            data=json.dumps({"activo": False}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {api_token.key}",
        )
        self.assertEqual(revoked.status_code, 200)
        self.assertEqual(self.http.get(f"/api/public/presupuestos/{old_token}/").status_code, 404)

        regenerated = self.http.patch(
            f"/api/presupuestos/{self.presupuesto.id}/portal",
            data=json.dumps({"activo": True, "regenerar_token": True}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {api_token.key}",
        )
        self.assertEqual(regenerated.status_code, 200)
        self.assertNotEqual(regenerated.json()["token"], str(old_token))


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

    def test_cobro_rechaza_cliente_de_otro_taller(self):
        response = self.http.post(
            "/api/pagos/",
            data=json.dumps(
                {
                    "cliente_id": self.cliente_2.id,
                    "monto_total_venta": 10000,
                    "monto_pagado": 0,
                    "metodo_pago": "EFECTIVO",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {self.token_1.key}",
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(MovimientoCuenta.objects.filter(owner=self.owner_1, cliente=self.cliente_2).exists())

    def test_cobro_rechaza_importe_mayor_al_saldo(self):
        self.cliente_1.saldo_balance = Decimal("10000.00")
        self.cliente_1.save(update_fields=["saldo_balance"])

        response = self.http.post(
            "/api/pagos/",
            data=json.dumps(
                {
                    "cliente_id": self.cliente_1.id,
                    "monto_total_venta": 0,
                    "monto_pagado": 15000,
                    "metodo_pago": "EFECTIVO",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {self.token_1.key}",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("no puede superar", response.json()["message"])
        self.assertFalse(MovimientoCuenta.objects.filter(owner=self.owner_1, cliente=self.cliente_1).exists())


class AuthTokenLifecycleTests(TestCase):
    def setUp(self):
        cache.clear()
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

    def test_token_vencido_no_accede_a_rutas_protegidas(self):
        self.api_token.expires_at = timezone.now() - timedelta(seconds=1)
        self.api_token.save(update_fields=["expires_at"])

        response = self.http.get(
            "/api/dashboard/stats",
            HTTP_AUTHORIZATION=f"Token {self.api_token.key}",
        )

        self.assertEqual(response.status_code, 401)

    def test_empleado_conserva_su_identidad_y_la_marca_del_taller(self):
        PerfilTaller.objects.create(
            user=self.owner,
            nombre="Nombre del dueño",
            taller_nombre="Taller Central",
        )
        taller = Taller.objects.create(owner=self.owner, nombre="Taller Central")
        MembresiaTaller.objects.create(
            taller=taller,
            user=self.owner,
            rol=MembresiaTaller.ROL_ADMIN,
        )
        empleado = User.objects.create_user(
            username="mecanico@example.com",
            email="mecanico@example.com",
            password="clave-mecanico",
            first_name="Topo",
        )
        MembresiaTaller.objects.create(
            taller=taller,
            user=empleado,
            rol=MembresiaTaller.ROL_MECANICO,
        )

        login = self.http.post(
            "/api/auth/login/",
            data=json.dumps({"email": empleado.email, "password": "clave-mecanico"}),
            content_type="application/json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["nombre"], "Topo")
        self.assertEqual(login.json()["taller_nombre"], "Taller Central")
        self.assertEqual(login.json()["rol"], MembresiaTaller.ROL_MECANICO)

        rotado = self.http.post(
            "/api/auth/rotate-token/",
            HTTP_AUTHORIZATION=f"Token {login.json()['token']}",
        )
        self.assertEqual(rotado.status_code, 200)
        self.assertEqual(rotado.json()["user_id"], empleado.id)
        self.assertEqual(rotado.json()["nombre"], "Topo")
        self.assertEqual(rotado.json()["taller_id"], taller.id)
        self.assertEqual(rotado.json()["rol"], MembresiaTaller.ROL_MECANICO)

    def test_login_limita_intentos_fallidos_por_origen(self):
        payload = json.dumps({"email": self.owner.email, "password": "incorrecta"})

        for _ in range(5):
            response = self.http.post(
                "/api/auth/login/",
                data=payload,
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 400)

        blocked = self.http.post(
            "/api/auth/login/",
            data=payload,
            content_type="application/json",
        )
        self.assertEqual(blocked.status_code, 429)


class SecurityBoundaryAttackTests(TestCase):
    """Ataques simulados contra límites de tenant y autenticación.

    Cada prueba usa dos talleres independientes y confirma que el token del
    primero no puede leer, mutar ni asociar recursos del segundo.
    """

    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner_1 = User.objects.create_user(username="red@example.com", password="clave-red")
        self.owner_2 = User.objects.create_user(username="blue@example.com", password="clave-blue")
        self.token_1 = ApiToken.objects.create(user=self.owner_1)

        self.cliente_1 = Cliente.objects.create(owner=self.owner_1, nombre="Cliente Red")
        self.cliente_2 = Cliente.objects.create(owner=self.owner_2, nombre="Cliente Blue")
        self.vehiculo_1 = Vehiculo.objects.create(owner=self.owner_1, cliente=self.cliente_1, patente="RED111")
        self.vehiculo_2 = Vehiculo.objects.create(owner=self.owner_2, cliente=self.cliente_2, patente="BLU222")
        self.trabajo_2 = Trabajo.objects.create(
            owner=self.owner_2,
            cliente=self.cliente_2,
            vehiculo=self.vehiculo_2,
            kilometraje=20_000,
            resumen_trabajos="Trabajo privado",
        )
        self.turno_2 = Turno.objects.create(
            owner=self.owner_2,
            cliente=self.cliente_2,
            vehiculo=self.vehiculo_2,
            fecha_hora="2026-08-01T10:00:00-03:00",
            motivo="Turno privado",
        )
        self.presupuesto_2 = Presupuesto.objects.create(
            owner=self.owner_2,
            cliente=self.cliente_2,
            vehiculo=self.vehiculo_2,
            resumen_corto="Presupuesto privado",
        )

    @property
    def auth(self):
        return {"HTTP_AUTHORIZATION": f"Token {self.token_1.key}"}

    def test_sin_token_las_rutas_operativas_rechazan_el_acceso(self):
        for path in (
            "/api/dashboard/stats",
            "/api/clientes",
            "/api/vehiculos",
            "/api/trabajos/",
            "/api/turnos/",
            "/api/presupuestos/",
            "/api/finanzas/caja",
        ):
            self.assertEqual(self.http.get(path).status_code, 401, path)

    def test_flota_expone_el_nombre_del_titular_sin_revelar_otro_taller(self):
        response = self.http.get("/api/vehiculos", **self.auth)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["cliente_nombre"], self.cliente_1.nombre_completo)
        self.assertNotContains(response, self.cliente_2.nombre)

    def test_editar_cliente_conserva_nombre_y_apellido_separados(self):
        response = self.http.put(
            f"/api/clientes/{self.cliente_1.id}",
            data=json.dumps(
                {
                    "nombre": "Ana",
                    "apellido": "Pérez",
                    "telefono": "3420000000",
                    "email": "ana@example.com",
                    "dni": "12345678",
                }
            ),
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 200)
        self.cliente_1.refresh_from_db()
        self.assertEqual((self.cliente_1.nombre, self.cliente_1.apellido), ("Ana", "Pérez"))

    def test_presupuesto_rechaza_estados_de_orden_de_trabajo(self):
        presupuesto = Presupuesto.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_1,
            vehiculo=self.vehiculo_1,
            resumen_corto="Cotización propia",
        )

        response = self.http.patch(
            f"/api/presupuestos/{presupuesto.id}/estado",
            data=json.dumps({"estado": "ENTREGADO"}),
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 400)
        presupuesto.refresh_from_db()
        self.assertEqual(presupuesto.estado, "BORRADOR")

    def test_alta_completa_crea_cliente_y_vehiculo_vinculados(self):
        response = self.http.post(
            "/api/directorio/alta-completa",
            data=json.dumps(
                {
                    "cliente": {
                        "nombre": "Marina",
                        "apellido": "Gómez",
                        "telefono": "3421111111",
                        "email": "marina@example.com",
                        "dni": "30111222",
                    },
                    "vehiculo": {
                        "patente": "AC 456 DE",
                        "marca": "Renault",
                        "modelo": "Sandero",
                        "anio": 2021,
                        "color": "Gris",
                        "kilometraje_actual": 45000,
                        "proximo_service_km": 50000,
                    },
                }
            ),
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 201)
        cliente = Cliente.objects.get(owner=self.owner_1, email="marina@example.com")
        vehiculo = Vehiculo.objects.get(owner=self.owner_1, patente="AC456DE")
        self.assertEqual(vehiculo.cliente_id, cliente.id)
        self.assertEqual(response.json()["vehiculo"]["cliente_nombre"], "Marina Gómez")

    def test_alta_completa_no_deja_cliente_huerfano_si_la_patente_ya_existe(self):
        clientes_antes = Cliente.objects.filter(owner=self.owner_1).count()
        response = self.http.post(
            "/api/directorio/alta-completa",
            data=json.dumps(
                {
                    "cliente": {"nombre": "No Debe Crearse"},
                    "vehiculo": {
                        "patente": self.vehiculo_1.patente,
                        "marca": "Ford",
                        "modelo": "Focus",
                    },
                }
            ),
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Cliente.objects.filter(owner=self.owner_1).count(), clientes_antes)
        self.assertFalse(Cliente.objects.filter(owner=self.owner_1, nombre="No Debe Crearse").exists())

    def test_adivinar_ids_de_otro_taller_no_revela_recursos(self):
        private_paths = (
            f"/api/clientes/{self.cliente_2.id}",
            f"/api/vehiculos/{self.vehiculo_2.id}",
            f"/api/trabajos/{self.trabajo_2.id}",
            f"/api/turnos/{self.turno_2.id}",
            f"/api/presupuestos/{self.presupuesto_2.id}",
            f"/api/clientes/{self.cliente_2.id}/movimientos",
        )
        for path in private_paths:
            self.assertEqual(self.http.get(path, **self.auth).status_code, 404, path)

    def test_mutaciones_con_ids_ajenos_son_bloqueadas(self):
        attempts = (
            self.http.patch(
                f"/api/trabajos/{self.trabajo_2.id}/estado",
                data=json.dumps({"estado": "FINALIZADO"}),
                content_type="application/json",
                **self.auth,
            ),
            self.http.patch(
                f"/api/turnos/{self.turno_2.id}/estado",
                data=json.dumps({"estado": "CANCELADO"}),
                content_type="application/json",
                **self.auth,
            ),
            self.http.patch(
                f"/api/presupuestos/{self.presupuesto_2.id}/estado",
                data=json.dumps({"estado": "APROBADO"}),
                content_type="application/json",
                **self.auth,
            ),
            self.http.delete(f"/api/trabajos/{self.trabajo_2.id}", **self.auth),
        )

        for response in attempts:
            self.assertEqual(response.status_code, 404)

        self.trabajo_2.refresh_from_db()
        self.turno_2.refresh_from_db()
        self.presupuesto_2.refresh_from_db()
        self.assertEqual(self.trabajo_2.estado, "INGRESADO")
        self.assertEqual(self.turno_2.estado, "PENDIENTE")
        self.assertEqual(self.presupuesto_2.estado, "BORRADOR")

    def test_no_puede_mezclar_cliente_propio_con_vehiculo_ajeno(self):
        response = self.http.post(
            "/api/trabajos/",
            data=json.dumps(
                {
                    "cliente_id": self.cliente_1.id,
                    "vehiculo_id": self.vehiculo_2.id,
                    "kilometraje": 25_000,
                    "estado": "INGRESADO",
                    "resumen_trabajos": "Intento de cruce",
                    "items": [
                        {
                            "tipo": "MANO_OBRA",
                            "descripcion": "Diagnóstico",
                            "cantidad": 1,
                            "precio_unitario": 1,
                        }
                    ],
                }
            ),
            content_type="application/json",
            **self.auth,
        )

        self.assertIn(response.status_code, {400, 404})
        self.assertFalse(Trabajo.objects.filter(owner=self.owner_1, resumen_trabajos="Intento de cruce").exists())

    def test_vistas_clasicas_tambien_bloquean_idor(self):
        self.http.force_login(self.owner_1)
        private_paths = (
            f"/clientes/{self.cliente_2.id}/",
            f"/vehiculos/{self.vehiculo_2.id}/",
            f"/trabajos/{self.trabajo_2.id}/",
            f"/turnos/{self.turno_2.id}/",
            f"/presupuestos/{self.presupuesto_2.id}/",
        )

        for path in private_paths:
            self.assertEqual(self.http.get(path).status_code, 404, path)

    def test_no_puede_convertir_un_presupuesto_de_otro_taller_en_orden(self):
        response = self.http.post(
            "/api/trabajos/",
            data=json.dumps(
                {
                    "cliente_id": self.cliente_1.id,
                    "vehiculo_id": self.vehiculo_1.id,
                    "presupuesto_origen_id": self.presupuesto_2.id,
                    "kilometraje": 25_000,
                    "estado": "INGRESADO",
                    "resumen_trabajos": "Conversión maliciosa",
                    "items": [
                        {
                            "tipo": "MANO_OBRA",
                            "descripcion": "Diagnóstico",
                            "cantidad": 1,
                            "precio_unitario": 1,
                        }
                    ],
                }
            ),
            content_type="application/json",
            **self.auth,
        )

        self.assertIn(response.status_code, {400, 404})
        self.assertFalse(Trabajo.objects.filter(owner=self.owner_1, resumen_trabajos="Conversión maliciosa").exists())

    def test_conversion_valida_vincula_y_aprueba_el_presupuesto(self):
        presupuesto = Presupuesto.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_1,
            vehiculo=self.vehiculo_1,
            estado="ENVIADO",
            resumen_corto="Service a convertir",
        )

        response = self.http.post(
            "/api/trabajos/",
            data=json.dumps(
                {
                    "cliente_id": self.cliente_1.id,
                    "vehiculo_id": self.vehiculo_1.id,
                    "presupuesto_origen_id": presupuesto.id,
                    "kilometraje": 25_000,
                    "estado": "INGRESADO",
                    "resumen_trabajos": "Service a convertir",
                    "items": [
                        {
                            "tipo": "MANO_OBRA",
                            "descripcion": "Service",
                            "cantidad": 1,
                            "precio_unitario": 10_000,
                        }
                    ],
                }
            ),
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(response.status_code, 201)
        trabajo = Trabajo.objects.get(pk=response.json()["id"])
        presupuesto.refresh_from_db()
        self.assertEqual(trabajo.presupuesto_origen_id, presupuesto.id)
        self.assertEqual(presupuesto.estado, "APROBADO")

    def test_inventario_es_privado_por_taller_y_permite_mismo_codigo(self):
        Producto.objects.create(owner=self.owner_2, codigo="FILTRO-01", nombre="Filtro privado")
        response = self.http.post(
            "/api/productos/",
            data=json.dumps({"codigo": "FILTRO-01", "nombre": "Filtro propio"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 201)

        listado = self.http.get("/api/productos", **self.auth)
        self.assertEqual(listado.status_code, 200)
        self.assertEqual(len(listado.json()), 1)
        self.assertEqual(listado.json()[0]["nombre"], "Filtro propio")

    def test_mecanico_no_accede_al_directorio_comercial(self):
        taller = Taller.objects.create(owner=self.owner_1, nombre="Taller Red")
        empleado = User.objects.create_user(username="mecanico@red.com", password="clave-empleado")
        MembresiaTaller.objects.create(taller=taller, user=empleado, rol=MembresiaTaller.ROL_MECANICO)
        token_empleado = ApiToken.objects.create(user=empleado)

        response = self.http.get("/api/clientes", HTTP_AUTHORIZATION=f"Token {token_empleado.key}")
        self.assertEqual(response.status_code, 403)

    def test_mecanico_no_puede_consultar_finanzas_del_taller(self):
        taller = Taller.objects.create(owner=self.owner_1, nombre="Taller Red")
        empleado = User.objects.create_user(username="mecanico-finanzas@red.com", password="clave-empleado")
        MembresiaTaller.objects.create(taller=taller, user=empleado, rol=MembresiaTaller.ROL_MECANICO)
        token_empleado = ApiToken.objects.create(user=empleado)

        response = self.http.get("/api/finanzas/caja", HTTP_AUTHORIZATION=f"Token {token_empleado.key}")
        self.assertEqual(response.status_code, 403)

    def test_recepcion_puede_cobrar_sin_acceder_a_reportes_financieros(self):
        taller = Taller.objects.create(owner=self.owner_1, nombre="Taller Red")
        recepcion = User.objects.create_user(username="recepcion-caja@red.com", password="clave-empleado")
        MembresiaTaller.objects.create(taller=taller, user=recepcion, rol=MembresiaTaller.ROL_RECEPCION)
        token_recepcion = ApiToken.objects.create(user=recepcion)
        self.cliente_1.saldo_balance = Decimal("10000.00")
        self.cliente_1.save(update_fields=["saldo_balance"])

        cobro = self.http.post(
            "/api/pagos/",
            data=json.dumps(
                {
                    "cliente_id": self.cliente_1.id,
                    "monto_total_venta": 0,
                    "monto_pagado": 5000,
                    "metodo_pago": "EFECTIVO",
                    "descripcion": "Abono en recepción",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {token_recepcion.key}",
        )
        reporte = self.http.get(
            "/api/finanzas/caja",
            HTTP_AUTHORIZATION=f"Token {token_recepcion.key}",
        )

        self.assertEqual(cobro.status_code, 201)
        self.assertEqual(cobro.json()["nuevo_saldo"], 5000.0)
        self.assertEqual(reporte.status_code, 403)

    def test_mecanico_no_puede_registrar_cobros(self):
        taller = Taller.objects.create(owner=self.owner_1, nombre="Taller Red")
        mecanico = User.objects.create_user(username="mecanico-caja@red.com", password="clave-empleado")
        MembresiaTaller.objects.create(taller=taller, user=mecanico, rol=MembresiaTaller.ROL_MECANICO)
        token_mecanico = ApiToken.objects.create(user=mecanico)

        response = self.http.post(
            "/api/pagos/",
            data=json.dumps(
                {
                    "cliente_id": self.cliente_1.id,
                    "monto_pagado": 1000,
                    "metodo_pago": "EFECTIVO",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {token_mecanico.key}",
        )

        self.assertEqual(response.status_code, 403)

    def test_dashboard_mecanico_no_filtra_montos_financieros(self):
        taller = Taller.objects.create(owner=self.owner_1, nombre="Taller Red")
        empleado = User.objects.create_user(username="mecanico-dashboard@red.com", password="clave-empleado")
        MembresiaTaller.objects.create(taller=taller, user=empleado, rol=MembresiaTaller.ROL_MECANICO)
        token_empleado = ApiToken.objects.create(user=empleado)
        trabajo = Trabajo.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_1,
            vehiculo=self.vehiculo_1,
            kilometraje=25_000,
            resumen_trabajos="Trabajo visible sin precio",
            total=Decimal("75000.00"),
        )
        MovimientoCuenta.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_1,
            trabajo=trabajo,
            tipo=MovimientoCuenta.TIPO_PAGO,
            monto=Decimal("75000.00"),
            descripcion="Cobro privado",
        )

        response = self.http.get(
            "/api/dashboard/stats",
            HTTP_AUTHORIZATION=f"Token {token_empleado.key}",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["ingresos_mes_actual"], 0)
        self.assertEqual(payload["cuenta_corriente_pendiente"], 0)
        self.assertEqual(payload["ticket_promedio"], 0)
        self.assertEqual(payload["ingresos_mensuales"], [])
        self.assertEqual(payload["trabajos_recientes"][0]["total"], 0)
        self.assertEqual(payload["trabajos_recientes"][0]["resumen"], "Trabajo visible sin precio")

    def test_tablero_mecanico_oculta_importes_y_bloquea_edicion_comercial(self):
        taller = Taller.objects.create(owner=self.owner_1, nombre="Taller Red")
        empleado = User.objects.create_user(username="mecanico-tablero@red.com", password="clave-empleado")
        MembresiaTaller.objects.create(taller=taller, user=empleado, rol=MembresiaTaller.ROL_MECANICO)
        token = ApiToken.objects.create(user=empleado)
        trabajo = Trabajo.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_1,
            vehiculo=self.vehiculo_1,
            kilometraje=25_000,
            resumen_trabajos="Cambio seguro",
            total=Decimal("99000.00"),
        )
        item = TrabajoItem.objects.create(
            trabajo=trabajo,
            tipo=TrabajoItem.TIPO_REPUESTO,
            descripcion="Filtro privado",
            cantidad=1,
            precio_unitario=Decimal("99000.00"),
        )
        auth = {"HTTP_AUTHORIZATION": f"Token {token.key}"}

        tablero = self.http.get("/api/trabajos/tablero", **auth)
        detalle = self.http.get(f"/api/trabajos/{trabajo.id}", **auth)
        intento_edicion = self.http.put(
            f"/api/trabajos/{trabajo.id}",
            data=json.dumps({
                "vehiculo_id": self.vehiculo_1.id,
                "cliente_id": self.cliente_1.id,
                "kilometraje": 25_000,
                "resumen_trabajos": "Cambio de precio",
                "items": [{"tipo": "REPUESTO", "descripcion": "Filtro", "cantidad": 1, "precio_unitario": 1}],
            }),
            content_type="application/json",
            **auth,
        )

        self.assertEqual(tablero.status_code, 200)
        self.assertEqual(tablero.json()["INGRESADO"]["total_plata"], 0)
        self.assertEqual(tablero.json()["INGRESADO"]["trabajos"][0]["total"], 0)
        self.assertEqual(detalle.status_code, 200)
        self.assertEqual(detalle.json()["total"], 0)
        self.assertEqual(Decimal(str(detalle.json()["items"][0]["precio_unitario"])), Decimal("0"))
        self.assertFalse(detalle.json()["items"][0]["completado"])
        self.assertEqual(intento_edicion.status_code, 403)

        anular = self.http.patch(
            f"/api/trabajos/{trabajo.id}/estado",
            data=json.dumps({"estado": "ANULADO"}),
            content_type="application/json",
            **auth,
        )
        trabajo.estado = Trabajo.ESTADO_FINALIZADO
        trabajo.save(update_fields=["estado"])
        entregar = self.http.patch(
            f"/api/trabajos/{trabajo.id}/estado",
            data=json.dumps({"estado": "ENTREGADO"}),
            content_type="application/json",
            **auth,
        )

        self.assertEqual(anular.status_code, 403)
        self.assertEqual(entregar.status_code, 403)
        item.refresh_from_db()
        self.assertEqual(item.precio_unitario, Decimal("99000.00"))

    def test_contador_no_puede_ingresar_al_tablero_operativo(self):
        taller = Taller.objects.create(owner=self.owner_1, nombre="Taller Red")
        contador = User.objects.create_user(username="contador-operaciones@red.com", password="clave-empleado")
        MembresiaTaller.objects.create(taller=taller, user=contador, rol=MembresiaTaller.ROL_CONTADOR)
        token = ApiToken.objects.create(user=contador)

        response = self.http.get(
            "/api/trabajos/tablero",
            HTTP_AUTHORIZATION=f"Token {token.key}",
        )

        self.assertEqual(response.status_code, 403)

    def test_checklist_y_transiciones_impiden_saltos_y_cruces_de_tenant(self):
        trabajo = Trabajo.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_1,
            vehiculo=self.vehiculo_1,
            kilometraje=25_000,
            resumen_trabajos="Service guiado",
            proximo_control_km=30_000,
        )
        item = TrabajoItem.objects.create(
            trabajo=trabajo,
            tipo=TrabajoItem.TIPO_MANO_OBRA,
            descripcion="Cambiar aceite",
            cantidad=1,
            precio_unitario=Decimal("50000.00"),
        )
        item_ajeno = TrabajoItem.objects.create(
            trabajo=self.trabajo_2,
            tipo=TrabajoItem.TIPO_REPUESTO,
            descripcion="Repuesto Blue",
            cantidad=1,
            precio_unitario=Decimal("1000.00"),
        )

        salto = self.http.patch(
            f"/api/trabajos/{trabajo.id}/estado",
            data=json.dumps({"estado": "FINALIZADO"}),
            content_type="application/json",
            **self.auth,
        )
        inicio = self.http.patch(
            f"/api/trabajos/{trabajo.id}/estado",
            data=json.dumps({"estado": "EN_PROCESO"}),
            content_type="application/json",
            **self.auth,
        )
        final_incompleto = self.http.patch(
            f"/api/trabajos/{trabajo.id}/estado",
            data=json.dumps({"estado": "FINALIZADO"}),
            content_type="application/json",
            **self.auth,
        )
        cruce = self.http.patch(
            f"/api/trabajos/{trabajo.id}/items/{item_ajeno.id}/completado",
            data=json.dumps({"completado": True}),
            content_type="application/json",
            **self.auth,
        )
        completado = self.http.patch(
            f"/api/trabajos/{trabajo.id}/items/{item.id}/completado",
            data=json.dumps({"completado": True}),
            content_type="application/json",
            **self.auth,
        )
        final = self.http.patch(
            f"/api/trabajos/{trabajo.id}/estado",
            data=json.dumps({"estado": "FINALIZADO"}),
            content_type="application/json",
            **self.auth,
        )

        self.assertEqual(salto.status_code, 400)
        self.assertEqual(inicio.status_code, 200)
        self.assertEqual(final_incompleto.status_code, 400)
        self.assertEqual(cruce.status_code, 404)
        self.assertEqual(completado.status_code, 200)
        self.assertEqual(final.status_code, 200)
        item.refresh_from_db()
        self.assertTrue(item.completado)
        self.assertIsNotNone(item.completado_en)
        trabajo.refresh_from_db()
        self.assertEqual(trabajo.estado, Trabajo.ESTADO_FINALIZADO)
        self.vehiculo_1.refresh_from_db()
        self.assertEqual(self.vehiculo_1.kilometraje_actual, 25_000)
        self.assertEqual(self.vehiculo_1.proximo_service_km, 30_000)


class FinanzasConfiablesTests(TestCase):
    def setUp(self):
        self.http = Client()
        self.owner_1 = User.objects.create_user(
            username="finanzas-uno@example.com",
            email="finanzas-uno@example.com",
            password="clave-segura",
        )
        self.owner_2 = User.objects.create_user(
            username="finanzas-dos@example.com",
            email="finanzas-dos@example.com",
            password="clave-segura",
        )
        self.token_1 = ApiToken.objects.create(user=self.owner_1)
        self.token_2 = ApiToken.objects.create(user=self.owner_2)
        self.auth_1 = {"HTTP_AUTHORIZATION": f"Token {self.token_1.key}"}
        self.auth_2 = {"HTTP_AUTHORIZATION": f"Token {self.token_2.key}"}
        self.cliente_1 = Cliente.objects.create(
            owner=self.owner_1,
            nombre="Cliente",
            apellido="Finanzas Uno",
            saldo_balance=Decimal("1000.00"),
        )

    def test_alta_gasto_valida_categoria_metodo_y_registra_actor(self):
        invalido = self.http.post(
            "/api/compras/",
            data=json.dumps(
                {
                    "tipo": "INVENTADO",
                    "descripcion": "No debe guardarse",
                    "monto": 100,
                    "metodo_pago": "CRIPTOMONEDA",
                }
            ),
            content_type="application/json",
            **self.auth_1,
        )
        valido = self.http.post(
            "/api/compras/",
            data=json.dumps(
                {
                    "tipo": "REPUESTOS",
                    "descripcion": "Filtro de aceite",
                    "monto": 25000,
                    "metodo_pago": "TRANSFERENCIA",
                    "fecha": str(timezone.localdate()),
                    "comprobante": "FC-0001",
                }
            ),
            content_type="application/json",
            **self.auth_1,
        )

        self.assertEqual(invalido.status_code, 400)
        self.assertEqual(valido.status_code, 201)
        self.assertEqual(Gasto.objects.count(), 1)
        gasto = Gasto.objects.get()
        self.assertEqual(gasto.owner, self.owner_1)
        self.assertEqual(gasto.registrado_por, self.owner_1)
        self.assertEqual(gasto.metodo_pago, "TRANSFERENCIA")

    def test_resumenes_financieros_son_completos_y_aislados_por_taller(self):
        hoy = timezone.now()
        Gasto.objects.create(
            owner=self.owner_1,
            fecha=hoy,
            tipo=Gasto.TIPO_INSUMOS,
            metodo_pago="EFECTIVO",
            descripcion="Insumos propios",
            monto=Decimal("300.00"),
        )
        Gasto.objects.create(
            owner=self.owner_2,
            fecha=hoy,
            tipo=Gasto.TIPO_SERVICIOS,
            metodo_pago="EFECTIVO",
            descripcion="Gasto privado del otro taller",
            monto=Decimal("9999.00"),
        )
        MovimientoCuenta.objects.create(
            owner=self.owner_1,
            cliente=self.cliente_1,
            tipo=MovimientoCuenta.TIPO_PAGO,
            monto=Decimal("800.00"),
            metodo_pago="EFECTIVO",
            descripcion="Cobro propio",
        )

        fecha = str(timezone.localdate())
        gastos = self.http.get(
            f"/api/finanzas/gastos?fecha_desde={fecha}&fecha_hasta={fecha}",
            **self.auth_1,
        )
        resumen_gastos = self.http.get(
            f"/api/finanzas/gastos/resumen?fecha_desde={fecha}&fecha_hasta={fecha}",
            **self.auth_1,
        )
        resumen_caja = self.http.get(
            f"/api/finanzas/caja/resumen?fecha_desde={fecha}&fecha_hasta={fecha}",
            **self.auth_1,
        )

        self.assertEqual(gastos.status_code, 200)
        self.assertEqual(len(gastos.json()), 1)
        self.assertEqual(gastos.json()[0]["descripcion"], "Insumos propios")
        self.assertEqual(resumen_gastos.status_code, 200)
        self.assertEqual(resumen_gastos.json()["total_periodo"], 300.0)
        self.assertEqual(resumen_gastos.json()["cantidad_periodo"], 1)
        self.assertEqual(resumen_caja.status_code, 200)
        self.assertEqual(resumen_caja.json()["ingresos"], 800.0)
        self.assertEqual(resumen_caja.json()["egresos"], 300.0)
        self.assertEqual(resumen_caja.json()["resultado"], 500.0)
        self.assertEqual(resumen_caja.json()["cantidad_movimientos"], 2)

    def test_contador_registra_en_taller_sin_convertirse_en_dueno_del_dato(self):
        taller = Taller.objects.create(owner=self.owner_1, nombre="Taller Finanzas")
        MembresiaTaller.objects.get_or_create(
            taller=taller,
            user=self.owner_1,
            defaults={"rol": MembresiaTaller.ROL_ADMIN},
        )
        contador = User.objects.create_user(
            username="contador-finanzas@example.com",
            password="clave-segura",
        )
        MembresiaTaller.objects.create(
            taller=taller,
            user=contador,
            rol=MembresiaTaller.ROL_CONTADOR,
        )
        token_contador = ApiToken.objects.create(user=contador)

        response = self.http.post(
            "/api/compras/",
            data=json.dumps(
                {
                    "tipo": "SERVICIOS",
                    "descripcion": "Internet del taller",
                    "monto": 5000,
                    "metodo_pago": "TRANSFERENCIA",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Token {token_contador.key}",
        )

        self.assertEqual(response.status_code, 201)
        gasto = Gasto.objects.get(descripcion="Internet del taller")
        self.assertEqual(gasto.owner, self.owner_1)
        self.assertEqual(gasto.registrado_por, contador)


class AccesoVigenteTests(TestCase):
    """El corte de trial/plan pago tiene que vivir en el backend: la UI se
    puede saltear apuntando directo a la API."""

    def setUp(self):
        self.http = Client()
        self.owner = User.objects.create_user(
            username="owner-trial@example.com",
            email="owner-trial@example.com",
            password="clave-segura",
        )
        self.token = ApiToken.objects.create(user=self.owner)
        self.auth = {"HTTP_AUTHORIZATION": f"Token {self.token.key}"}
        PerfilTaller.objects.get_or_create(
            user=self.owner,
            defaults={"nombre": "Owner", "taller_nombre": "Taller Trial"},
        )

    def test_trial_vigente_permite_acceso(self):
        response = self.http.get("/api/clientes", **self.auth)
        self.assertEqual(response.status_code, 200)


    def test_trial_vencido_sin_plan_bloquea_con_402(self):
        perfil = PerfilTaller.objects.get(user=self.owner)
        perfil.trial_start = timezone.now() - timedelta(days=8)
        perfil.save(update_fields=["trial_start"])

        response = self.http.get("/api/clientes", **self.auth)

        self.assertEqual(response.status_code, 402)

    def test_trial_vencido_con_plan_activo_permite_acceso(self):
        perfil = PerfilTaller.objects.get(user=self.owner)
        perfil.trial_start = timezone.now() - timedelta(days=8)
        perfil.plan_activo_hasta = timezone.now() + timedelta(days=20)
        perfil.save(update_fields=["trial_start", "plan_activo_hasta"])

        response = self.http.get("/api/clientes", **self.auth)

        self.assertEqual(response.status_code, 200)

    def test_plan_vencido_vuelve_a_bloquear(self):
        perfil = PerfilTaller.objects.get(user=self.owner)
        perfil.trial_start = timezone.now() - timedelta(days=40)
        perfil.plan_activo_hasta = timezone.now() - timedelta(days=1)
        perfil.save(update_fields=["trial_start", "plan_activo_hasta"])

        response = self.http.get("/api/clientes", **self.auth)

        self.assertEqual(response.status_code, 402)

    def test_superusuario_nunca_queda_bloqueado(self):
        admin = User.objects.create_superuser(
            username="soporte@example.com",
            email="soporte@example.com",
            password="clave-segura",
        )
        token_admin = ApiToken.objects.create(user=admin)
        perfil, _ = PerfilTaller.objects.get_or_create(
            user=admin,
            defaults={"nombre": "Soporte", "taller_nombre": "Soporte"},
        )
        perfil.trial_start = timezone.now() - timedelta(days=999)
        perfil.save(update_fields=["trial_start"])

        response = self.http.get(
            "/api/clientes", HTTP_AUTHORIZATION=f"Token {token_admin.key}"
        )

        self.assertEqual(response.status_code, 200)


class CentroCeoTests(TestCase):
    """El control comercial global nunca puede quedar expuesto a un taller."""

    def setUp(self):
        self.http = Client()
        self.owner = User.objects.create_user(
            username="dueno-ceo@example.com",
            email="dueno-ceo@example.com",
            password="clave-segura",
        )
        self.perfil = PerfilTaller.objects.create(
            user=self.owner,
            nombre="Dueño CEO",
            taller_nombre="Taller para Control",
            taller_ciudad="Córdoba",
            taller_tel="3510000000",
        )
        Taller.objects.create(owner=self.owner, nombre=self.perfil.taller_nombre)
        self.owner_token = ApiToken.objects.create(user=self.owner)

        self.ceo = User.objects.create_superuser(
            username="soporte-ceo@example.com",
            email="soporte-ceo@example.com",
            password="clave-super-segura",
        )
        self.ceo_token = ApiToken.objects.create(user=self.ceo)
        self.ceo_auth = {"HTTP_AUTHORIZATION": f"Token {self.ceo_token.key}"}

    def test_taller_normal_no_puede_ver_resumen_global(self):
        response = self.http.get(
            "/api/ceo/resumen/",
            HTTP_AUTHORIZATION=f"Token {self.owner_token.key}",
        )
        self.assertEqual(response.status_code, 403)

    def test_sesion_devuelve_estado_comercial_sin_exponer_token(self):
        response = self.http.get(
            "/api/auth/sesion/",
            HTTP_AUTHORIZATION=f"Token {self.owner_token.key}",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["taller_nombre"], self.perfil.taller_nombre)
        self.assertFalse(payload["es_superusuario"])
        self.assertNotIn("token", payload)

    def test_superusuario_ve_talleres_y_activa_plan(self):
        response = self.http.get("/api/ceo/resumen/", **self.ceo_auth)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["total_talleres"], 2)
        taller_cliente = next(t for t in payload["talleres"] if t["id"] == self.perfil.id)
        self.assertEqual(taller_cliente["estado_acceso"], "PRUEBA_VIGENTE")
        self.assertTrue(any(t["es_superusuario"] for t in payload["talleres"]))

        activar = self.http.patch(
            f"/api/ceo/talleres/{self.perfil.id}/plan/",
            data=json.dumps({"accion": "ACTIVAR_30_DIAS"}),
            content_type="application/json",
            **self.ceo_auth,
        )
        self.assertEqual(activar.status_code, 200)
        self.perfil.refresh_from_db()
        self.assertIsNotNone(self.perfil.plan_activo_hasta)
        self.assertTrue(self.perfil.plan_vigente)
        self.assertEqual(activar.json()["estado_acceso"], "PLAN_ACTIVO")

    def test_ceo_genera_enlace_de_un_solo_uso_y_revoca_sesiones(self):
        response = self.http.post(
            f"/api/ceo/talleres/{self.perfil.id}/enlace-recuperacion/",
            **self.ceo_auth,
        )
        self.assertEqual(response.status_code, 200)
        path = response.json()["path"]
        _, _, recuperacion_id, token = path.split("/")

        restablecer = self.http.post(
            f"/api/public/recuperacion/{recuperacion_id}/{token}/",
            data=json.dumps({"password": "ClaveNueva2026"}),
            content_type="application/json",
        )
        self.assertEqual(restablecer.status_code, 200)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password("ClaveNueva2026"))
        self.assertFalse(ApiToken.objects.filter(user=self.owner).exists())

        reutilizar = self.http.post(
            f"/api/public/recuperacion/{recuperacion_id}/{token}/",
            data=json.dumps({"password": "OtraClave2026"}),
            content_type="application/json",
        )
        self.assertEqual(reutilizar.status_code, 400)


class HistorialVehiculoTests(TestCase):
    def setUp(self):
        self.http = Client()
        self.owner = User.objects.create_user(username="historial@example.com", password="clave-segura")
        PerfilTaller.objects.create(user=self.owner, nombre="Historial", taller_nombre="Taller Historial")
        self.token = ApiToken.objects.create(user=self.owner)
        self.cliente = Cliente.objects.create(owner=self.owner, nombre="Cliente Historial")
        self.vehiculo = Vehiculo.objects.create(
            owner=self.owner,
            cliente=self.cliente,
            patente="HIS123",
            marca="Ford",
            modelo="Fiesta",
            kilometraje_actual=68000,
        )
        self.trabajo = Trabajo.objects.create(
            owner=self.owner,
            cliente=self.cliente,
            vehiculo=self.vehiculo,
            kilometraje=67500,
            resumen_trabajos="Cambio de aceite y filtros",
        )
        self.auth = {"HTTP_AUTHORIZATION": f"Token {self.token.key}"}

    def test_historial_lista_solo_las_operaciones_del_vehiculo_propio(self):
        response = self.http.get(f"/api/vehiculos/{self.vehiculo.id}/historial/", **self.auth)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["vehiculo"]["id"], self.vehiculo.id)
        self.assertEqual(payload["trabajos"][0]["id"], self.trabajo.id)
        self.assertEqual(payload["trabajos"][0]["resumen"], "Cambio de aceite y filtros")

    def test_historial_no_expone_vehiculo_de_otro_taller(self):
        other = User.objects.create_user(username="otro-historial@example.com", password="clave-segura")
        other_cliente = Cliente.objects.create(owner=other, nombre="Otro Cliente")
        other_vehiculo = Vehiculo.objects.create(owner=other, cliente=other_cliente, patente="OTH123", marca="Fiat", modelo="Uno")
        response = self.http.get(f"/api/vehiculos/{other_vehiculo.id}/historial/", **self.auth)
        self.assertEqual(response.status_code, 404)
