# taller/services.py
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, Sum, F
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import Cliente, MovimientoCuenta, Trabajo, TrabajoItem, Turno, Vehiculo

MONTH_LABELS = (
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
)

# ==========================================
# UTILIDADES DE FECHA
# ==========================================

def _month_floor(value: datetime) -> datetime:
    return value.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

def _add_months(value: datetime, months: int) -> datetime:
    month_index = (value.month - 1) + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return value.replace(year=year, month=month)


def resolver_vehiculo_express_para_usuario(
    *,
    cliente: Cliente,
    patente_raw: str,
    marca_modelo: str = "",
    user=None,
) -> Vehiculo:
    """
    Resuelve la patente dentro del scope del taller actual.

    Regla de negocio:
    1. La patente es única por taller, no global.
    2. Si la patente ya existe en el taller actual, solo se acepta para el mismo cliente.
    3. Si la patente existe en otro taller, se permite un nuevo registro independiente.
    """
    patente = "".join(str(patente_raw or "").split()).upper()
    marca_modelo = str(marca_modelo or "").strip() or "S/D"

    if not patente:
        raise ValidationError("La patente del vehículo es obligatoria en el Alta Express.")

    if user is not None:
        vehiculo_mismo_taller = (
            Vehiculo.objects.select_related("cliente")
            .filter(patente=patente, owner=user)
            .first()
        )
        if vehiculo_mismo_taller:
            if vehiculo_mismo_taller.cliente_id != cliente.id:
                raise ValidationError(
                    f"La patente {patente} ya está registrada en tu taller a nombre de otro cliente."
                )
            return vehiculo_mismo_taller

    try:
        return Vehiculo.objects.create(
            owner=user or cliente.owner,
            cliente=cliente,
            patente=patente,
            marca=marca_modelo,
            modelo="S/D",
        )
    except IntegrityError:
        vehiculo_existente = Vehiculo.objects.select_related("cliente").filter(
            patente=patente,
            owner=user or cliente.owner,
        ).first()
        if vehiculo_existente and vehiculo_existente.cliente_id == cliente.id:
            return vehiculo_existente

        raise ValidationError(
            f"La patente {patente} ya está registrada en tu taller y no se pudo asociar de forma segura."
        )

# ==========================================
# SERVICIOS OPERATIVOS (TRANSACCIONALES)
# ==========================================

@transaction.atomic
def crear_trabajo_completo(
    kilometraje: int,
    estado: str,
    items_data: List[Dict[str, Any]],
    user=None,
    vehiculo_id: Optional[int] = None,
    cliente_id: Optional[int] = None,
    cliente_express: Optional[Dict[str, str]] = None,
    vehiculo_express: Optional[Dict[str, str]] = None,
    resumen_trabajos: str = "",
    observaciones_cliente: str = "",
    observaciones_internas: str = "",
    estado_general: str = "BUENO",
    fecha_egreso_estimado: datetime | None = None,
    estado_cubiertas_trabajo: str = "",
    recomendaciones_proximo_service: str = "",
    proximo_control_km: int | None = None,
    descuento: Decimal | float | int | str = Decimal("0.00"),
) -> Trabajo:
    if not items_data:
        raise ValidationError("Debe informar al menos un ítem (repuesto/mano de obra) para registrar el trabajo.")

    # 1. RESOLUCIÓN DE CLIENTE
    if cliente_express:
        nombre_completo = str(cliente_express.get("nombre", "")).strip()
        telefono = str(cliente_express.get("telefono", "")).strip()
        if not nombre_completo:
            raise ValidationError("El nombre del cliente es obligatorio en el Alta Express.")
        cliente = Cliente.objects.create(owner=user, nombre=nombre_completo, telefono=telefono)
    elif cliente_id:
        qs = Cliente.objects.filter(pk=cliente_id)
        if user is not None:
            qs = qs.filter(owner=user)
        cliente = qs.first()
        if not cliente:
            raise ValidationError("El cliente especificado en el directorio no existe.")
    else:
        raise ValidationError("Debe especificar un cliente del directorio o utilizar el Alta Express.")

    # 2. RESOLUCIÓN DE VEHÍCULO
    if vehiculo_express:
        marca_modelo = str(vehiculo_express.get("marca", "")).strip()
        vehiculo = resolver_vehiculo_express_para_usuario(
            cliente=cliente,
            patente_raw=vehiculo_express.get("patente", ""),
            marca_modelo=marca_modelo,
            user=user,
        )
        vehiculo = Vehiculo.objects.select_for_update().get(pk=vehiculo.id)
    elif vehiculo_id:
        vehiculo = Vehiculo.objects.select_for_update().select_related("cliente").filter(pk=vehiculo_id).first()
        if not vehiculo:
            raise ValidationError("El vehículo especificado en el directorio no existe.")
        if vehiculo.cliente_id != cliente.id:
            raise ValidationError("Inconsistencia de seguridad: El vehículo seleccionado no pertenece a este cliente.")
    else:
        raise ValidationError("Debe especificar un vehículo del directorio o utilizar el Alta Express.")

    # 3. VALIDACIÓN FINANCIERA
    descuento_decimal = Decimal(str(descuento or "0.00"))
    if descuento_decimal < 0:
        raise ValidationError("El descuento no puede ser un valor negativo.")

    # 4. INSTANCIACIÓN DEL TRABAJO BASE
    trabajo = Trabajo.objects.create(
        owner=user or cliente.owner,
        vehiculo=vehiculo,
        cliente=cliente,
        kilometraje=kilometraje,
        estado=estado,
        fecha_ingreso=timezone.now(),
        resumen_trabajos=(resumen_trabajos or "").strip() or "Trabajo registrado desde plataforma Express.",
        observaciones_cliente=(observaciones_cliente or "").strip(),
        observaciones_internas=(observaciones_internas or "").strip(),
        estado_general=estado_general,
        fecha_egreso_estimado=fecha_egreso_estimado,
        estado_cubiertas_trabajo=(estado_cubiertas_trabajo or "").strip(),
        recomendaciones_proximo_service=(recomendaciones_proximo_service or "").strip(),
        proximo_control_km=proximo_control_km,
        descuento=descuento_decimal,
    )

    total_mano_obra = Decimal("0.00")
    total_repuestos = Decimal("0.00")
    tipos_validos = {choice for choice, _ in TrabajoItem.TIPO_CHOICES}
    items_a_crear = []

    # 5. PROCESAMIENTO DE ÍTEMS Y CÁLCULO DE COSTOS
    for item in items_data:
        descripcion = str(item.get("descripcion", "")).strip()
        tipo = item.get("tipo")
        
        if not descripcion:
            raise ValidationError("Se detectó un ítem sin descripción.")
        if tipo not in tipos_validos:
            raise ValidationError(f"Clasificación de ítem inválida: {tipo}")

        cantidad = Decimal(str(item.get("cantidad", 1)))
        precio_unitario = Decimal(str(item.get("precio_unitario", 0)))
        
        if cantidad <= 0:
            raise ValidationError(f"La cantidad del ítem '{descripcion}' debe ser mayor a cero.")
        if precio_unitario < 0:
            raise ValidationError(f"El precio unitario del ítem '{descripcion}' no puede ser negativo.")
            
        subtotal = cantidad * precio_unitario

        items_a_crear.append(TrabajoItem(
            trabajo=trabajo, tipo=tipo, descripcion=descripcion,
            cantidad=cantidad, precio_unitario=precio_unitario, subtotal=subtotal
        ))

        if tipo == TrabajoItem.TIPO_MANO_OBRA:
            total_mano_obra += subtotal
        else:
            total_repuestos += subtotal

    TrabajoItem.objects.bulk_create(items_a_crear)

    # 6. CONSOLIDACIÓN FINAL
    trabajo.total_mano_obra = total_mano_obra
    trabajo.total_repuestos = total_repuestos
    trabajo.total = (total_mano_obra + total_repuestos) - descuento_decimal
    trabajo.save(update_fields=["total_mano_obra", "total_repuestos", "total", "descuento"])

    return trabajo

# ==========================================
# SERVICIOS ANALÍTICOS (DASHBOARD)
# ==========================================

def obtener_dashboard_snapshot(user=None, months: int = 6) -> dict:
    """
    Motor analítico reescrito para esquivar Bugs de Timezone en SQLite.
    Agrupa los ingresos en memoria usando Python estricto.
    """
    ahora = timezone.now()
    mes_actual = _month_floor(ahora)
    ventana_inicio = _add_months(mes_actual, -(months - 1))

    # ----------------------------------------------------
    # 1. FLUJO DE CAJA REAL (Pagos cobrados)
    # ----------------------------------------------------
    pagos_base = MovimientoCuenta.objects.filter(tipo=MovimientoCuenta.TIPO_PAGO)
    if user is not None:
        pagos_base = pagos_base.filter(owner=user)

    # Ingreso del mes actual exacto
    ingresos_mes_actual = pagos_base.filter(fecha__gte=mes_actual).aggregate(
        total=Coalesce(Sum("monto"), Decimal("0.00"))
    )["total"]

    # Diccionario para agrupar en Memoria (Evita el error TruncMonth de SQLite)
    ingresos_dict = {}
    ingresos_mensuales = []
    
    # Armamos la grilla de los últimos 6 meses en 0
    for index in range(months):
        current_month = _add_months(ventana_inicio, index)
        # Llave segura (ej: "2026-04-01")
        month_key = f"{current_month.year}-{current_month.month:02d}-01" 
        
        data_mes = {
            "month": month_key,
            "label": f"{MONTH_LABELS[current_month.month - 1]} {current_month.year}",
            "total": Decimal("0.00"),
            "trabajos": 0, # Usado como contador de transacciones
        }
        ingresos_dict[month_key] = data_mes
        ingresos_mensuales.append(data_mes)

    # Iteramos la base de datos y sumamos usando el Local Time seguro
    pagos_grafico = pagos_base.filter(fecha__gte=ventana_inicio)
    for pago in pagos_grafico:
        local_dt = timezone.localtime(pago.fecha)
        key = f"{local_dt.year}-{local_dt.month:02d}-01"
        if key in ingresos_dict:
            ingresos_dict[key]["total"] += pago.monto
            ingresos_dict[key]["trabajos"] += 1

    # Convertimos a float para que el Frontend (React) no tire error
    for item in ingresos_mensuales:
        item["total"] = float(item["total"])

    # ----------------------------------------------------
    # 2. DEUDA Y TICKET PROMEDIO
    # ----------------------------------------------------
    clientes_qs = Cliente.objects.all()
    if user is not None:
        clientes_qs = clientes_qs.filter(owner=user)

    cuenta_corriente_pendiente = clientes_qs.aggregate(
        deuda_total=Coalesce(Sum('saldo_balance'), Decimal("0.00"))
    )["deuda_total"]

    trabajos_base = Trabajo.objects.filter(activo=True)
    if user is not None:
        trabajos_base = trabajos_base.filter(owner=user)
    trabajos_finalizados = trabajos_base.filter(estado__in=["FINALIZADO", "ENTREGADO"])

    ticket_data = trabajos_finalizados.aggregate(
        promedio=Coalesce(Sum('total') / Count('id'), Decimal("0.00"))
    )
    ticket_promedio = ticket_data["promedio"]

    # ----------------------------------------------------
    # 3. KPIs OPERATIVOS Y TABLAS
    # ----------------------------------------------------
    trabajos_por_estado = list(
        trabajos_base.values("estado").annotate(cantidad=Count("id")).order_by("estado")
    )

    trabajos_recientes = [
        {
            "id": t.id,
            "estado": t.estado,
            "fecha_ingreso": t.fecha_ingreso,
            "total": float(t.total),
            "cliente_nombre": t.cliente.nombre_completo,
            "vehiculo": f"{t.vehiculo.marca} {t.vehiculo.modelo}",
            "patente": t.vehiculo.patente,
            "resumen": t.resumen_trabajos,
        }
        for t in trabajos_base.select_related("cliente", "vehiculo").order_by("-fecha_ingreso")[:5]
    ]

    # Alertas Service
    alertas_service = []
    vehiculos_qs = Vehiculo.objects.select_related("cliente")
    if user is not None:
        vehiculos_qs = vehiculos_qs.filter(owner=user)
    vehiculos_con_service = (
        vehiculos_qs
        .exclude(proximo_service_km__isnull=True)
        .annotate(diferencia=F('proximo_service_km') - F('kilometraje_actual'))
        .filter(diferencia__lte=2500)
        .order_by("diferencia")[:5]
    )

    for v in vehiculos_con_service:
        alertas_service.append({
            "vehiculo_id": v.id,
            "cliente_nombre": v.cliente.nombre_completo,
            "patente": v.patente,
            "vehiculo": f"{v.marca} {v.modelo}",
            "kilometraje_actual": v.kilometraje_actual,
            "proximo_service_km": v.proximo_service_km,
            "diferencia_km": v.diferencia,
            "status": "VENCIDO" if v.diferencia <= 0 else "PROXIMO",
        })

    # Agenda
    turnos_qs = Turno.objects.filter(fecha_hora__gte=ahora).exclude(estado__in=["CANCELADO", "CUMPLIDO"])
    if user is not None:
        turnos_qs = turnos_qs.filter(owner=user)
    turnos_proximos = [
        {
            "id": t.id,
            "fecha_hora": t.fecha_hora,
            "estado": t.estado,
            "cliente_nombre": t.cliente.nombre_completo if t.cliente else "Sin cliente",
            "vehiculo": f"{t.vehiculo.patente} · {t.vehiculo.marca} {t.vehiculo.modelo}" if t.vehiculo else "Sin asignar",
            "motivo": t.motivo,
        }
        for t in turnos_qs.select_related("cliente", "vehiculo").order_by("fecha_hora")[:5]
    ]

    return {
        "total_clientes": clientes_qs.count(),
        "total_vehiculos": vehiculos_qs.count(),
        "trabajos_activos": trabajos_base.exclude(estado__in=["ENTREGADO", "ANULADO"]).count(),
        "ingresos_mes_actual": float(ingresos_mes_actual),
        "cuenta_corriente_pendiente": float(cuenta_corriente_pendiente),
        "ticket_promedio": float(ticket_promedio),
        "trabajos_por_estado": trabajos_por_estado,
        "ingresos_mensuales": ingresos_mensuales,
        "trabajos_recientes": trabajos_recientes,
        "alertas_service": alertas_service,
        "turnos_proximos": turnos_proximos,
    }


# ==========================================
# SERVICIOS FINANCIEROS (LEGACY COMPATIBILITY)
# ==========================================

@transaction.atomic
def registrar_pago_cliente(cliente_id: int, monto: float, metodo_pago: str, descripcion: str = "") -> MovimientoCuenta:
    monto_decimal = Decimal(str(monto))
    if monto_decimal <= 0:
        raise ValidationError("El monto del pago debe ser mayor a cero.")

    cliente = Cliente.objects.select_for_update().filter(pk=cliente_id).first()
    if not cliente:
        raise ValidationError("El cliente especificado no existe.")

    pago = MovimientoCuenta.objects.create(
        owner=cliente.owner,
        cliente=cliente,
        tipo=MovimientoCuenta.TIPO_PAGO,
        monto=monto_decimal,
        metodo_pago=metodo_pago,
        descripcion=descripcion.strip()
    )

    cliente.saldo_balance -= monto_decimal
    cliente.save(update_fields=['saldo_balance'])

    return pago
