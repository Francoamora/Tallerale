# taller/api.py
from datetime import datetime
from typing import List, Optional, Tuple
from decimal import Decimal
from uuid import UUID

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import ModelSchema, NinjaAPI, Schema, Field
from ninja.errors import HttpError

from .models import Cliente, Trabajo, Vehiculo, TrabajoItem, Gasto, MovimientoCuenta, Turno, Presupuesto, PresupuestoItem, PerfilTaller, ApiToken
from .services import (
    crear_trabajo_completo,
    obtener_dashboard_snapshot,
    resolver_vehiculo_express_para_usuario,
)

# ==========================================
# AUTENTICACIÓN POR TOKEN
# ==========================================

class TokenAuth:
    """
    Auth flexible para el frontend.
    Acepta cualquiera de estos formatos:
    - Authorization: Token <token>
    - Authorization: Bearer <token>
    - Authorization: <token>
    """

    openapi_type = "http"
    openapi_scheme = "bearer"

    def __call__(self, request):
        raw_header = request.headers.get("Authorization", "").strip()
        if not raw_header:
            return None

        parts = raw_header.split(None, 1)
        if len(parts) == 1:
            token = parts[0]
        else:
            scheme, token = parts[0].lower(), parts[1].strip()
            if scheme not in {"token", "bearer"}:
                return None

        if not token:
            return None

        try:
            api_token = ApiToken.objects.select_related("user").get(key=token)
        except ApiToken.DoesNotExist:
            return None

        request.user = api_token.user
        request.auth_token = api_token
        return api_token.user

# ==========================================
# CONFIGURACIÓN CORE DE LA API
# ==========================================
api = NinjaAPI(
    auth=TokenAuth(),
    title="TallerOS - Core API",
    version="7.2.0",
    description="Motor operativo multi-tenant. Cada usuario solo accede a sus propios datos.",
    docs_url="/docs"
)

# ==========================================
# 1. SCHEMAS DE LECTURA (Output)
# ==========================================

class ClienteSchema(ModelSchema):
    nombre_completo: str
    saldo_balance: float = Field(..., description="Saldo actual pre-calculado del cliente")

    class Meta:
        model = Cliente
        fields = ["id", "nombre", "apellido", "telefono", "email", "dni"]

class VehiculoSchema(ModelSchema):
    cliente_id: int

    class Meta:
        model = Vehiculo
        fields = ["id", "token", "patente", "marca", "modelo", "anio", "color", "kilometraje_actual", "proximo_service_km"]

class TrabajoItemOut(ModelSchema):
    class Meta:
        model = TrabajoItem
        fields = ["id", "tipo", "descripcion", "cantidad", "precio_unitario", "subtotal"]

class TrabajoRecienteOut(Schema):
    id: int
    estado: str
    fecha_ingreso: datetime
    total: float
    cliente_nombre: str
    vehiculo: str
    patente: str
    resumen: str

class TrabajoDetalleOut(Schema):
    id: int
    estado: str
    fecha_ingreso: datetime
    fecha_egreso_estimado: Optional[datetime]
    kilometraje: int
    resumen_trabajos: str
    observaciones_cliente: str
    observaciones_internas: str
    estado_general: str
    estado_cubiertas_trabajo: str
    recomendaciones_proximo_service: str
    proximo_control_km: Optional[int]
    total_mano_obra: float
    total_repuestos: float
    descuento: float
    total: float
    cliente: ClienteSchema
    vehiculo: VehiculoSchema
    items: List[TrabajoItemOut]

class TurnoOut(Schema):
    id: int
    fecha_hora: datetime
    motivo: str
    notas: str
    estado: str
    cliente_nombre: str
    vehiculo_desc: str
    patente: str

class MovimientoCajaOut(Schema):
    id: str
    fecha: datetime
    tipo: str
    concepto: str
    monto: float
    metodo: str

class MovimientoCuentaOut(Schema):
    id: int
    tipo: str
    monto: float
    fecha: datetime
    descripcion: str
    metodo_pago: str
    fecha_promesa: Optional[str] = None

class GastoOut(Schema):
    id: int
    fecha: datetime
    tipo: str
    descripcion: str
    monto: float
    comprobante: str

class PresupuestoItemOut(ModelSchema):
    class Meta:
        model = PresupuestoItem
        fields = ["id", "tipo", "descripcion", "cantidad", "precio_unitario", "subtotal"]

class PresupuestoOut(Schema):
    id: int
    token: UUID
    fecha_creacion: datetime
    estado: str
    resumen_corto: str
    total: float
    cliente_nombre: str
    vehiculo: str
    patente: str

class PresupuestoDetalleOut(Schema):
    id: int
    token: UUID
    fecha_creacion: datetime
    estado: str
    resumen_corto: str
    total_mano_obra: float
    total_repuestos: float
    descuento: float
    total: float
    cliente: Optional[ClienteSchema] = None
    vehiculo: Optional[VehiculoSchema] = None
    items: List[PresupuestoItemOut]

class RespuestaGenerica(Schema):
    message: str
    nuevo_saldo: Optional[float] = None

class ErrorSchema(Schema):
    message: str


class PublicClienteOut(Schema):
    nombre_completo: str
    telefono: Optional[str] = None
    email: Optional[str] = None


class PublicVehiculoResumenOut(Schema):
    token: str
    patente: str
    marca: str
    modelo: str
    anio: Optional[int] = None
    color: Optional[str] = None
    kilometraje_actual: int


class PublicPresupuestoOut(Schema):
    token: str
    id: int
    fecha_creacion: datetime
    estado: str
    resumen_corto: str
    total_mano_obra: float
    total_repuestos: float
    descuento: float
    total: float
    cliente: Optional[PublicClienteOut] = None
    vehiculo: Optional[PublicVehiculoResumenOut] = None
    items: List[PresupuestoItemOut]
    taller_nombre: Optional[str] = None
    taller_tel: Optional[str] = None


class PublicTrabajoResumenOut(Schema):
    id: int
    fecha_ingreso: datetime
    fecha_egreso_estimado: Optional[datetime] = None
    estado: str
    resumen_trabajos: str
    total: float
    kilometraje: int
    recomendaciones_proximo_service: Optional[str] = None


class PublicVehiculoOut(Schema):
    token: str
    patente: str
    marca: str
    modelo: str
    anio: Optional[int] = None
    color: Optional[str] = None
    kilometraje_actual: int
    proximo_service_km: Optional[int] = None
    cliente_nombre: str
    historial: List[PublicTrabajoResumenOut]
    taller_nombre: Optional[str] = None
    taller_tel: Optional[str] = None

# ==========================================
# 2. SCHEMAS DE ACCIÓN (Input)
# ==========================================

class ClienteExpressIn(Schema):
    nombre: str = Field(..., example="Juan Pérez")
    telefono: Optional[str] = Field(default="", example="342-155123456")

class ClienteUpdateIn(Schema):
    nombre: str = Field(..., example="Juan Pérez")
    telefono: str = ""
    email: str = ""
    dni: str = ""

class VehiculoExpressIn(Schema):
    patente: str = Field(..., example="AB123CD")
    marca: str = Field(..., example="Toyota Corolla")

class VehiculoIn(Schema):
    cliente_id: int
    patente: str = Field(..., example="AB123CD")
    marca: str = Field(..., example="Toyota")
    modelo: str = Field(default="S/D", example="Corolla")
    anio: Optional[int] = None
    color: str = ""
    kilometraje_actual: int = 0
    proximo_service_km: Optional[int] = None

class ClienteIn(Schema):
    nombre: str = Field(..., example="Juan")
    apellido: str = ""
    telefono: str = ""
    email: str = ""
    dni: str = ""

class TrabajoItemIn(Schema):
    tipo: str = Field(..., example="REPUESTO")
    descripcion: str = Field(..., example="Filtro de aceite original")
    cantidad: float = Field(..., gt=0)
    precio_unitario: float = Field(..., ge=0)

class TrabajoIn(Schema):
    vehiculo_id: Optional[int] = None
    cliente_id: Optional[int] = None
    cliente_express: Optional[ClienteExpressIn] = None
    vehiculo_express: Optional[VehiculoExpressIn] = None
    kilometraje: int = Field(..., example=85000)
    estado: str = Field(default="INGRESADO", example="INGRESADO")
    resumen_trabajos: str = Field(default="")
    observaciones_cliente: str = ""
    observaciones_internas: str = ""
    estado_general: str = Field(default="BUENO")
    fecha_egreso_estimado: Optional[datetime] = None
    estado_cubiertas_trabajo: str = ""
    recomendaciones_proximo_service: str = ""
    proximo_control_km: Optional[int] = None
    descuento: float = Field(default=0.0, ge=0.0)
    items: List[TrabajoItemIn]

class EstadoRapidoIn(Schema):
    estado: str = Field(..., description="Nuevo estado (aplica a Trabajos, Turnos o Presupuestos)")

class TurnoIn(Schema):
    fecha_hora: datetime
    motivo: str
    notas: str = ""
    cliente_id: Optional[int] = None
    vehiculo_id: Optional[int] = None
    cliente_express: Optional[ClienteExpressIn] = None
    vehiculo_express: Optional[VehiculoExpressIn] = None

class PresupuestoIn(Schema):
    cliente_id: Optional[int] = None
    vehiculo_id: Optional[int] = None
    cliente_express: Optional[ClienteExpressIn] = None
    vehiculo_express: Optional[VehiculoExpressIn] = None
    resumen_corto: str = Field(default="")
    estado: str = Field(default="BORRADOR")
    descuento: float = Field(default=0.0, ge=0.0)
    items: List[TrabajoItemIn]

class OperacionCajaIn(Schema):
    cliente_id: Optional[int] = None
    cliente_express: Optional[ClienteExpressIn] = None
    monto_total_venta: float = Field(default=0.0, ge=0.0) 
    monto_pagado: float = Field(default=0.0, ge=0.0)      
    metodo_pago: str = Field(default="EFECTIVO")
    descripcion: str = ""
    fecha_promesa: Optional[str] = None 

class GastoIn(Schema):
    tipo: str
    descripcion: str
    monto: float = Field(..., gt=0)
    comprobante: str = ""


# ==========================================
# HELPER SENIOR: RESOLUCIÓN DE ENTIDADES (DRY)
# ==========================================

def _resolver_entidades_express(payload, user=None) -> Tuple[Optional[Cliente], Optional[Vehiculo]]:
    """
    Toma cualquier payload que tenga cliente_id/cliente_express y vehiculo_id/vehiculo_express.
    Resuelve si hay que buscar en base de datos o crear registros nuevos al vuelo.
    Cuando se provee user, los nuevos clientes se asignan a ese owner y los lookups
    por ID validan que el registro pertenezca al usuario.
    """
    cliente = None
    vehiculo = None

    if getattr(payload, "cliente_express", None):
        cliente = Cliente.objects.create(
            owner=user,
            nombre=payload.cliente_express.nombre,
            telefono=payload.cliente_express.telefono or ""
        )
    elif getattr(payload, "cliente_id", None):
        qs = Cliente.objects.filter(pk=payload.cliente_id)
        if user is not None:
            qs = qs.filter(owner=user)
        cliente = get_object_or_404(qs)

    if cliente and getattr(payload, "vehiculo_express", None):
        vehiculo = resolver_vehiculo_express_para_usuario(
            cliente=cliente,
            patente_raw=payload.vehiculo_express.patente,
            marca_modelo=payload.vehiculo_express.marca,
            user=user,
        )
    elif getattr(payload, "vehiculo_id", None):
        qs = Vehiculo.objects.filter(pk=payload.vehiculo_id)
        if user is not None:
            qs = qs.filter(owner=user)
        vehiculo = get_object_or_404(qs)

    return cliente, vehiculo


def _perfil_taller_desde_owner(owner) -> Tuple[Optional[str], Optional[str]]:
    if not owner:
        return None, None

    try:
        perfil = owner.perfil
    except PerfilTaller.DoesNotExist:
        return None, None

    return perfil.taller_nombre, perfil.taller_tel or None


def _serializar_presupuesto_publico(presupuesto: Presupuesto) -> PublicPresupuestoOut:
    taller_nombre, taller_tel = _perfil_taller_desde_owner(presupuesto.owner)
    return PublicPresupuestoOut(
        token=str(presupuesto.token),
        id=presupuesto.id,
        fecha_creacion=presupuesto.fecha_creacion,
        estado=presupuesto.estado,
        resumen_corto=presupuesto.resumen_corto,
        total_mano_obra=float(presupuesto.total_mano_obra),
        total_repuestos=float(presupuesto.total_repuestos),
        descuento=float(presupuesto.descuento),
        total=float(presupuesto.total),
        cliente=(
            PublicClienteOut(
                nombre_completo=presupuesto.cliente.nombre_completo,
                telefono=presupuesto.cliente.telefono or None,
                email=presupuesto.cliente.email or None,
            )
            if presupuesto.cliente else None
        ),
        vehiculo=(
            PublicVehiculoResumenOut(
                token=str(presupuesto.vehiculo.token),
                patente=presupuesto.vehiculo.patente,
                marca=presupuesto.vehiculo.marca,
                modelo=presupuesto.vehiculo.modelo,
                anio=presupuesto.vehiculo.anio,
                color=presupuesto.vehiculo.color or None,
                kilometraje_actual=presupuesto.vehiculo.kilometraje_actual,
            )
            if presupuesto.vehiculo else None
        ),
        items=[
            PresupuestoItemOut.model_validate(item, from_attributes=True)
            for item in presupuesto.items.all()
        ],
        taller_nombre=taller_nombre,
        taller_tel=taller_tel,
    )


def _serializar_vehiculo_publico(vehiculo: Vehiculo) -> PublicVehiculoOut:
    taller_nombre, taller_tel = _perfil_taller_desde_owner(vehiculo.owner)
    historial = [
        PublicTrabajoResumenOut(
            id=trabajo.id,
            fecha_ingreso=trabajo.fecha_ingreso,
            fecha_egreso_estimado=trabajo.fecha_egreso_estimado,
            estado=trabajo.estado,
            resumen_trabajos=trabajo.resumen_trabajos,
            total=float(trabajo.total),
            kilometraje=trabajo.kilometraje,
            recomendaciones_proximo_service=trabajo.recomendaciones_proximo_service or None,
        )
        for trabajo in vehiculo.trabajos.filter(activo=True).order_by("-fecha_ingreso")
    ]

    return PublicVehiculoOut(
        token=str(vehiculo.token),
        patente=vehiculo.patente,
        marca=vehiculo.marca,
        modelo=vehiculo.modelo,
        anio=vehiculo.anio,
        color=vehiculo.color or None,
        kilometraje_actual=vehiculo.kilometraje_actual,
        proximo_service_km=vehiculo.proximo_service_km,
        cliente_nombre=vehiculo.cliente.nombre_completo,
        historial=historial,
        taller_nombre=taller_nombre,
        taller_tel=taller_tel,
    )


def _parsear_token_publico(token: str):
    try:
        return UUID(str(token))
    except (TypeError, ValueError):
        raise HttpError(404, "Recurso publico no encontrado")


# ==========================================
# 3. SCHEMAS ANALÍTICOS (Dashboard)
# ==========================================

class TrabajoEstadoCount(Schema):
    estado: str
    cantidad: int

class IngresoMensualOut(Schema):
    month: str
    label: str
    total: float
    trabajos: int

class AlertaServiceOut(Schema):
    vehiculo_id: int
    cliente_nombre: str
    patente: str
    vehiculo: str
    kilometraje_actual: int
    proximo_service_km: int
    diferencia_km: int
    status: str

class TurnoProximoOut(Schema):
    id: int
    fecha_hora: datetime
    estado: str
    cliente_nombre: str
    vehiculo: str
    motivo: str

class EstadisticasDashboardOut(Schema):
    total_clientes: int
    total_vehiculos: int
    trabajos_activos: int
    ingresos_mes_actual: float
    cuenta_corriente_pendiente: float
    ticket_promedio: float
    trabajos_por_estado: List[TrabajoEstadoCount]
    ingresos_mensuales: List[IngresoMensualOut]
    trabajos_recientes: List[TrabajoRecienteOut]
    alertas_service: List[AlertaServiceOut]
    turnos_proximos: List[TurnoProximoOut]


# ==========================================
# 4. ENDPOINTS ANALÍTICOS Y DIRECTORIO
# ==========================================

@api.get("/dashboard/stats", response=EstadisticasDashboardOut, tags=["Analitica"], summary="Métricas en tiempo real")
def api_dashboard_stats(request):
    return obtener_dashboard_snapshot(user=request.user)

@api.get("/clientes", response=List[ClienteSchema], tags=["Directorio"])
def listar_clientes(request, q: Optional[str] = None):
    qs = Cliente.objects.filter(owner=request.user)
    if q:
        qs = qs.filter(Q(nombre__icontains=q) | Q(apellido__icontains=q) | Q(dni__icontains=q))
    return qs

@api.get("/clientes/{cliente_id}", response=ClienteSchema, tags=["Directorio"])
def obtener_cliente(request, cliente_id: int):
    return get_object_or_404(Cliente, id=cliente_id, owner=request.user)

@api.post("/clientes/", response={201: ClienteSchema, 400: ErrorSchema}, tags=["Directorio"])
def crear_cliente(request, payload: ClienteIn):
    try:
        cliente = Cliente.objects.create(
            owner=request.user,
            nombre=payload.nombre,
            apellido=payload.apellido,
            telefono=payload.telefono,
            email=payload.email,
            dni=payload.dni,
        )
        return 201, cliente
    except Exception as e:
        return 400, {"message": str(e)}

@api.put("/clientes/{cliente_id}", response={200: ClienteSchema, 400: ErrorSchema}, tags=["Directorio"])
def actualizar_cliente(request, cliente_id: int, payload: ClienteUpdateIn):
    try:
        cliente = get_object_or_404(Cliente, id=cliente_id, owner=request.user)
        cliente.nombre = payload.nombre
        cliente.telefono = payload.telefono
        cliente.email = payload.email
        cliente.dni = payload.dni
        cliente.save(update_fields=['nombre', 'telefono', 'email', 'dni'])
        return 200, cliente
    except Exception as e:
        return 400, {"message": str(e)}

@api.get("/vehiculos", response=List[VehiculoSchema], tags=["Directorio"])
def listar_vehiculos(request, q: Optional[str] = None, cliente_id: Optional[int] = None):
    qs = Vehiculo.objects.select_related('cliente').filter(owner=request.user)
    if cliente_id:
        qs = qs.filter(cliente_id=cliente_id)
    if q:
        qs = qs.filter(Q(patente__icontains=q) | Q(marca__icontains=q) | Q(modelo__icontains=q))
    return qs

@api.post("/vehiculos/", response={201: VehiculoSchema, 400: ErrorSchema}, tags=["Directorio"])
def crear_vehiculo(request, payload: VehiculoIn):
    try:
        cliente = get_object_or_404(Cliente, id=payload.cliente_id, owner=request.user)
        patente = "".join(payload.patente.split()).upper()
        vehiculo_existente = (
            Vehiculo.objects.select_related("cliente")
            .filter(owner=request.user, patente=patente)
            .first()
        )
        if vehiculo_existente:
            if vehiculo_existente.cliente_id == cliente.id:
                return 400, {"message": f"La patente {patente} ya está cargada para este cliente."}
            return 400, {"message": f"La patente {patente} ya está registrada en tu taller a nombre de otro cliente."}

        vehiculo = Vehiculo.objects.create(
            owner=request.user,
            cliente=cliente,
            patente=patente,
            marca=payload.marca,
            modelo=payload.modelo,
            anio=payload.anio,
            color=payload.color,
            kilometraje_actual=payload.kilometraje_actual,
            proximo_service_km=payload.proximo_service_km,
        )
        return 201, vehiculo
    except Exception as e:
        return 400, {"message": str(e)}

@api.get("/vehiculos/{vehiculo_id}", response=VehiculoSchema, tags=["Directorio"])
def obtener_vehiculo(request, vehiculo_id: int):
    return get_object_or_404(Vehiculo.objects.select_related('cliente'), id=vehiculo_id, owner=request.user)


# ==========================================
# 5. ENDPOINTS DE OPERACIONES (TRABAJOS)
# ==========================================

@api.get("/trabajos/", response=List[TrabajoRecienteOut], tags=["Operaciones"])
def api_listar_trabajos(request, q: Optional[str] = None, cliente_id: Optional[int] = None):
    qs = Trabajo.objects.select_related('cliente', 'vehiculo').filter(activo=True, owner=request.user)
    if cliente_id:
        qs = qs.filter(cliente_id=cliente_id)
    if q:
        qs = qs.filter(
            Q(vehiculo__patente__icontains=q) |
            Q(cliente__nombre__icontains=q) |
            Q(cliente__apellido__icontains=q) |
            Q(id__icontains=q if q.isdigit() else "0")
        )
    return [
        {
            "id": t.id,
            "estado": t.estado,
            "fecha_ingreso": t.fecha_ingreso,
            "total": float(t.total),
            "cliente_nombre": t.cliente.nombre_completo,
            "vehiculo": f"{t.vehiculo.marca} {t.vehiculo.modelo}",
            "patente": t.vehiculo.patente,
            "resumen": t.resumen_trabajos,
        } for t in qs.order_by("-fecha_ingreso")
    ]

@api.get("/trabajos/tablero", response=dict, tags=["Operaciones"], summary="Datos para Tablero Kanban")
def api_tablero_trabajos(request):
    ahora = timezone.now()
    qs = Trabajo.objects.select_related('cliente', 'vehiculo').filter(activo=True, owner=request.user).exclude(estado=Trabajo.ESTADO_ANULADO)

    tablero = {
        "INGRESADO": {"trabajos": [], "total_plata": 0},
        "EN_PROCESO": {"trabajos": [], "total_plata": 0},
        "FINALIZADO": {"trabajos": [], "total_plata": 0},
        "ENTREGADO": {"trabajos": [], "total_plata": 0},
    }

    for t in qs:
        dias = (ahora - t.fecha_ingreso).days
        resumen = (t.resumen_trabajos[:45] + '...') if len(t.resumen_trabajos) > 45 else t.resumen_trabajos
        if not resumen: resumen = "Sin diagnóstico inicial."

        item = {
            "id": t.id,
            "estado": t.estado,
            "patente": t.vehiculo.patente,
            "vehiculo": f"{t.vehiculo.marca} {t.vehiculo.modelo}",
            "cliente_nombre": t.cliente.nombre_completo,
            "total": float(t.total),
            "fecha_ingreso": t.fecha_ingreso,
            "resumen_corto": resumen,
            "dias_en_taller": dias
        }

        if t.estado == Trabajo.ESTADO_ENTREGADO:
            fecha_ref = t.fecha_egreso_real if t.fecha_egreso_real else t.fecha_ingreso
            if (ahora - fecha_ref).days > 2:
                continue

        if t.estado in tablero:
            tablero[t.estado]["trabajos"].append(item)
            tablero[t.estado]["total_plata"] += float(t.total)

    for estado in tablero:
        tablero[estado]["trabajos"].sort(key=lambda x: x["fecha_ingreso"])

    return tablero

@api.get("/trabajos/{trabajo_id}", response=TrabajoDetalleOut, tags=["Operaciones"])
def api_detalle_trabajo(request, trabajo_id: int):
    return get_object_or_404(
        Trabajo.objects.select_related('cliente', 'vehiculo').prefetch_related('items'),
        id=trabajo_id,
        activo=True,
        owner=request.user,
    )

@api.post("/trabajos/", response={201: TrabajoDetalleOut, 400: ErrorSchema, 422: ErrorSchema}, tags=["Operaciones"])
def api_crear_trabajo(request, payload: TrabajoIn):
    try:
        data = payload.model_dump()
        trabajo = crear_trabajo_completo(
            user=request.user,
            vehiculo_id=data.get('vehiculo_id'),
            cliente_id=data.get('cliente_id'),
            cliente_express=data.get('cliente_express'),
            vehiculo_express=data.get('vehiculo_express'),
            kilometraje=data.get('kilometraje'),
            estado=data.get('estado', 'INGRESADO'),
            items_data=data.get('items', []),
            resumen_trabajos=data.get('resumen_trabajos', ''),
            observaciones_cliente=data.get('observaciones_cliente', ''),
            observaciones_internas=data.get('observaciones_internas', ''),
            estado_general=data.get('estado_general', 'BUENO'),
            fecha_egreso_estimado=data.get('fecha_egreso_estimado'),
            estado_cubiertas_trabajo=data.get('estado_cubiertas_trabajo', ''),
            recomendaciones_proximo_service=data.get('recomendaciones_proximo_service', ''),
            proximo_control_km=data.get('proximo_control_km'),
            descuento=data.get('descuento', 0.0),
        )
        return 201, trabajo
    except Vehiculo.DoesNotExist: return 400, {"message": "El vehículo no existe."}
    except DjangoValidationError as e: return 400, {"message": e.messages[0] if hasattr(e, 'messages') else str(e)}
    except Exception as e: return 422, {"message": f"Error interno: {str(e)}"}

@api.put("/trabajos/{trabajo_id}", response={200: TrabajoDetalleOut, 400: ErrorSchema}, tags=["Operaciones"])
def api_editar_trabajo(request, trabajo_id: int, payload: TrabajoIn):
    try:
        with transaction.atomic():
            trabajo = get_object_or_404(Trabajo, id=trabajo_id, activo=True, owner=request.user)
            trabajo.kilometraje = payload.kilometraje
            trabajo.resumen_trabajos = payload.resumen_trabajos
            trabajo.observaciones_cliente = payload.observaciones_cliente
            trabajo.observaciones_internas = payload.observaciones_internas
            trabajo.estado_general = payload.estado_general
            trabajo.fecha_egreso_estimado = payload.fecha_egreso_estimado
            trabajo.estado_cubiertas_trabajo = payload.estado_cubiertas_trabajo
            trabajo.recomendaciones_proximo_service = payload.recomendaciones_proximo_service
            trabajo.proximo_control_km = payload.proximo_control_km
            trabajo.descuento = Decimal(str(payload.descuento))

            trabajo.items.all().delete()
            total_mo, total_rep = Decimal("0.00"), Decimal("0.00")
            nuevos_items = []
            
            for item in payload.items:
                cant = Decimal(str(item.cantidad))
                prec = Decimal(str(item.precio_unitario))
                subt = cant * prec
                nuevos_items.append(TrabajoItem(
                    trabajo=trabajo, tipo=item.tipo, descripcion=item.descripcion, 
                    cantidad=cant, precio_unitario=prec, subtotal=subt
                ))
                if item.tipo == "MANO_OBRA": total_mo += subt
                else: total_rep += subt
                    
            TrabajoItem.objects.bulk_create(nuevos_items)
            trabajo.total_mano_obra = total_mo
            trabajo.total_repuestos = total_rep
            trabajo.total = (total_mo + total_rep) - trabajo.descuento
            trabajo.save()
            return 200, trabajo
    except Exception as e: return 400, {"message": str(e)}

@api.delete("/trabajos/{trabajo_id}", response={200: dict, 400: ErrorSchema}, tags=["Operaciones"])
def api_eliminar_trabajo(request, trabajo_id: int):
    trabajo = get_object_or_404(Trabajo, id=trabajo_id, activo=True, owner=request.user)
    trabajo.enviar_a_eliminados() 
    return 200, {"message": "Orden enviada a la papelera."}

@api.patch("/trabajos/{trabajo_id}/estado", response={200: dict, 400: ErrorSchema}, tags=["Operaciones"])
def api_actualizar_estado_trabajo(request, trabajo_id: int, payload: EstadoRapidoIn):
    trabajo = get_object_or_404(Trabajo, id=trabajo_id, activo=True, owner=request.user)
    estados_validos = dict(Trabajo.ESTADO_CHOICES).keys()
    if payload.estado not in estados_validos: return 400, {"message": "Estado inválido."}
        
    trabajo.estado = payload.estado
    if payload.estado == Trabajo.ESTADO_ENTREGADO:
        trabajo.fecha_egreso_real = timezone.now()
    trabajo.save(update_fields=["estado", "fecha_egreso_real"])
    return 200, {"message": "Estado actualizado", "nuevo_estado": trabajo.estado}


# ==========================================
# 6. ENDPOINTS DE AGENDA (TURNOS)
# ==========================================

@api.get("/turnos/", response=List[TurnoOut], tags=["Agenda"])
def listar_turnos(request, q: Optional[str] = None):
    qs = Turno.objects.select_related('cliente', 'vehiculo').filter(owner=request.user).order_by('fecha_hora')
    if q:
        qs = qs.filter(Q(cliente__nombre__icontains=q) | Q(vehiculo__patente__icontains=q) | Q(motivo__icontains=q))
    return [
        {
            "id": t.id,
            "fecha_hora": t.fecha_hora,
            "motivo": t.motivo,
            "notas": t.notas,
            "estado": t.estado,
            "cliente_nombre": t.cliente.nombre_completo if t.cliente else "Sin Cliente",
            "vehiculo_desc": f"{t.vehiculo.marca} {t.vehiculo.modelo}" if t.vehiculo else "Sin Vehículo",
            "patente": t.vehiculo.patente if t.vehiculo else "N/A",
        } for t in qs
    ]

@api.get("/turnos/{turno_id}", response=TurnoOut, tags=["Agenda"])
def obtener_turno(request, turno_id: int):
    turno = get_object_or_404(Turno.objects.select_related('cliente', 'vehiculo'), id=turno_id, owner=request.user)
    return {
        "id": turno.id,
        "fecha_hora": turno.fecha_hora,
        "motivo": turno.motivo,
        "notas": turno.notas,
        "estado": turno.estado,
        "cliente_nombre": turno.cliente.nombre_completo if turno.cliente else "Sin Cliente",
        "vehiculo_desc": f"{turno.vehiculo.marca} {turno.vehiculo.modelo}" if turno.vehiculo else "Sin Vehículo",
        "patente": turno.vehiculo.patente if turno.vehiculo else "N/A",
    }

@api.post("/turnos/", response={201: TurnoOut, 400: ErrorSchema}, tags=["Agenda"])
def crear_turno(request, payload: TurnoIn):
    try:
        with transaction.atomic():
            cliente, vehiculo = _resolver_entidades_express(payload, user=request.user)
            turno = Turno.objects.create(
                owner=request.user,
                cliente=cliente,
                vehiculo=vehiculo,
                fecha_hora=payload.fecha_hora,
                motivo=payload.motivo,
                notas=payload.notas,
                estado="PENDIENTE"
            )
            
            return 201, {
                "id": turno.id, "fecha_hora": turno.fecha_hora, "motivo": turno.motivo, 
                "notas": turno.notas, "estado": turno.estado, 
                "cliente_nombre": cliente.nombre_completo if cliente else "Sin Cliente", 
                "vehiculo_desc": f"{vehiculo.marca} {vehiculo.modelo}" if vehiculo else "Sin Vehículo", 
                "patente": vehiculo.patente if vehiculo else "N/A"
            }
    except Exception as e: return 400, {"message": f"Error al crear turno: {str(e)}"}

@api.put("/turnos/{turno_id}", response={200: TurnoOut, 400: ErrorSchema}, tags=["Agenda"])
def editar_turno(request, turno_id: int, payload: TurnoIn):
    try:
        turno = get_object_or_404(Turno, id=turno_id, owner=request.user)
        turno.fecha_hora = payload.fecha_hora
        turno.motivo = payload.motivo
        turno.notas = payload.notas
        turno.save()
        return 200, {
            "id": turno.id, "fecha_hora": turno.fecha_hora, "motivo": turno.motivo, "notas": turno.notas, "estado": turno.estado,
            "cliente_nombre": turno.cliente.nombre_completo if turno.cliente else "Sin Cliente",
            "vehiculo_desc": f"{turno.vehiculo.marca} {turno.vehiculo.modelo}" if turno.vehiculo else "Sin Vehículo",
            "patente": turno.vehiculo.patente if turno.vehiculo else "N/A"
        }
    except Exception as e: return 400, {"message": str(e)}

@api.delete("/turnos/{turno_id}", response={200: dict, 400: ErrorSchema}, tags=["Agenda"])
def eliminar_turno(request, turno_id: int):
    turno = get_object_or_404(Turno, id=turno_id, owner=request.user)
    turno.delete()
    return 200, {"message": "Turno eliminado permanentemente de la agenda."}

@api.patch("/turnos/{turno_id}/estado", response={200: dict, 400: ErrorSchema}, tags=["Agenda"])
def actualizar_estado_turno(request, turno_id: int, payload: EstadoRapidoIn):
    turno = get_object_or_404(Turno, id=turno_id, owner=request.user)
    estados_validos = dict(Turno.ESTADO_CHOICES).keys()
    if payload.estado not in estados_validos: return 400, {"message": "Estado inválido."}
    turno.estado = payload.estado
    turno.save(update_fields=["estado"])
    return 200, {"message": "Turno actualizado"}


# ==========================================
# 7. ENDPOINTS DE PRESUPUESTOS 
# ==========================================

@api.get("/presupuestos/", response=List[PresupuestoOut], tags=["Presupuestos"])
def listar_presupuestos(request, q: Optional[str] = None):
    qs = Presupuesto.objects.select_related('cliente', 'vehiculo').filter(activo=True, owner=request.user).order_by('-fecha_creacion')
    if q:
        qs = qs.filter(Q(cliente__nombre__icontains=q) | Q(vehiculo__patente__icontains=q) | Q(resumen_corto__icontains=q))
    return [
        {
            "id": p.id, "token": str(p.token), "fecha_creacion": p.fecha_creacion, "estado": p.estado, "resumen_corto": p.resumen_corto, "total": float(p.total),
            "cliente_nombre": p.cliente.nombre_completo if p.cliente else "Sin Cliente",
            "vehiculo": f"{p.vehiculo.marca} {p.vehiculo.modelo}" if p.vehiculo else "Sin Vehículo",
            "patente": p.vehiculo.patente if p.vehiculo else "N/A",
        } for p in qs
    ]

@api.get("/presupuestos/{presupuesto_id}", response=PresupuestoDetalleOut, tags=["Presupuestos"])
def obtener_presupuesto(request, presupuesto_id: int):
    return get_object_or_404(Presupuesto.objects.select_related('cliente', 'vehiculo').prefetch_related('items'), id=presupuesto_id, owner=request.user)

@api.post("/presupuestos/", response={201: PresupuestoDetalleOut, 400: ErrorSchema}, tags=["Presupuestos"])
def crear_presupuesto(request, payload: PresupuestoIn):
    try:
        with transaction.atomic():
            cliente, vehiculo = _resolver_entidades_express(payload, user=request.user)

            presupuesto = Presupuesto.objects.create(
                owner=request.user,
                cliente=cliente,
                vehiculo=vehiculo,
                resumen_corto=payload.resumen_corto,
                estado=payload.estado,
                descuento=Decimal(str(payload.descuento))
            )

            total_mo, total_rep = Decimal("0.00"), Decimal("0.00")
            for item in payload.items:
                cant = Decimal(str(item.cantidad))
                prec = Decimal(str(item.precio_unitario))
                subt = cant * prec
                PresupuestoItem.objects.create(presupuesto=presupuesto, tipo=item.tipo, descripcion=item.descripcion, cantidad=cant, precio_unitario=prec, subtotal=subt)
                if item.tipo == "MANO_OBRA": total_mo += subt
                else: total_rep += subt
            
            presupuesto.total_mano_obra = total_mo
            presupuesto.total_repuestos = total_rep
            presupuesto.total = (total_mo + total_rep) - presupuesto.descuento
            presupuesto.save()
            return 201, presupuesto
    except Exception as e: return 400, {"message": str(e)}

@api.put("/presupuestos/{presupuesto_id}", response={200: PresupuestoDetalleOut, 400: ErrorSchema}, tags=["Presupuestos"])
def editar_presupuesto(request, presupuesto_id: int, payload: PresupuestoIn):
    try:
        with transaction.atomic():
            presupuesto = get_object_or_404(Presupuesto, id=presupuesto_id, owner=request.user)
            presupuesto.resumen_corto = payload.resumen_corto
            presupuesto.estado = payload.estado
            presupuesto.descuento = Decimal(str(payload.descuento))

            presupuesto.items.all().delete()
            total_mo, total_rep = Decimal("0.00"), Decimal("0.00")
            for item in payload.items:
                cant = Decimal(str(item.cantidad))
                prec = Decimal(str(item.precio_unitario))
                subt = cant * prec
                PresupuestoItem.objects.create(presupuesto=presupuesto, tipo=item.tipo, descripcion=item.descripcion, cantidad=cant, precio_unitario=prec, subtotal=subt)
                if item.tipo == "MANO_OBRA": total_mo += subt
                else: total_rep += subt
            
            presupuesto.total_mano_obra = total_mo
            presupuesto.total_repuestos = total_rep
            presupuesto.total = (total_mo + total_rep) - presupuesto.descuento
            presupuesto.save()
            return 200, presupuesto
    except Exception as e: return 400, {"message": str(e)}

@api.patch("/presupuestos/{presupuesto_id}/estado", response={200: dict, 400: ErrorSchema}, tags=["Presupuestos"])
def actualizar_estado_presupuesto(request, presupuesto_id: int, payload: EstadoRapidoIn):
    presupuesto = get_object_or_404(Presupuesto, id=presupuesto_id, activo=True, owner=request.user)
    presupuesto.estado = payload.estado
    presupuesto.save(update_fields=["estado"])
    return 200, {"message": "Estado de presupuesto actualizado"}

@api.delete("/presupuestos/{presupuesto_id}", response={200: dict, 400: ErrorSchema}, tags=["Presupuestos"])
def eliminar_presupuesto(request, presupuesto_id: int):
    presupuesto = get_object_or_404(Presupuesto, id=presupuesto_id, activo=True, owner=request.user)
    presupuesto.enviar_a_eliminados() # Borrado Suave / Soft Delete
    return 200, {"message": "Presupuesto enviado a la papelera."}


# ==========================================
# 8. ENDPOINTS DE FINANZAS
# ==========================================

@api.post("/pagos/", response={201: RespuestaGenerica, 400: ErrorSchema}, tags=["Finanzas"])
def api_registrar_operacion_caja(request, payload: OperacionCajaIn):
    try:
        with transaction.atomic():
            cliente, _ = _resolver_entidades_express(payload, user=request.user)
            if not cliente:
                return 400, {"message": "Debe especificar un cliente o usar Alta Express."}

            monto_total = Decimal(str(payload.monto_total_venta))
            monto_pagado = Decimal(str(payload.monto_pagado))

            if monto_total <= 0 and monto_pagado <= 0: return 400, {"message": "Debe ingresar un monto válido."}

            desc = payload.descripcion.strip()

            if monto_total > 0:
                fecha_promesa_obj = None
                if payload.fecha_promesa: fecha_promesa_obj = datetime.strptime(payload.fecha_promesa, "%Y-%m-%d").date()
                MovimientoCuenta.objects.create(owner=request.user, cliente=cliente, tipo=MovimientoCuenta.TIPO_DEUDA, monto=monto_total, descripcion=f"Cargo: {desc}" if desc else "Venta Rápida / Fiado", fecha_promesa=fecha_promesa_obj)
                cliente.saldo_balance += monto_total

            if monto_pagado > 0:
                MovimientoCuenta.objects.create(owner=request.user, cliente=cliente, tipo=MovimientoCuenta.TIPO_PAGO, monto=monto_pagado, metodo_pago=payload.metodo_pago, descripcion=f"Abono: {desc}" if desc else "Abono en caja")
                cliente.saldo_balance -= monto_pagado
            
            cliente.save(update_fields=['saldo_balance'])
            return 201, {"message": "Operación exitosa.", "nuevo_saldo": float(cliente.saldo_balance)}
            
    except Exception as e: return 400, {"message": f"Falla interna: {str(e)}"}

@api.post("/compras/", response={201: RespuestaGenerica, 400: ErrorSchema}, tags=["Finanzas"])
def api_registrar_compra(request, payload: GastoIn):
    try:
        gasto = Gasto.objects.create(owner=request.user, tipo=payload.tipo, descripcion=payload.descripcion.strip(), monto=Decimal(str(payload.monto)), comprobante=payload.comprobante.strip())
        return 201, {"message": f"Gasto registrado (ID: {gasto.id})"}
    except Exception as e: return 400, {"message": f"Error: {str(e)}"}

@api.get("/clientes/{cliente_id}/movimientos", response=List[MovimientoCuentaOut], tags=["Directorio"])
def listar_movimientos_cliente(request, cliente_id: int):
    get_object_or_404(Cliente, id=cliente_id, owner=request.user)
    movimientos = MovimientoCuenta.objects.filter(owner=request.user, cliente_id=cliente_id).order_by('-fecha')[:100]
    return [
        {
            "id": m.id,
            "tipo": m.tipo,
            "monto": float(m.monto),
            "fecha": m.fecha,
            "descripcion": m.descripcion,
            "metodo_pago": m.metodo_pago,
            "fecha_promesa": str(m.fecha_promesa) if m.fecha_promesa else None,
        }
        for m in movimientos
    ]

@api.get("/finanzas/gastos", response=List[GastoOut], tags=["Finanzas"])
def listar_gastos(request):
    gastos = Gasto.objects.filter(owner=request.user).order_by('-fecha')[:100]
    return [
        {
            "id": g.id,
            "fecha": g.fecha,
            "tipo": g.tipo,
            "descripcion": g.descripcion,
            "monto": float(g.monto),
            "comprobante": g.comprobante,
        }
        for g in gastos
    ]

@api.get("/finanzas/caja", response=List[MovimientoCajaOut], tags=["Finanzas"])
def obtener_movimientos_caja(request):
    movimientos = []
    pagos = MovimientoCuenta.objects.select_related('cliente').filter(tipo=MovimientoCuenta.TIPO_PAGO, owner=request.user).order_by('-fecha')[:50]
    for pago in pagos:
        desc_clean = pago.descripcion.replace('Abono: ', '') if pago.descripcion else ''
        movimientos.append({"id": f"PAGO-{pago.id}", "fecha": pago.fecha, "tipo": "INGRESO", "concepto": f"Cobro a {pago.cliente.nombre_completo} {desc_clean and f'({desc_clean})'}", "monto": float(pago.monto), "metodo": pago.metodo_pago})

    gastos = Gasto.objects.filter(owner=request.user).order_by('-fecha')[:50]
    for gasto in gastos:
        movimientos.append({"id": f"GASTO-{gasto.id}", "fecha": gasto.fecha, "tipo": "EGRESO", "concepto": f"Compra/Gasto: {gasto.descripcion}", "monto": float(gasto.monto), "metodo": "EFECTIVO"})
    
    movimientos.sort(key=lambda x: x["fecha"], reverse=True)
    return movimientos[:100]


# ==========================================
# 9. PORTAL PÚBLICO
# ==========================================

@api.get("/public/presupuestos/{token}/", response=PublicPresupuestoOut, auth=None, tags=["Portal Publico"])
def obtener_presupuesto_publico(request, token: str):
    token_uuid = _parsear_token_publico(token)
    presupuesto = get_object_or_404(
        Presupuesto.objects.select_related("cliente", "vehiculo", "owner").prefetch_related("items"),
        token=token_uuid,
        activo=True,
    )
    return _serializar_presupuesto_publico(presupuesto)


@api.patch("/public/presupuestos/{token}/estado/", response=PublicPresupuestoOut, auth=None, tags=["Portal Publico"])
def actualizar_estado_presupuesto_publico(request, token: str, payload: EstadoRapidoIn):
    token_uuid = _parsear_token_publico(token)
    presupuesto = get_object_or_404(
        Presupuesto.objects.select_related("cliente", "vehiculo", "owner").prefetch_related("items"),
        token=token_uuid,
        activo=True,
    )

    if presupuesto.estado != "ENVIADO":
        raise HttpError(400, "Este presupuesto ya no admite cambios desde el portal.")

    if payload.estado not in {"APROBADO", "RECHAZADO"}:
        raise HttpError(400, "Solo se puede aprobar o rechazar desde el portal.")

    presupuesto.estado = payload.estado
    presupuesto.save(update_fields=["estado"])
    return _serializar_presupuesto_publico(presupuesto)


@api.get("/public/vehiculos/{token}/", response=PublicVehiculoOut, auth=None, tags=["Portal Publico"])
def obtener_vehiculo_publico(request, token: str):
    token_uuid = _parsear_token_publico(token)
    vehiculo = get_object_or_404(
        Vehiculo.objects.select_related("cliente", "owner").prefetch_related("trabajos"),
        token=token_uuid,
    )
    return _serializar_vehiculo_publico(vehiculo)

# ==========================================
# 10. AUTH ENDPOINTS
# ==========================================

class LoginIn(Schema):
    email: str
    password: str

class RegisterIn(Schema):
    email: str
    password: str
    nombre: str
    taller_nombre: str
    taller_ciudad: str = ""
    taller_tel: str = ""

class AuthOut(Schema):
    token: str
    user_id: int
    email: str
    nombre: str
    taller_nombre: str
    taller_ciudad: str = ""
    taller_tel: str = ""
    taller_id: Optional[int] = None
    trial_start: Optional[str] = None


class MessageOut(Schema):
    message: str


@api.post("/auth/login/", response=AuthOut, auth=None, tags=["Auth"])
def login_api(request, payload: LoginIn):
    """
    Login para el frontend Next.js.
    Devuelve un token de sesión que debe enviarse en cada request
    como: Authorization: Token <token>
    """
    identifier_raw = payload.email.strip()
    identifier_lower = identifier_raw.lower()
    user = None

    # 1. Registro nuevo: username=email normalizado
    for candidate in [identifier_lower, identifier_raw]:
        if not candidate:
            continue
        user = authenticate(request, username=candidate, password=payload.password)
        if user is not None:
            break

    # 2. Legacy: buscar por email aunque el username sea distinto
    if user is None:
        try:
            user_obj = User.objects.get(email__iexact=identifier_lower)
            user = authenticate(request, username=user_obj.username, password=payload.password)
        except User.DoesNotExist:
            pass

    # 3. Legacy fuerte: el usuario escribe username en el campo "email"
    if user is None:
        try:
            user_obj = User.objects.get(username__iexact=identifier_raw)
            user = authenticate(request, username=user_obj.username, password=payload.password)
        except User.DoesNotExist:
            pass

    if user is None or not user.is_active:
        raise HttpError(400, "Email, usuario o contraseña incorrectos")

    # Obtener o crear token para este usuario
    api_token, _ = ApiToken.objects.get_or_create(user=user)

    # Obtener perfil
    try:
        perfil = user.perfil
    except PerfilTaller.DoesNotExist:
        perfil = None

    return AuthOut(
        token=api_token.key,
        user_id=user.id,
        email=user.email or identifier_lower,
        nombre=perfil.nombre if perfil else (user.first_name or user.username),
        taller_nombre=perfil.taller_nombre if perfil else (user.last_name or "Mi Taller"),
        taller_ciudad=perfil.taller_ciudad if perfil else "",
        taller_tel=perfil.taller_tel if perfil else "",
        trial_start=perfil.trial_start.isoformat() if perfil else None,
    )


@api.post("/auth/logout/", response=MessageOut, tags=["Auth"])
def logout_api(request):
    api_token = getattr(request, "auth_token", None)
    if api_token is not None:
        api_token.delete()
    else:
        ApiToken.objects.filter(user=request.user).delete()
    return {"message": "Sesion cerrada correctamente"}


@api.post("/auth/rotate-token/", response=AuthOut, tags=["Auth"])
def rotate_token_api(request):
    api_token = getattr(request, "auth_token", None)
    if api_token is None:
        api_token, _ = ApiToken.objects.get_or_create(user=request.user)
    else:
        api_token.rotate()

    try:
        perfil = request.user.perfil
    except PerfilTaller.DoesNotExist:
        perfil = None

    return AuthOut(
        token=api_token.key,
        user_id=request.user.id,
        email=request.user.email or request.user.username,
        nombre=perfil.nombre if perfil else (request.user.first_name or request.user.username),
        taller_nombre=perfil.taller_nombre if perfil else (request.user.last_name or "Mi Taller"),
        taller_ciudad=perfil.taller_ciudad if perfil else "",
        taller_tel=perfil.taller_tel if perfil else "",
        trial_start=perfil.trial_start.isoformat() if perfil else None,
    )


@api.post("/auth/register/", response=AuthOut, auth=None, tags=["Auth"])
def register_api(request, payload: RegisterIn):
    """
    Registro de nuevo taller en el SaaS.
    Crea un User de Django + PerfilTaller + ApiToken y devuelve las credenciales.
    """
    email_lower = payload.email.strip().lower()

    if User.objects.filter(email__iexact=email_lower).exists():
        raise HttpError(400, "Ya existe una cuenta con ese email")

    with transaction.atomic():
        user = User.objects.create_user(
            username=email_lower,
            email=email_lower,
            password=payload.password,
            first_name=payload.nombre[:30] if payload.nombre else "",
        )
        perfil = PerfilTaller.objects.create(
            user=user,
            nombre=payload.nombre,
            taller_nombre=payload.taller_nombre,
            taller_ciudad=payload.taller_ciudad,
            taller_tel=payload.taller_tel,
        )
        api_token = ApiToken.objects.create(user=user)

    return AuthOut(
        token=api_token.key,
        user_id=user.id,
        email=user.email,
        nombre=perfil.nombre,
        taller_nombre=perfil.taller_nombre,
        taller_ciudad=perfil.taller_ciudad,
        taller_tel=perfil.taller_tel,
        trial_start=perfil.trial_start.isoformat(),
    )
