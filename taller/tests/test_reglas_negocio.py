"""Reglas de negocio que se rompieron al mezclar la app original con la API nueva."""
import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import Client, TestCase
from django.utils import timezone

from taller.models import ApiToken, Cliente, Gasto, MembresiaTaller, MovimientoCuenta, PerfilTaller, Taller, Presupuesto, Trabajo, TrabajoItem, Vehiculo
from taller.services import obtener_dashboard_snapshot


class DescuentoTests(TestCase):
    """Un descuento mayor al subtotal dejaba órdenes y presupuestos en negativo."""

    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="desc@example.com", password="clave-desc")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}
        self.cliente = Cliente.objects.create(owner=self.owner, nombre="Ana")
        self.vehiculo = Vehiculo.objects.create(
            owner=self.owner, cliente=self.cliente, patente="AAA111", marca="Ford", modelo="Ka",
        )

    def _orden(self, descuento, precio=10_000):
        return {
            "cliente_id": self.cliente.id,
            "vehiculo_id": self.vehiculo.id,
            "kilometraje": 1000,
            "estado": "INGRESADO",
            "resumen_trabajos": "Service",
            "descuento": descuento,
            "items": [{"tipo": "MANO_OBRA", "descripcion": "Mano de obra", "cantidad": 1, "precio_unitario": precio}],
        }

    def _presupuesto(self, descuento):
        return {
            "cliente_id": self.cliente.id,
            "vehiculo_id": self.vehiculo.id,
            "descuento": descuento,
            "items": [{"tipo": "REPUESTO", "descripcion": "Filtro", "cantidad": 1, "precio_unitario": 10_000}],
        }

    def _post(self, url, data):
        return self.http.post(url, data=json.dumps(data), content_type="application/json", **self.auth)

    def _put(self, url, data):
        return self.http.put(url, data=json.dumps(data), content_type="application/json", **self.auth)

    def test_crear_orden_con_descuento_mayor_al_subtotal_se_rechaza(self):
        response = self._post("/api/trabajos/", self._orden(descuento=50_000))

        self.assertEqual(response.status_code, 400)
        self.assertIn("no puede superar el subtotal", response.json()["message"])
        self.assertFalse(Trabajo.objects.filter(owner=self.owner).exists())

    def test_descuento_igual_al_subtotal_deja_la_orden_en_cero(self):
        response = self._post("/api/trabajos/", self._orden(descuento=10_000))

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Trabajo.objects.get(owner=self.owner).total, Decimal("0.00"))

    def test_editar_orden_con_descuento_invalido_no_borra_los_items(self):
        creada = self._post("/api/trabajos/", self._orden(descuento=1_000)).json()

        response = self._put(f"/api/trabajos/{creada['id']}", self._orden(descuento=99_000))

        self.assertEqual(response.status_code, 400)
        trabajo = Trabajo.objects.get(pk=creada["id"])
        self.assertEqual(trabajo.total, Decimal("9000.00"))
        self.assertEqual(trabajo.descuento, Decimal("1000.00"))
        self.assertEqual(TrabajoItem.objects.filter(trabajo=trabajo).count(), 1)

    def test_presupuesto_con_descuento_mayor_al_subtotal_se_rechaza(self):
        response = self._post("/api/presupuestos/", self._presupuesto(descuento=50_000))

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Presupuesto.objects.filter(owner=self.owner).exists())

    def test_editar_presupuesto_con_descuento_invalido_lo_deja_como_estaba(self):
        creado = self._post("/api/presupuestos/", self._presupuesto(descuento=500)).json()

        response = self._put(f"/api/presupuestos/{creado['id']}", self._presupuesto(descuento=50_000))

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Presupuesto.objects.get(pk=creado["id"]).total, Decimal("9500.00"))


class ClientesParaRecuperarTests(TestCase):
    """El panel sugería recontactar a clientes que tenían el auto en el taller."""

    def setUp(self):
        self.owner = User.objects.create_user(username="recu@example.com", password="clave-recu")

    def _cliente_con_orden(self, nombre, estado=None, dias_atras=0):
        cliente = Cliente.objects.create(owner=self.owner, nombre=nombre)
        if estado:
            vehiculo = Vehiculo.objects.create(
                owner=self.owner, cliente=cliente, patente=nombre[:3].upper() + "123", marca="Ford", modelo="Ka",
            )
            Trabajo.objects.create(
                owner=self.owner, cliente=cliente, vehiculo=vehiculo, kilometraje=1000,
                resumen_trabajos="x", estado=estado,
                fecha_ingreso=timezone.now() - timedelta(days=dias_atras),
            )
        return cliente

    def _para_recuperar(self):
        snapshot = obtener_dashboard_snapshot(user=self.owner)
        return {c["nombre"] for c in snapshot["clientes_sin_actividad"]}

    def test_cliente_con_el_auto_en_el_taller_no_es_para_recuperar(self):
        self._cliente_con_orden("Enproceso", Trabajo.ESTADO_EN_PROCESO, dias_atras=3)
        self._cliente_con_orden("Ingresado", Trabajo.ESTADO_INGRESADO, dias_atras=0)

        self.assertEqual(self._para_recuperar(), set())

    def test_cliente_que_no_vuelve_hace_mas_de_seis_meses_si_es_para_recuperar(self):
        self._cliente_con_orden("Viejo", Trabajo.ESTADO_ENTREGADO, dias_atras=200)
        self._cliente_con_orden("Reciente", Trabajo.ESTADO_ENTREGADO, dias_atras=30)

        self.assertEqual(self._para_recuperar(), {"Viejo"})

    def test_una_orden_anulada_no_cuenta_como_visita(self):
        self._cliente_con_orden("Anulado", Trabajo.ESTADO_ANULADO, dias_atras=2)
        self._cliente_con_orden("Nunca")

        self.assertEqual(self._para_recuperar(), {"Anulado", "Nunca"})


class RenovacionPortalTests(TestCase):
    """Los links públicos vencían y la app los seguía compartiendo: el cliente veía un 404."""

    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="portal@example.com", password="clave-portal")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}
        self.cliente = Cliente.objects.create(owner=self.owner, nombre="Ana")
        self.vehiculo = Vehiculo.objects.create(
            owner=self.owner, cliente=self.cliente, patente="AAA111", marca="Ford", modelo="Ka",
            portal_expires_at=timezone.now() - timedelta(days=1),
        )

    def _publico(self):
        return self.http.get(f"/api/public/vehiculos/{self.vehiculo.token}/")

    def test_compartir_renueva_un_link_vencido_sin_cambiar_el_token(self):
        token_original = self.vehiculo.token
        self.assertEqual(self._publico().status_code, 404)

        response = self.http.post(f"/api/vehiculos/{self.vehiculo.id}/portal/renovar", **self.auth)

        self.assertEqual(response.status_code, 200)
        self.vehiculo.refresh_from_db()
        self.assertEqual(self.vehiculo.token, token_original)
        self.assertGreater(self.vehiculo.portal_expires_at, timezone.now() + timedelta(days=89))
        self.assertEqual(self._publico().status_code, 200)

    def test_un_link_desactivado_por_un_admin_no_se_reactiva_al_compartir(self):
        self.vehiculo.portal_activo = False
        self.vehiculo.save(update_fields=["portal_activo"])

        response = self.http.post(f"/api/vehiculos/{self.vehiculo.id}/portal/renovar", **self.auth)

        self.assertEqual(response.status_code, 409)
        self.vehiculo.refresh_from_db()
        self.assertFalse(self.vehiculo.portal_activo)

    def test_no_se_puede_renovar_el_link_de_otro_taller(self):
        otro = User.objects.create_user(username="ajeno@example.com", password="x")
        otro_auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=otro).key}"}

        response = self.http.post(f"/api/vehiculos/{self.vehiculo.id}/portal/renovar", **otro_auth)

        self.assertEqual(response.status_code, 404)

    def test_presupuesto_vencido_se_renueva_al_compartir(self):
        presupuesto = Presupuesto.objects.create(
            owner=self.owner, cliente=self.cliente, vehiculo=self.vehiculo, estado="ENVIADO",
            portal_expires_at=timezone.now() - timedelta(days=1),
        )
        publico = f"/api/public/presupuestos/{presupuesto.token}/"
        self.assertEqual(self.http.get(publico).status_code, 404)

        response = self.http.post(f"/api/presupuestos/{presupuesto.id}/portal/renovar", **self.auth)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.http.get(publico).status_code, 200)

    def test_el_vehiculo_informa_si_su_link_esta_activo_y_cuando_vence(self):
        datos = self.http.get(f"/api/vehiculos/{self.vehiculo.id}", **self.auth).json()

        self.assertIn("portal_activo", datos)
        self.assertIn("portal_expires_at", datos)


class ResumenPorDefectoTests(TestCase):
    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="resumen@example.com", password="x")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}
        self.cliente = Cliente.objects.create(owner=self.owner, nombre="Ana")
        self.vehiculo = Vehiculo.objects.create(owner=self.owner, cliente=self.cliente, patente="RES111", marca="Ford", modelo="Ka")

    def test_sin_diagnostico_el_resumen_sale_de_los_items(self):
        response = self.http.post("/api/trabajos/", data=json.dumps({
            "cliente_id": self.cliente.id, "vehiculo_id": self.vehiculo.id, "kilometraje": 1000, "estado": "INGRESADO",
            "resumen_trabajos": "  ",
            "items": [
                {"tipo": "MANO_OBRA", "descripcion": "Cambio de aceite", "cantidad": 1, "precio_unitario": 100},
                {"tipo": "REPUESTO", "descripcion": "Filtro de aire", "cantidad": 1, "precio_unitario": 50},
            ],
        }), content_type="application/json", **self.auth)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Trabajo.objects.get(owner=self.owner).resumen_trabajos, "Cambio de aceite · Filtro de aire")


class TableroEtapaTests(TestCase):
    """El tablero muestra los días en la etapa actual, no desde el ingreso."""

    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="tablero@example.com", password="clave-tablero")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}
        cliente = Cliente.objects.create(owner=self.owner, nombre="Ana", telefono="342-5550000")
        vehiculo = Vehiculo.objects.create(owner=self.owner, cliente=cliente, patente="TAB111", marca="Fiat", modelo="Uno")
        ahora = timezone.now()
        self.trabajo = Trabajo.objects.create(
            owner=self.owner, cliente=cliente, vehiculo=vehiculo, kilometraje=1000,
            estado=Trabajo.ESTADO_EN_PROCESO, fecha_ingreso=ahora - timedelta(days=20),
            iniciado_en=ahora - timedelta(days=3),
        )
        TrabajoItem.objects.create(trabajo=self.trabajo, tipo="MANO_OBRA", descripcion="Cambio de aceite", cantidad=1, precio_unitario=1000)

    def test_dias_en_etapa_y_tareas(self):
        data = self.http.get("/api/trabajos/tablero", **self.auth).json()
        tarjeta = data["EN_PROCESO"]["trabajos"][0]

        self.assertEqual(tarjeta["dias_en_taller"], 20)
        self.assertEqual(tarjeta["dias_en_etapa"], 3)
        self.assertEqual(tarjeta["cliente_telefono"], "342-5550000")
        self.assertEqual([i["descripcion"] for i in tarjeta["items"]], ["Cambio de aceite"])

    def test_sin_marca_de_etapa_usa_el_ingreso(self):
        Trabajo.objects.filter(pk=self.trabajo.pk).update(iniciado_en=None)
        tarjeta = self.http.get("/api/trabajos/tablero", **self.auth).json()["EN_PROCESO"]["trabajos"][0]
        self.assertEqual(tarjeta["dias_en_etapa"], 20)


class ItemRapidoTrabajoTests(TestCase):
    """Lo que se hizo de más se suma a la orden sin pasar por la edición completa."""

    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="rapido@example.com", password="clave-rapido")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}
        cliente = Cliente.objects.create(owner=self.owner, nombre="Ana")
        vehiculo = Vehiculo.objects.create(owner=self.owner, cliente=cliente, patente="RAP111", marca="Fiat", modelo="Uno")
        self.trabajo = Trabajo.objects.create(
            owner=self.owner, cliente=cliente, vehiculo=vehiculo, kilometraje=1000,
            estado=Trabajo.ESTADO_EN_PROCESO, total_mano_obra=1000, total=1000,
        )
        self.item = TrabajoItem.objects.create(trabajo=self.trabajo, tipo="MANO_OBRA", descripcion="Cambio de aceite", cantidad=1, precio_unitario=1000)

    def _post(self, data):
        return self.http.post(f"/api/trabajos/{self.trabajo.id}/items", data=json.dumps(data), content_type="application/json", **self.auth)

    def test_agrega_item_tildado_y_recalcula_total(self):
        r = self._post({"descripcion": "Soldadura de escape", "precio_unitario": 15000})
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.json()["completado"])
        self.trabajo.refresh_from_db()
        self.assertEqual(self.trabajo.total_mano_obra, Decimal("16000"))
        self.assertEqual(self.trabajo.total, Decimal("16000"))

    def test_sin_precio_se_puede_poner_despues(self):
        item_id = self._post({"descripcion": "Abrazadera", "tipo": "REPUESTO"}).json()["id"]
        r = self.http.patch(f"/api/trabajos/{self.trabajo.id}/items/{item_id}", data=json.dumps({"precio_unitario": 3000}), content_type="application/json", **self.auth)
        self.assertEqual(r.status_code, 200)
        self.trabajo.refresh_from_db()
        self.assertEqual(self.trabajo.total_repuestos, Decimal("3000"))
        self.assertEqual(self.trabajo.total, Decimal("4000"))

    def test_orden_entregada_no_admite_items(self):
        Trabajo.objects.filter(pk=self.trabajo.pk).update(estado=Trabajo.ESTADO_ENTREGADO)
        self.assertEqual(self._post({"descripcion": "Algo más"}).status_code, 400)

    def test_editar_la_orden_no_destilda_lo_hecho(self):
        TrabajoItem.objects.filter(pk=self.item.pk).update(completado=True, completado_en=timezone.now())
        payload = {
            "cliente_id": self.trabajo.cliente_id, "vehiculo_id": self.trabajo.vehiculo_id, "kilometraje": 1000,
            "resumen_trabajos": "Service", "observaciones_cliente": "", "observaciones_internas": "",
            "estado_general": "BUENO", "estado_cubiertas_trabajo": "", "recomendaciones_proximo_service": "",
            "descuento": 0,
            "items": [
                {"tipo": "MANO_OBRA", "descripcion": "Cambio de aceite", "cantidad": 1, "precio_unitario": 1200},
                {"tipo": "REPUESTO", "descripcion": "Filtro", "cantidad": 1, "precio_unitario": 500},
            ],
        }
        r = self.http.put(f"/api/trabajos/{self.trabajo.id}", data=json.dumps(payload), content_type="application/json", **self.auth)
        self.assertEqual(r.status_code, 200, r.content)
        estados = {i.descripcion: i.completado for i in self.trabajo.items.all()}
        self.assertEqual(estados, {"Cambio de aceite": True, "Filtro": False})


class FiltrosCajaTests(TestCase):
    """La caja se puede buscar por cliente, concepto o importe y filtrar por tipo."""

    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="caja@example.com", password="clave-caja")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}
        self.diego = Cliente.objects.create(owner=self.owner, nombre="Diego", apellido="Sosa")
        ana = Cliente.objects.create(owner=self.owner, nombre="Ana", apellido="Paz")
        MovimientoCuenta.objects.create(owner=self.owner, cliente=self.diego, tipo="PAGO", monto=128000, metodo_pago="EFECTIVO", descripcion="Abono")
        MovimientoCuenta.objects.create(owner=self.owner, cliente=ana, tipo="PAGO", monto=5000, metodo_pago="TRANSFERENCIA")
        Gasto.objects.create(owner=self.owner, descripcion="Aceite 20L", monto=85000, metodo_pago="EFECTIVO")

    def _get(self, url):
        return self.http.get(url, **self.auth).json()

    def test_busca_por_nombre_y_apellido(self):
        data = self._get("/api/finanzas/caja?q=diego%20sosa")
        self.assertEqual([m["cliente_nombre"] for m in data], ["Diego Sosa"])

    def test_busca_por_importe(self):
        data = self._get("/api/finanzas/caja?q=128.000")
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["monto"], 128000)

    def test_filtra_por_cliente_y_tipo(self):
        self.assertEqual(len(self._get(f"/api/finanzas/caja?cliente_id={self.diego.id}")), 1)
        egresos = self._get("/api/finanzas/caja?tipo=EGRESO")
        self.assertEqual([m["detalle"] for m in egresos], ["Aceite 20L"])

    def test_resumen_respeta_filtros_y_separa_por_medio(self):
        r = self._get("/api/finanzas/caja/resumen")
        self.assertEqual(r["ingresos"], 133000)
        self.assertEqual(r["egresos"], 85000)
        medios = {m["metodo"]: m for m in r["por_medio"]}
        self.assertEqual(medios["EFECTIVO"]["ingresos"], 128000)
        self.assertEqual(medios["EFECTIVO"]["egresos"], 85000)
        self.assertEqual(self._get("/api/finanzas/caja/resumen?q=aceite")["egresos"], 85000)


class GastosTests(TestCase):
    """Gastos: el total sigue los filtros y un gasto mal cargado se puede borrar."""

    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="gastos@example.com", password="clave-gastos")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}
        self.aceite = Gasto.objects.create(owner=self.owner, descripcion="Aceite 20L", monto=85000, tipo="INSUMOS")
        Gasto.objects.create(owner=self.owner, descripcion="Luz del taller", monto=120000, tipo="SERVICIOS")

    def test_resumen_sigue_la_busqueda_pero_muestra_todas_las_categorias(self):
        r = self.http.get("/api/finanzas/gastos/resumen?buscar=aceite&tipo=INSUMOS", **self.auth).json()
        self.assertEqual(r["total_periodo"], 85000)
        self.assertEqual({t["tipo"] for t in r["por_tipo"]}, {"INSUMOS"})
        todas = self.http.get("/api/finanzas/gastos/resumen?tipo=INSUMOS", **self.auth).json()
        self.assertEqual({t["tipo"] for t in todas["por_tipo"]}, {"INSUMOS", "SERVICIOS"})

    def test_busca_por_importe(self):
        data = self.http.get("/api/finanzas/gastos?buscar=120.000", **self.auth).json()
        self.assertEqual([g["descripcion"] for g in data], ["Luz del taller"])

    def test_eliminar_gasto_propio(self):
        r = self.http.delete(f"/api/finanzas/gastos/{self.aceite.id}", **self.auth)
        self.assertEqual(r.status_code, 200)
        self.assertFalse(Gasto.objects.filter(pk=self.aceite.pk).exists())

    def test_compra_con_varias_lineas(self):
        payload = {
            "metodo_pago": "TRANSFERENCIA", "comprobante": "FC 0001-45",
            "lineas": [
                {"tipo": "REPUESTOS", "descripcion": "Pastillas", "monto": 30000},
                {"tipo": "REPUESTOS", "descripcion": "Discos", "monto": 70000},
                {"tipo": "INSUMOS", "descripcion": "Líquido de frenos", "monto": 8000},
            ],
        }
        r = self.http.post("/api/compras/lote", data=json.dumps(payload), content_type="application/json", **self.auth)
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["total"], 108000)
        cargados = Gasto.objects.filter(owner=self.owner, comprobante="FC 0001-45")
        self.assertEqual(cargados.count(), 3)
        self.assertEqual({g.metodo_pago for g in cargados}, {"TRANSFERENCIA"})

    def test_compra_con_una_linea_mal_no_guarda_nada(self):
        payload = {"lineas": [{"tipo": "REPUESTOS", "descripcion": "Pastillas", "monto": 30000}, {"tipo": "REPUESTOS", "descripcion": "", "monto": 10}]}
        r = self.http.post("/api/compras/lote", data=json.dumps(payload), content_type="application/json", **self.auth)
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Gasto.objects.filter(descripcion="Pastillas").exists())

    def test_no_borra_gastos_de_otro_taller(self):
        otro = User.objects.create_user(username="otro@example.com", password="x")
        ajeno = Gasto.objects.create(owner=otro, descripcion="Ajeno", monto=1)
        r = self.http.delete(f"/api/finanzas/gastos/{ajeno.id}", **self.auth)
        self.assertEqual(r.status_code, 404)


class DatosFiscalesYContadorTests(TestCase):
    """Datos fiscales del taller y planilla para el contador."""

    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="fiscal@example.com", password="clave-fiscal")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}
        PerfilTaller.objects.create(user=self.owner, nombre="Franco", taller_nombre="Taller Uno")

    def _put(self, **extra):
        data = {"nombre": "Franco", "taller_nombre": "Taller Uno", **extra}
        return self.http.put("/api/perfil/", data=json.dumps(data), content_type="application/json", **self.auth)

    def test_cuit_valido_se_guarda_con_guiones(self):
        r = self._put(taller_cuit="20123456786", condicion_iva="RESPONSABLE_INSCRIPTO", razon_social="Uno SRL")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["taller_cuit"], "20-12345678-6")
        self.assertEqual(r.json()["condicion_iva"], "RESPONSABLE_INSCRIPTO")

    def test_cuit_con_digito_mal_se_rechaza(self):
        r = self._put(taller_cuit="20-12345678-9")
        self.assertEqual(r.status_code, 400)
        self.assertIn("CUIT", r.json()["detail"])

    def test_no_mandar_campos_fiscales_no_los_borra(self):
        self._put(razon_social="Uno SRL")
        self._put()  # cliente viejo que no conoce los campos nuevos
        self.assertEqual(PerfilTaller.objects.get(user=self.owner).razon_social, "Uno SRL")

    def test_planilla_para_el_contador(self):
        import io
        import zipfile
        from xml.etree import ElementTree

        self._put(taller_cuit="20123456786", condicion_iva="RESPONSABLE_INSCRIPTO")
        cliente = Cliente.objects.create(owner=self.owner, nombre="Ana", apellido="Paz", dni="27-11111111-1")
        vehiculo = Vehiculo.objects.create(owner=self.owner, cliente=cliente, patente="CON111", marca="Fiat", modelo="Uno")
        Trabajo.objects.create(
            owner=self.owner, cliente=cliente, vehiculo=vehiculo, kilometraje=1, estado=Trabajo.ESTADO_ENTREGADO,
            total=121000, total_mano_obra=121000, fecha_egreso_real=timezone.now(), resumen_trabajos="Service",
        )
        Gasto.objects.create(owner=self.owner, descripcion="Aceite", monto=5000, comprobante="FC 1")
        hoy = timezone.localdate().isoformat()
        r = self.http.get(f"/api/finanzas/exportar-contador?fecha_desde={hoy}&fecha_hasta={hoy}", **self.auth)
        self.assertEqual(r.status_code, 200)
        self.assertIn("spreadsheetml", r["Content-Type"])
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            partes = z.namelist()
            self.assertIn("xl/worksheets/sheet4.xml", partes)
            for parte in partes:
                if parte.endswith(".xml") or parte.endswith(".rels"):
                    ElementTree.fromstring(z.read(parte))  # XML bien formado
            ventas = z.read("xl/worksheets/sheet2.xml").decode()
        self.assertIn("Paz", ventas)
        self.assertIn("IVA 21%", ventas)
        self.assertIn("<v>100000.00</v>", ventas)  # neto de 121.000

    def test_iva_discriminado_es_opcional(self):
        self.assertFalse(self.http.get("/api/perfil/", **self.auth).json()["mostrar_iva"])
        self.assertTrue(self._put(mostrar_iva=True).json()["mostrar_iva"])
        self.assertTrue(self._put().json()["mostrar_iva"])  # no mandarlo no lo apaga

    def test_planilla_requiere_rango_coherente(self):
        r = self.http.get("/api/finanzas/exportar-contador?fecha_desde=2026-02-01&fecha_hasta=2026-01-01", **self.auth)
        self.assertEqual(r.status_code, 400)


class EquipoSinEmailTests(TestCase):
    """El dueño crea los accesos de su equipo con usuario y contraseña, sin email."""

    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="duenio@example.com", password="clave-duenio")
        self.taller = Taller.objects.create(owner=self.owner, nombre="Taller San Martín")
        MembresiaTaller.objects.create(taller=self.taller, user=self.owner, rol="ADMIN")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}

    def _crear(self, **datos):
        payload = {"nombre": "Juan Pérez", "password": "clave-juan-123", "rol": "MECANICO", **datos}
        return self.http.post("/api/equipo/", data=json.dumps(payload), content_type="application/json", **self.auth)

    def test_sugiere_usuario_con_el_taller(self):
        r = self.http.get("/api/equipo/sugerir-usuario?nombre=Juan%20P%C3%A9rez", **self.auth)
        self.assertEqual(r.json()["usuario"], "juan.sanmartin")

    def test_crea_usuario_sin_email_y_puede_entrar(self):
        r = self._crear(usuario="juan.sanmartin")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["usuario"], "juan.sanmartin")
        login = self.http.post("/api/auth/login/", data=json.dumps({"email": "juan.sanmartin", "password": "clave-juan-123"}), content_type="application/json")
        self.assertEqual(login.status_code, 200, login.content)

    def test_usuario_repetido_o_invalido(self):
        self._crear(usuario="juan.sanmartin")
        self.assertEqual(self._crear(usuario="juan.sanmartin").status_code, 400)
        self.assertEqual(self._crear(usuario="con espacios").status_code, 400)

    def test_dueno_resetea_la_clave_y_cierra_sesiones(self):
        miembro_id = self._crear(usuario="juan.sanmartin").json()["id"]
        juan = User.objects.get(username="juan.sanmartin")
        ApiToken.objects.create(user=juan)
        r = self.http.patch(f"/api/equipo/{miembro_id}", data=json.dumps({"password": "otra-clave-456"}), content_type="application/json", **self.auth)
        self.assertEqual(r.status_code, 200, r.content)
        juan.refresh_from_db()
        self.assertTrue(juan.check_password("otra-clave-456"))
        self.assertFalse(ApiToken.objects.filter(user=juan).exists())

    def test_el_dueno_no_pierde_admin(self):
        duenio = MembresiaTaller.objects.get(user=self.owner)
        r = self.http.patch(f"/api/equipo/{duenio.id}", data=json.dumps({"rol": "MECANICO"}), content_type="application/json", **self.auth)
        self.assertEqual(r.status_code, 400)


class HistorialVehiculoTests(TestCase):
    """El historial del vehículo trae lo que se le hizo, no sólo el número de orden."""

    def setUp(self):
        cache.clear()
        self.http = Client()
        self.owner = User.objects.create_user(username="historial@example.com", password="clave-historial")
        self.auth = {"HTTP_AUTHORIZATION": f"Token {ApiToken.objects.create(user=self.owner).key}"}
        cliente = Cliente.objects.create(owner=self.owner, nombre="Ana")
        self.vehiculo = Vehiculo.objects.create(owner=self.owner, cliente=cliente, patente="HIS111", marca="Fiat", modelo="Uno")
        trabajo = Trabajo.objects.create(
            owner=self.owner, cliente=cliente, vehiculo=self.vehiculo, kilometraje=50_000,
            estado=Trabajo.ESTADO_ENTREGADO, finalizado_en=timezone.now(),
            recomendaciones_proximo_service="Cambiar pastillas", proximo_control_km=60_000,
        )
        TrabajoItem.objects.create(trabajo=trabajo, tipo="REPUESTO", descripcion="Filtro de aceite", cantidad=1, precio_unitario=5000, completado=True)

    def test_historial_incluye_tareas_y_recomendacion(self):
        data = self.http.get(f"/api/vehiculos/{self.vehiculo.id}/historial/", **self.auth).json()
        orden = data["trabajos"][0]

        self.assertEqual(orden["items"][0]["descripcion"], "Filtro de aceite")
        self.assertEqual(orden["items"][0]["tipo"], "REPUESTO")
        self.assertIsNotNone(orden["fecha_realizado"])
        self.assertEqual(orden["recomendaciones_proximo_service"], "Cambiar pastillas")
        self.assertEqual(orden["proximo_control_km"], 60_000)
