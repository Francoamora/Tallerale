# taller/api.py
from datetime import date, datetime, timedelta
import hashlib
import logging
import secrets
import warnings
from typing import List, Optional, Tuple
from decimal import Decimal
from uuid import UUID
import uuid

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.http import Http404
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import File, ModelSchema, NinjaAPI, Schema, Field
from ninja.errors import HttpError
from ninja.files import UploadedFile
from PIL import Image, UnidentifiedImageError

from .models import ApiToken, AuditoriaTaller, Cliente, Gasto, InvitacionTaller, MembresiaTaller, MovimientoCuenta, PerfilTaller, Presupuesto, PresupuestoItem, Producto, RecuperacionContrasena, Taller, Trabajo, TrabajoItem, Turno, Vehiculo
from .services import (
    crear_trabajo_completo,
    obtener_dashboard_snapshot,
    resolver_vehiculo_express_para_usuario,
)

logger = logging.getLogger(__name__)
LOGIN_MAX_ATTEMPTS = 5
LOGIN_RATE_WINDOW_SECONDS = 15 * 60

ROLE_CAPABILITIES = {
    MembresiaTaller.ROL_ADMIN: {"operar", "directorio", "gestionar_ordenes", "cobrar", "finanzas", "configuracion", "portal", "equipo"},
    MembresiaTaller.ROL_RECEPCION: {"operar", "directorio", "gestionar_ordenes", "cobrar"},
    MembresiaTaller.ROL_MECANICO: {"operar"},
    MembresiaTaller.ROL_CONTADOR: {"directorio", "cobrar", "finanzas"},
}


def require_capability(request, capability: str) -> None:
    """Autoriza en servidor. La UI nunca es la fuente de permisos."""
    membership = getattr(request, "membership", None)
    # Usuarios legacy sin membresía conservan el comportamiento previo hasta
    # que la migración les cree su organización y rol de administrador.
    if membership is None:
        return
    if capability not in ROLE_CAPABILITIES.get(membership.rol, set()):
        raise HttpError(403, "Tu rol no tiene permiso para realizar esta operación.")


def require_platform_admin(request) -> User:
    """Autoriza el centro de control global de Tallerista.

    ``request.user`` puede ser el dueño de un taller cuando quien se autentica
    es un miembro. Para este límite de plataforma importa el actor que presentó
    el token, no el tenant al que pertenece.
    """
    actor = getattr(request, "actor", request.user)
    if not actor.is_superuser:
        raise HttpError(403, "Este panel es exclusivo para soporte de Tallerista.")
    return actor


def _internal_error(context: str, error: Exception):
    """Registra el detalle en el servidor sin filtrarlo a un posible atacante."""
    logger.exception(context, exc_info=error)
    return 500, {"message": "No se pudo completar la operación. Intentá nuevamente."}

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
            api_token = ApiToken.objects.select_related("user").get(
                key=token,
                expires_at__gt=timezone.now(),
            )
        except ApiToken.DoesNotExist:
            return None

        # El actor puede ser un empleado; el scope de datos siempre es el dueño
        # del taller al que pertenece. Nunca se usa el usuario del empleado para
        # buscar datos de otro tenant.
        actor = api_token.user
        membresia = MembresiaTaller.objects.select_related("taller", "taller__owner").filter(user=actor, activo=True, taller__activo=True).first()
        if membresia:
            request.actor = actor
            request.membership = membresia
            request.user = membresia.taller.owner
        else:
            # Compatibilidad segura para dueños legacy sin perfil/membresía:
            # se les crea su organización aislada al iniciar una sesión válida.
            taller, _ = Taller.objects.get_or_create(
                owner=actor,
                defaults={"nombre": actor.first_name or "Mi Taller"},
            )
            membresia, _ = MembresiaTaller.objects.get_or_create(
                taller=taller,
                user=actor,
                defaults={"rol": MembresiaTaller.ROL_ADMIN},
            )
            request.actor = actor
            request.membership = membresia
            request.user = taller.owner

        # Self-heal: cualquier dueño de taller sin PerfilTaller (cuentas legacy,
        # superusuarios dados de alta por shell/admin, membresías "huecas" creadas
        # antes de que existiera este parche) recibe uno automáticamente acá.
        # Nadie debería necesitar tocar el admin de Django para "completar su perfil".
        owner = request.user
        perfil, _ = PerfilTaller.objects.get_or_create(
            user=owner,
            defaults={
                "nombre": owner.first_name or owner.username,
                "taller_nombre": owner.last_name or owner.first_name or "Mi Taller",
            },
        )

        # Puerta de acceso real: el trial de la UI se puede saltear apuntando
        # directo a la API, así que el corte tiene que vivir acá. Los
        # superusuarios (soporte/dueño del sistema) nunca quedan bloqueados.
        if not owner.is_superuser and not perfil.acceso_vigente:
            raise HttpError(402, "Tu prueba gratuita venció. Escribinos por WhatsApp para activar tu cuenta.")

        request.auth_token = api_token
        return api_token.user

# ==========================================
# CONFIGURACIÓN CORE DE LA API
# ==========================================
api = NinjaAPI(
    auth=TokenAuth(),
    title="Tallerista - Core API",
    version="7.2.0",
    description="Motor operativo multi-tenant. Cada usuario solo accede a sus propios datos.",
    docs_url="/docs" if settings.API_DOCS_ENABLED else None,
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
    cliente_nombre: str

    class Meta:
        model = Vehiculo
        fields = ["id", "token", "patente", "marca", "modelo", "anio", "color", "kilometraje_actual", "proximo_service_km"]


class ProductoOut(ModelSchema):
    class Meta:
        model = Producto
        fields = ["id", "codigo", "nombre", "stock_actual", "stock_minimo", "precio_costo", "precio_venta"]

class TrabajoItemOut(ModelSchema):
    class Meta:
        model = TrabajoItem
        fields = ["id", "tipo", "descripcion", "cantidad", "precio_unitario", "subtotal", "completado", "completado_en"]

class TrabajoRecienteOut(Schema):
    id: int
    estado: str
    fecha_ingreso: datetime
    total: float
    cliente_id: int
    cliente_nombre: str
    vehiculo: str
    patente: str
    resumen: str


class VehiculoHistorialTrabajoOut(Schema):
    id: int
    fecha_ingreso: datetime
    estado: str
    resumen: str
    kilometraje: int
    total: float


class VehiculoHistorialPresupuestoOut(Schema):
    id: int
    fecha_creacion: datetime
    estado: str
    resumen: str
    total: float


class VehiculoHistorialOut(Schema):
    vehiculo: VehiculoSchema
    trabajos: List[VehiculoHistorialTrabajoOut]
    presupuestos: List[VehiculoHistorialPresupuestoOut]

class TrabajoDetalleOut(Schema):
    id: int
    estado: str
    fecha_ingreso: datetime
    fecha_egreso_estimado: Optional[datetime]
    iniciado_en: Optional[datetime]
    finalizado_en: Optional[datetime]
    responsable_nombre: str
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
    metodo_pago: str
    registrado_por: str

class CategoriaGastoResumenOut(Schema):
    tipo: str
    total: float
    cantidad: int

class GastosResumenOut(Schema):
    mes_actual: float
    mes_anterior: float
    total_periodo: float
    cantidad_periodo: int
    por_tipo: List[CategoriaGastoResumenOut]

class CajaResumenOut(Schema):
    ingresos: float
    egresos: float
    resultado: float
    cantidad_movimientos: int

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
    portal_activo: bool
    portal_expires_at: datetime
    cliente: Optional[ClienteSchema] = None
    vehiculo: Optional[VehiculoSchema] = None
    items: List[PresupuestoItemOut]

class RespuestaGenerica(Schema):
    message: str
    nuevo_saldo: Optional[float] = None

class ErrorSchema(Schema):
    message: str

class AvisoOut(Schema):
    tipo: str
    prioridad: str
    titulo: str
    detalle: str
    mensaje: str
    href: str
    telefono: Optional[str] = None


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
    taller_logo_url: Optional[str] = None


class PublicTrabajoItemOut(Schema):
    """Parte visible para el cliente: sin precios ni notas internas."""
    descripcion: str
    cantidad: float


class PublicTrabajoResumenOut(Schema):
    id: int
    fecha_realizado: datetime
    estado: str
    resumen_trabajos: str
    kilometraje: int
    recomendaciones_proximo_service: Optional[str] = None
    items: List[PublicTrabajoItemOut]


class PublicMovimientoCuentaOut(Schema):
    fecha: datetime
    tipo: str
    monto: float
    descripcion: str
    fecha_promesa: Optional[date] = None


class PublicVehiculoOut(Schema):
    token: str
    patente: str
    marca: str
    modelo: str
    anio: Optional[int] = None
    color: Optional[str] = None
    kilometraje_actual: int
    proximo_service_km: Optional[int] = None
    proximo_service_fecha: Optional[date] = None
    cliente_nombre: str
    historial: List[PublicTrabajoResumenOut]
    saldo_pendiente: float
    movimientos_cuenta: List[PublicMovimientoCuentaOut]
    taller_nombre: Optional[str] = None
    taller_tel: Optional[str] = None
    taller_logo_url: Optional[str] = None

# ==========================================
# 2. SCHEMAS DE ACCIÓN (Input)
# ==========================================

class ClienteExpressIn(Schema):
    nombre: str = Field(..., example="Juan Pérez")
    telefono: Optional[str] = Field(default="", example="342-155123456")

class ClienteUpdateIn(Schema):
    nombre: str = Field(..., example="Juan Pérez")
    apellido: str = ""
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

class VehiculoAltaCompletaIn(Schema):
    patente: str = Field(..., example="AB123CD")
    marca: str = Field(..., example="Toyota")
    modelo: str = Field(default="S/D", example="Corolla")
    anio: Optional[int] = None
    color: str = ""
    kilometraje_actual: int = Field(default=0, ge=0)
    proximo_service_km: Optional[int] = Field(default=None, ge=0)


class AltaDirectorioIn(Schema):
    cliente: ClienteIn
    vehiculo: VehiculoAltaCompletaIn


class AltaDirectorioOut(Schema):
    cliente: ClienteSchema
    vehiculo: VehiculoSchema


class ProductoIn(Schema):
    codigo: str = Field(..., min_length=1, max_length=50)
    nombre: str = Field(..., min_length=1, max_length=200)
    stock_actual: float = Field(default=0, ge=0)
    stock_minimo: float = Field(default=0, ge=0)
    precio_costo: float = Field(default=0, ge=0)
    precio_venta: float = Field(default=0, ge=0)

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
    presupuesto_origen_id: Optional[int] = None
    items: List[TrabajoItemIn]

class EstadoRapidoIn(Schema):
    estado: str = Field(..., description="Nuevo estado (aplica a Trabajos, Turnos o Presupuestos)")
    motivo: str = ""


class ItemCompletadoIn(Schema):
    completado: bool


class PortalAccessIn(Schema):
    activo: bool
    regenerar_token: bool = False

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
    metodo_pago: str = "EFECTIVO"
    fecha: Optional[date] = None


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


def _perfil_taller_desde_owner(request, owner) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    if not owner:
        return None, None, None

    try:
        perfil = owner.perfil
    except PerfilTaller.DoesNotExist:
        return None, None, None

    return perfil.taller_nombre, perfil.taller_tel or None, _logo_url(request, perfil)


def _serializar_presupuesto_publico(request, presupuesto: Presupuesto) -> PublicPresupuestoOut:
    taller_nombre, taller_tel, taller_logo_url = _perfil_taller_desde_owner(request, presupuesto.owner)
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
        taller_logo_url=taller_logo_url,
    )


def _serializar_vehiculo_publico(request, vehiculo: Vehiculo) -> PublicVehiculoOut:
    taller_nombre, taller_tel, taller_logo_url = _perfil_taller_desde_owner(request, vehiculo.owner)
    historial = [
        PublicTrabajoResumenOut(
            id=trabajo.id,
            fecha_realizado=(trabajo.fecha_egreso_real or trabajo.finalizado_en or trabajo.fecha_ingreso),
            estado=trabajo.estado,
            resumen_trabajos=trabajo.resumen_trabajos,
            kilometraje=trabajo.kilometraje,
            recomendaciones_proximo_service=trabajo.recomendaciones_proximo_service or None,
            items=[
                PublicTrabajoItemOut(
                    descripcion=item.descripcion,
                    cantidad=float(item.cantidad),
                )
                for item in trabajo.items.all()
                if item.completado
            ],
        )
        for trabajo in (
            vehiculo.trabajos.filter(
                activo=True,
                estado__in=[Trabajo.ESTADO_FINALIZADO, Trabajo.ESTADO_ENTREGADO],
            )
            .prefetch_related("items")
            .order_by("-finalizado_en", "-fecha_ingreso")
        )
    ]
    movimientos_cuenta = [
        PublicMovimientoCuentaOut(
            fecha=movimiento.fecha,
            tipo=movimiento.tipo,
            monto=float(movimiento.monto),
            descripcion=movimiento.descripcion,
            fecha_promesa=movimiento.fecha_promesa,
        )
        for movimiento in vehiculo.cliente.movimientos_cuenta.all().order_by("-fecha")[:20]
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
        proximo_service_fecha=vehiculo.proximo_service_fecha,
        cliente_nombre=vehiculo.cliente.nombre_completo,
        historial=historial,
        saldo_pendiente=float(vehiculo.cliente.saldo_balance),
        movimientos_cuenta=movimientos_cuenta,
        taller_nombre=taller_nombre,
        taller_tel=taller_tel,
        taller_logo_url=taller_logo_url,
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


class ClienteSinActividadOut(Schema):
    id: int
    nombre: str
    ultimo_trabajo: Optional[datetime] = None
    telefono: str

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
    clientes_sin_actividad_total: int
    clientes_sin_actividad: List[ClienteSinActividadOut]


# ==========================================
# 4. ENDPOINTS ANALÍTICOS Y DIRECTORIO
# ==========================================

@api.get("/dashboard/stats", response=EstadisticasDashboardOut, tags=["Analitica"], summary="Métricas en tiempo real")
def api_dashboard_stats(request):
    snapshot = obtener_dashboard_snapshot(user=request.user)
    membership = getattr(request, "membership", None)
    rol = membership.rol if membership else MembresiaTaller.ROL_ADMIN

    # El dashboard también es una frontera de autorización: no alcanza con
    # ocultar tarjetas en React porque un usuario podría consultar la API.
    if rol in {MembresiaTaller.ROL_MECANICO, MembresiaTaller.ROL_RECEPCION}:
        snapshot["ingresos_mes_actual"] = 0
        snapshot["cuenta_corriente_pendiente"] = 0
        snapshot["ticket_promedio"] = 0
        snapshot["ingresos_mensuales"] = []
        snapshot["trabajos_recientes"] = [
            {**trabajo, "total": 0}
            for trabajo in snapshot["trabajos_recientes"]
        ]

    # Contaduría ve el panorama económico, pero no necesita identidades,
    # patentes, agenda ni historial técnico de clientes.
    if rol == MembresiaTaller.ROL_CONTADOR:
        snapshot["trabajos_recientes"] = []
        snapshot["alertas_service"] = []
        snapshot["turnos_proximos"] = []
        snapshot["clientes_sin_actividad_total"] = 0
        snapshot["clientes_sin_actividad"] = []

    return snapshot

@api.get("/avisos", response=List[AvisoOut], tags=["Avisos"])
def listar_avisos(request):
    require_capability(request, "operar")
    hoy = timezone.localdate()
    manana = hoy + timedelta(days=1)
    avisos = []
    membership = getattr(request, "membership", None)
    rol = membership.rol if membership else MembresiaTaller.ROL_ADMIN
    puede_gestionar_presupuestos = rol in {MembresiaTaller.ROL_ADMIN, MembresiaTaller.ROL_RECEPCION}
    puede_ver_saldos = rol == MembresiaTaller.ROL_ADMIN
    for turno in Turno.objects.select_related("cliente", "vehiculo").filter(owner=request.user, fecha_hora__date=manana, estado__in=["PENDIENTE", "CONFIRMADO"]):
        nombre = turno.cliente.nombre_completo if turno.cliente else "cliente"
        vehiculo = turno.vehiculo.patente if turno.vehiculo else "vehículo"
        hora = timezone.localtime(turno.fecha_hora).strftime("%H:%M")
        avisos.append({"tipo":"TURNO","prioridad":"ALTA","titulo":f"Turno mañana · {hora}","detalle":f"{nombre} · {vehiculo}","mensaje":f"Hola {nombre}, te recordamos tu turno mañana a las {hora}.","href":"/turnos", "telefono": turno.cliente.telefono if turno.cliente else None})
    if puede_gestionar_presupuestos:
        for presupuesto in Presupuesto.objects.select_related("cliente", "vehiculo").filter(owner=request.user, activo=True, estado="ENVIADO")[:20]:
            nombre = presupuesto.cliente.nombre_completo if presupuesto.cliente else "cliente"
            avisos.append({"tipo":"PRESUPUESTO","prioridad":"MEDIA","titulo":"Presupuesto pendiente","detalle":f"P-{presupuesto.id} · {nombre}","mensaje":f"Hola {nombre}, quedamos atentos a tu respuesta sobre el presupuesto enviado.","href":f"/presupuestos/{presupuesto.id}", "telefono": presupuesto.cliente.telefono if presupuesto.cliente else None})
    for trabajo in Trabajo.objects.select_related("cliente", "vehiculo").filter(owner=request.user, activo=True, estado="FINALIZADO")[:20]:
        nombre = trabajo.cliente.nombre_completo
        avisos.append({"tipo":"RETIRO","prioridad":"MEDIA","titulo":"Vehículo listo para retirar","detalle":f"{trabajo.vehiculo.patente} · {nombre}","mensaje":f"Hola {nombre}, tu {trabajo.vehiculo.patente} ya está listo para retirar.","href":f"/trabajos/{trabajo.id}", "telefono": trabajo.cliente.telefono})

    limite_fecha_service = hoy + timedelta(days=14)
    vehiculos = Vehiculo.objects.select_related("cliente").filter(owner=request.user).order_by("patente")
    for vehiculo in vehiculos:
        faltan_km = (
            vehiculo.proximo_service_km - vehiculo.kilometraje_actual
            if vehiculo.proximo_service_km is not None else None
        )
        service_por_km = faltan_km is not None and faltan_km <= 2500
        service_por_fecha = bool(
            vehiculo.proximo_service_fecha
            and vehiculo.proximo_service_fecha <= limite_fecha_service
        )
        if not service_por_km and not service_por_fecha:
            continue

        motivos = []
        if service_por_km:
            motivos.append("service vencido" if faltan_km <= 0 else f"service en {faltan_km:,} km".replace(",", "."))
        if service_por_fecha:
            motivos.append(f"fecha {vehiculo.proximo_service_fecha.strftime('%d/%m/%Y')}")
        nombre = vehiculo.cliente.nombre_completo
        avisos.append({
            "tipo": "SERVICE",
            "prioridad": "ALTA" if (service_por_km and faltan_km <= 0) or (vehiculo.proximo_service_fecha and vehiculo.proximo_service_fecha <= hoy) else "MEDIA",
            "titulo": "Recordatorio de service",
            "detalle": f"{vehiculo.patente} · {nombre} · {' · '.join(motivos)}",
            "mensaje": f"Hola {nombre.split()[0]}! Te recordamos que tu {vehiculo.marca} {vehiculo.modelo} ({vehiculo.patente}) tiene {motivos[0]}. Cuando quieras coordinamos el próximo service.",
            "href": f"/vehiculos/{vehiculo.id}/historial",
            "telefono": vehiculo.cliente.telefono,
        })

    if puede_ver_saldos:
        for cliente in Cliente.objects.filter(owner=request.user, saldo_balance__gt=0).order_by("-saldo_balance")[:20]:
            avisos.append({
                "tipo": "DEUDA",
                "prioridad": "ALTA" if cliente.saldo_balance >= Decimal("100000") else "MEDIA",
                "titulo": "Saldo pendiente",
                "detalle": f"{cliente.nombre_completo} · ${cliente.saldo_balance:,.0f}".replace(",", "."),
                "mensaje": f"Hola {cliente.nombre_completo.split()[0]}! Te compartimos que tenés un saldo pendiente de ${cliente.saldo_balance:,.0f} con el taller. Si necesitás el detalle, escribinos.".replace(",", "."),
                "href": "/clientes",
                "telefono": cliente.telefono,
            })
    return avisos[:40]

@api.get("/clientes", response=List[ClienteSchema], tags=["Directorio"])
def listar_clientes(request, q: Optional[str] = None):
    require_capability(request, "directorio")
    qs = Cliente.objects.filter(owner=request.user)
    if q:
        qs = qs.filter(Q(nombre__icontains=q) | Q(apellido__icontains=q) | Q(dni__icontains=q))
    return qs

@api.get("/clientes/{cliente_id}", response=ClienteSchema, tags=["Directorio"])
def obtener_cliente(request, cliente_id: int):
    require_capability(request, "directorio")
    return get_object_or_404(Cliente, id=cliente_id, owner=request.user)

@api.post("/clientes/", response={201: ClienteSchema, 400: ErrorSchema}, tags=["Directorio"])
def crear_cliente(request, payload: ClienteIn):
    require_capability(request, "gestionar_ordenes")
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
    except Exception as error:
        return _internal_error("Error al crear cliente", error)

@api.post("/directorio/alta-completa", response={201: AltaDirectorioOut, 400: ErrorSchema}, tags=["Directorio"])
def crear_cliente_con_vehiculo(request, payload: AltaDirectorioIn):
    require_capability(request, "gestionar_ordenes")
    nombre = payload.cliente.nombre.strip()
    patente = "".join(payload.vehiculo.patente.split()).upper()
    marca = payload.vehiculo.marca.strip()

    if not nombre:
        return 400, {"message": "El nombre del cliente es obligatorio."}
    if not patente:
        return 400, {"message": "La patente es obligatoria."}
    if not marca:
        return 400, {"message": "La marca del vehículo es obligatoria."}
    if Vehiculo.objects.filter(owner=request.user, patente=patente).exists():
        return 400, {"message": f"La patente {patente} ya está registrada en tu taller."}

    try:
        with transaction.atomic():
            cliente = Cliente.objects.create(
                owner=request.user,
                nombre=nombre,
                apellido=payload.cliente.apellido.strip(),
                telefono=payload.cliente.telefono.strip(),
                email=payload.cliente.email.strip(),
                dni=payload.cliente.dni.strip(),
            )
            vehiculo = Vehiculo.objects.create(
                owner=request.user,
                cliente=cliente,
                patente=patente,
                marca=marca,
                modelo=payload.vehiculo.modelo.strip() or "S/D",
                anio=payload.vehiculo.anio,
                color=payload.vehiculo.color.strip(),
                kilometraje_actual=payload.vehiculo.kilometraje_actual,
                proximo_service_km=payload.vehiculo.proximo_service_km,
            )
        return 201, {"cliente": cliente, "vehiculo": vehiculo}
    except Exception as error:
        return _internal_error("Error al crear cliente y vehículo", error)

@api.put("/clientes/{cliente_id}", response={200: ClienteSchema, 400: ErrorSchema}, tags=["Directorio"])
def actualizar_cliente(request, cliente_id: int, payload: ClienteUpdateIn):
    require_capability(request, "gestionar_ordenes")
    try:
        cliente = get_object_or_404(Cliente, id=cliente_id, owner=request.user)
        cliente.nombre = payload.nombre
        cliente.apellido = payload.apellido
        cliente.telefono = payload.telefono
        cliente.email = payload.email
        cliente.dni = payload.dni
        cliente.save(update_fields=['nombre', 'apellido', 'telefono', 'email', 'dni'])
        return 200, cliente
    except Exception as error:
        return _internal_error("Error al actualizar cliente", error)

@api.get("/vehiculos", response=List[VehiculoSchema], tags=["Directorio"])
def listar_vehiculos(request, q: Optional[str] = None, cliente_id: Optional[int] = None):
    require_capability(request, "operar")
    qs = Vehiculo.objects.select_related('cliente').filter(owner=request.user)
    if cliente_id:
        qs = qs.filter(cliente_id=cliente_id)
    if q:
        qs = qs.filter(
            Q(patente__icontains=q)
            | Q(marca__icontains=q)
            | Q(modelo__icontains=q)
            | Q(cliente__nombre__icontains=q)
            | Q(cliente__apellido__icontains=q)
        )
    return qs


@api.get("/productos", response=List[ProductoOut], tags=["Inventario"])
def listar_productos(request, q: Optional[str] = None):
    productos = Producto.objects.filter(owner=request.user)
    if q:
        productos = productos.filter(Q(codigo__icontains=q) | Q(nombre__icontains=q))
    return productos.order_by("nombre")


@api.post("/productos/", response={201: ProductoOut, 400: ErrorSchema}, tags=["Inventario"])
def crear_producto(request, payload: ProductoIn):
    codigo = payload.codigo.strip().upper()
    if Producto.objects.filter(owner=request.user, codigo=codigo).exists():
        return 400, {"message": "Ya existe un producto con ese código en tu taller."}
    producto = Producto.objects.create(
        owner=request.user,
        codigo=codigo,
        nombre=payload.nombre.strip(),
        stock_actual=Decimal(str(payload.stock_actual)),
        stock_minimo=Decimal(str(payload.stock_minimo)),
        precio_costo=Decimal(str(payload.precio_costo)),
        precio_venta=Decimal(str(payload.precio_venta)),
    )
    return 201, producto

@api.post("/vehiculos/", response={201: VehiculoSchema, 400: ErrorSchema}, tags=["Directorio"])
def crear_vehiculo(request, payload: VehiculoIn):
    require_capability(request, "gestionar_ordenes")
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
    except Exception as error:
        return _internal_error("Error al crear vehículo", error)

@api.get("/vehiculos/{vehiculo_id}", response=VehiculoSchema, tags=["Directorio"])
def obtener_vehiculo(request, vehiculo_id: int):
    require_capability(request, "operar")
    return get_object_or_404(Vehiculo.objects.select_related('cliente'), id=vehiculo_id, owner=request.user)


@api.get("/vehiculos/{vehiculo_id}/historial/", response=VehiculoHistorialOut, tags=["Directorio"])
def obtener_historial_vehiculo(request, vehiculo_id: int):
    """Historial operativo y comercial del vehículo dentro de su propio taller."""
    require_capability(request, "operar")
    vehiculo = get_object_or_404(Vehiculo.objects.select_related("cliente"), id=vehiculo_id, owner=request.user)
    include_amounts = _puede_ver_importes_operativos(request)
    trabajos = Trabajo.objects.filter(owner=request.user, vehiculo=vehiculo, activo=True).order_by("-fecha_ingreso")
    presupuestos = Presupuesto.objects.filter(owner=request.user, vehiculo=vehiculo, activo=True).order_by("-fecha_creacion")
    return {
        "vehiculo": vehiculo,
        "trabajos": [
            {
                "id": trabajo.id,
                "fecha_ingreso": trabajo.fecha_ingreso,
                "estado": trabajo.estado,
                "resumen": trabajo.resumen_trabajos,
                "kilometraje": trabajo.kilometraje,
                "total": float(trabajo.total) if include_amounts else 0,
            }
            for trabajo in trabajos
        ],
        "presupuestos": [
            {
                "id": presupuesto.id,
                "fecha_creacion": presupuesto.fecha_creacion,
                "estado": presupuesto.estado,
                "resumen": presupuesto.resumen_corto,
                "total": float(presupuesto.total) if include_amounts else 0,
            }
            for presupuesto in presupuestos
        ],
    }


# ==========================================
# 5. ENDPOINTS DE OPERACIONES (TRABAJOS)
# ==========================================

def _puede_ver_importes_operativos(request) -> bool:
    membership = getattr(request, "membership", None)
    return membership is None or membership.rol in {
        MembresiaTaller.ROL_ADMIN,
        MembresiaTaller.ROL_RECEPCION,
    }


def _detalle_trabajo_payload(trabajo: Trabajo, include_amounts: bool) -> dict:
    return {
        "id": trabajo.id,
        "estado": trabajo.estado,
        "fecha_ingreso": trabajo.fecha_ingreso,
        "fecha_egreso_estimado": trabajo.fecha_egreso_estimado,
        "iniciado_en": trabajo.iniciado_en,
        "finalizado_en": trabajo.finalizado_en,
        "responsable_nombre": (
            trabajo.responsable.get_full_name()
            or trabajo.responsable.email
            or trabajo.responsable.username
        ) if trabajo.responsable else "",
        "kilometraje": trabajo.kilometraje,
        "resumen_trabajos": trabajo.resumen_trabajos,
        "observaciones_cliente": trabajo.observaciones_cliente,
        "observaciones_internas": trabajo.observaciones_internas,
        "estado_general": trabajo.estado_general,
        "estado_cubiertas_trabajo": trabajo.estado_cubiertas_trabajo,
        "recomendaciones_proximo_service": trabajo.recomendaciones_proximo_service,
        "proximo_control_km": trabajo.proximo_control_km,
        "total_mano_obra": float(trabajo.total_mano_obra) if include_amounts else 0,
        "total_repuestos": float(trabajo.total_repuestos) if include_amounts else 0,
        "descuento": float(trabajo.descuento) if include_amounts else 0,
        "total": float(trabajo.total) if include_amounts else 0,
        "cliente": {
            "id": trabajo.cliente.id,
            "nombre": trabajo.cliente.nombre,
            "apellido": trabajo.cliente.apellido,
            "nombre_completo": trabajo.cliente.nombre_completo,
            "telefono": trabajo.cliente.telefono,
            "email": trabajo.cliente.email,
            "dni": trabajo.cliente.dni,
            "saldo_balance": float(trabajo.cliente.saldo_balance) if include_amounts else 0,
        },
        "vehiculo": trabajo.vehiculo,
        "items": [
            {
                "id": item.id,
                "tipo": item.tipo,
                "descripcion": item.descripcion,
                "cantidad": float(item.cantidad),
                "precio_unitario": float(item.precio_unitario) if include_amounts else 0,
                "subtotal": float(item.subtotal) if include_amounts else 0,
                "completado": item.completado,
                "completado_en": item.completado_en,
            }
            for item in trabajo.items.all()
        ],
    }


@api.get("/trabajos/", response=List[TrabajoRecienteOut], tags=["Operaciones"])
def api_listar_trabajos(request, q: Optional[str] = None, cliente_id: Optional[int] = None):
    require_capability(request, "operar")
    include_amounts = _puede_ver_importes_operativos(request)
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
            "total": float(t.total) if include_amounts else 0,
            "cliente_id": t.cliente_id,
            "cliente_nombre": t.cliente.nombre_completo,
            "vehiculo": f"{t.vehiculo.marca} {t.vehiculo.modelo}",
            "patente": t.vehiculo.patente,
            "resumen": t.resumen_trabajos,
        } for t in qs.order_by("-fecha_ingreso")
    ]

@api.get("/trabajos/tablero", response=dict, tags=["Operaciones"], summary="Datos para Tablero Kanban")
def api_tablero_trabajos(request):
    require_capability(request, "operar")
    ahora = timezone.now()
    include_amounts = _puede_ver_importes_operativos(request)
    qs = Trabajo.objects.select_related('cliente', 'vehiculo', 'responsable').prefetch_related("items").filter(activo=True, owner=request.user).exclude(estado=Trabajo.ESTADO_ANULADO)

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
            "total": float(t.total) if include_amounts else 0,
            "fecha_ingreso": t.fecha_ingreso,
            "resumen_corto": resumen,
            "dias_en_taller": dias,
            "items_total": len(t.items.all()),
            "items_completados": sum(1 for item in t.items.all() if item.completado),
            "responsable_nombre": (
                t.responsable.get_full_name()
                or t.responsable.email
                or t.responsable.username
            ) if t.responsable else "",
            "iniciado_en": t.iniciado_en,
        }

        if t.estado == Trabajo.ESTADO_ENTREGADO:
            fecha_ref = t.fecha_egreso_real if t.fecha_egreso_real else t.fecha_ingreso
            if (ahora - fecha_ref).days > 2:
                continue

        if t.estado in tablero:
            tablero[t.estado]["trabajos"].append(item)
            tablero[t.estado]["total_plata"] += float(t.total) if include_amounts else 0

    for estado in tablero:
        tablero[estado]["trabajos"].sort(key=lambda x: x["fecha_ingreso"])

    return tablero

@api.get("/trabajos/{trabajo_id}", response=TrabajoDetalleOut, tags=["Operaciones"])
def api_detalle_trabajo(request, trabajo_id: int):
    require_capability(request, "operar")
    trabajo = get_object_or_404(
        Trabajo.objects.select_related('cliente', 'vehiculo', 'responsable').prefetch_related('items'),
        id=trabajo_id,
        activo=True,
        owner=request.user,
    )
    return _detalle_trabajo_payload(trabajo, _puede_ver_importes_operativos(request))

@api.post("/trabajos/", response={201: TrabajoDetalleOut, 400: ErrorSchema, 422: ErrorSchema, 500: ErrorSchema}, tags=["Operaciones"])
def api_crear_trabajo(request, payload: TrabajoIn):
    require_capability(request, "gestionar_ordenes")
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
            presupuesto_origen_id=data.get('presupuesto_origen_id'),
        )
        return 201, trabajo
    except Vehiculo.DoesNotExist: return 400, {"message": "El vehículo no existe."}
    except DjangoValidationError as e: return 400, {"message": e.messages[0] if hasattr(e, 'messages') else str(e)}
    except Exception as error:
        return _internal_error("Error al crear trabajo", error)

@api.put("/trabajos/{trabajo_id}", response={200: TrabajoDetalleOut, 400: ErrorSchema}, tags=["Operaciones"])
def api_editar_trabajo(request, trabajo_id: int, payload: TrabajoIn):
    require_capability(request, "gestionar_ordenes")
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
    except Exception as error:
        return _internal_error("Error al actualizar trabajo", error)

@api.delete("/trabajos/{trabajo_id}", response={200: dict, 400: ErrorSchema}, tags=["Operaciones"])
def api_eliminar_trabajo(request, trabajo_id: int):
    require_capability(request, "gestionar_ordenes")
    trabajo = get_object_or_404(Trabajo, id=trabajo_id, activo=True, owner=request.user)
    trabajo.enviar_a_eliminados() 
    return 200, {"message": "Orden enviada a la papelera."}

@api.patch("/trabajos/{trabajo_id}/estado", response={200: dict, 400: ErrorSchema}, tags=["Operaciones"])
def api_actualizar_estado_trabajo(request, trabajo_id: int, payload: EstadoRapidoIn):
    require_capability(request, "operar")
    if payload.estado in {Trabajo.ESTADO_ENTREGADO, Trabajo.ESTADO_ANULADO}:
        require_capability(request, "gestionar_ordenes")
    trabajo = get_object_or_404(Trabajo, id=trabajo_id, activo=True, owner=request.user)
    estados_validos = dict(Trabajo.ESTADO_CHOICES).keys()
    if payload.estado not in estados_validos: return 400, {"message": "Estado inválido."}

    transiciones_validas = {
        Trabajo.ESTADO_INGRESADO: {Trabajo.ESTADO_EN_PROCESO, Trabajo.ESTADO_ANULADO},
        Trabajo.ESTADO_EN_PROCESO: {Trabajo.ESTADO_INGRESADO, Trabajo.ESTADO_FINALIZADO, Trabajo.ESTADO_ANULADO},
        Trabajo.ESTADO_FINALIZADO: {Trabajo.ESTADO_EN_PROCESO, Trabajo.ESTADO_ENTREGADO, Trabajo.ESTADO_ANULADO},
        Trabajo.ESTADO_ENTREGADO: set(),
        Trabajo.ESTADO_ANULADO: set(),
    }
    if payload.estado != trabajo.estado and payload.estado not in transiciones_validas.get(trabajo.estado, set()):
        return 400, {"message": "Ese cambio saltea pasos del flujo operativo."}
    if payload.estado in {Trabajo.ESTADO_FINALIZADO, Trabajo.ESTADO_ENTREGADO} and trabajo.items.filter(completado=False).exists():
        return 400, {"message": "Completá el checklist antes de cerrar esta etapa."}

    estado_anterior = trabajo.estado
    trabajo.estado = payload.estado
    update_fields = ["estado", "fecha_egreso_real"]
    if payload.estado == Trabajo.ESTADO_EN_PROCESO and not trabajo.iniciado_en:
        trabajo.iniciado_en = timezone.now()
        trabajo.responsable = getattr(request, "actor", None)
        update_fields.extend(["iniciado_en", "responsable"])
    if payload.estado == Trabajo.ESTADO_FINALIZADO:
        trabajo.finalizado_en = timezone.now()
        update_fields.append("finalizado_en")
        # Al cerrar técnicamente una OT, su lectura pasa a ser la referencia
        # vigente del legajo: odómetro actual y próximo control recomendado.
        vehiculo = trabajo.vehiculo
        vehiculo.kilometraje_actual = max(vehiculo.kilometraje_actual or 0, trabajo.kilometraje or 0)
        campos_vehiculo = ["kilometraje_actual"]
        if trabajo.proximo_control_km:
            vehiculo.proximo_service_km = trabajo.proximo_control_km
            campos_vehiculo.append("proximo_service_km")
        vehiculo.save(update_fields=campos_vehiculo)
    elif estado_anterior == Trabajo.ESTADO_FINALIZADO:
        trabajo.finalizado_en = None
        update_fields.append("finalizado_en")
    if payload.estado == Trabajo.ESTADO_ENTREGADO:
        trabajo.fecha_egreso_real = timezone.now()
    elif estado_anterior == Trabajo.ESTADO_ENTREGADO:
        trabajo.fecha_egreso_real = None
    trabajo.save(update_fields=list(dict.fromkeys(update_fields)))
    membership = getattr(request, "membership", None)
    if membership:
        AuditoriaTaller.objects.create(
            taller=membership.taller,
            actor=getattr(request, "actor", None),
            accion="TRABAJO_ESTADO",
            detalle=f"OT-{trabajo.id}: {estado_anterior} → {trabajo.estado}",
        )
    return 200, {"message": "Estado actualizado", "nuevo_estado": trabajo.estado}


@api.patch("/trabajos/{trabajo_id}/items/{item_id}/completado", response={200: dict, 400: ErrorSchema}, tags=["Operaciones"])
def api_actualizar_item_trabajo(request, trabajo_id: int, item_id: int, payload: ItemCompletadoIn):
    require_capability(request, "operar")
    trabajo = get_object_or_404(Trabajo, id=trabajo_id, activo=True, owner=request.user)
    if trabajo.estado in {Trabajo.ESTADO_ENTREGADO, Trabajo.ESTADO_ANULADO}:
        return 400, {"message": "La orden está cerrada y su checklist no puede modificarse."}
    item = get_object_or_404(TrabajoItem, id=item_id, trabajo=trabajo)
    item.completado = payload.completado
    item.completado_en = timezone.now() if payload.completado else None
    item.completado_por = getattr(request, "actor", None) if payload.completado else None
    item.save(update_fields=["completado", "completado_en", "completado_por"])
    total = trabajo.items.count()
    completados = trabajo.items.filter(completado=True).count()
    membership = getattr(request, "membership", None)
    if membership:
        AuditoriaTaller.objects.create(
            taller=membership.taller,
            actor=getattr(request, "actor", None),
            accion="CHECKLIST_TRABAJO",
            detalle=f"OT-{trabajo.id}: {'completó' if payload.completado else 'reabrió'} {item.descripcion[:120]}",
        )
    return 200, {
        "id": item.id,
        "completado": item.completado,
        "completado_en": item.completado_en,
        "items_total": total,
        "items_completados": completados,
    }


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
    except Exception as error:
        return _internal_error("Error al crear turno", error)

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
    except Exception as error:
        return _internal_error("Error al actualizar turno", error)

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
    require_capability(request, "gestionar_ordenes")
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
    require_capability(request, "gestionar_ordenes")
    return get_object_or_404(Presupuesto.objects.select_related('cliente', 'vehiculo').prefetch_related('items'), id=presupuesto_id, owner=request.user)

@api.post("/presupuestos/", response={201: PresupuestoDetalleOut, 400: ErrorSchema}, tags=["Presupuestos"])
def crear_presupuesto(request, payload: PresupuestoIn):
    require_capability(request, "gestionar_ordenes")
    try:
        if payload.estado not in dict(Presupuesto.ESTADO_CHOICES):
            return 400, {"message": "El estado indicado no corresponde a un presupuesto."}
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
    except Exception as error:
        return _internal_error("Error al crear presupuesto", error)

@api.put("/presupuestos/{presupuesto_id}", response={200: PresupuestoDetalleOut, 400: ErrorSchema}, tags=["Presupuestos"])
def editar_presupuesto(request, presupuesto_id: int, payload: PresupuestoIn):
    require_capability(request, "gestionar_ordenes")
    try:
        if payload.estado not in dict(Presupuesto.ESTADO_CHOICES):
            return 400, {"message": "El estado indicado no corresponde a un presupuesto."}
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
    except Exception as error:
        return _internal_error("Error al actualizar presupuesto", error)

@api.patch("/presupuestos/{presupuesto_id}/estado", response={200: dict, 400: ErrorSchema}, tags=["Presupuestos"])
def actualizar_estado_presupuesto(request, presupuesto_id: int, payload: EstadoRapidoIn):
    require_capability(request, "gestionar_ordenes")
    presupuesto = get_object_or_404(Presupuesto, id=presupuesto_id, activo=True, owner=request.user)
    if payload.estado not in dict(Presupuesto.ESTADO_CHOICES):
        return 400, {"message": "El estado indicado no corresponde a un presupuesto."}
    presupuesto.estado = payload.estado
    presupuesto.save(update_fields=["estado"])
    return 200, {"message": "Estado de presupuesto actualizado"}

@api.delete("/presupuestos/{presupuesto_id}", response={200: dict, 400: ErrorSchema}, tags=["Presupuestos"])
def eliminar_presupuesto(request, presupuesto_id: int):
    require_capability(request, "gestionar_ordenes")
    presupuesto = get_object_or_404(Presupuesto, id=presupuesto_id, activo=True, owner=request.user)
    presupuesto.enviar_a_eliminados() # Borrado Suave / Soft Delete
    return 200, {"message": "Presupuesto enviado a la papelera."}


# ==========================================
# 8. ENDPOINTS DE FINANZAS
# ==========================================

@api.post("/pagos/", response={201: RespuestaGenerica, 400: ErrorSchema, 404: ErrorSchema, 500: ErrorSchema}, tags=["Finanzas"])
def api_registrar_operacion_caja(request, payload: OperacionCajaIn):
    require_capability(request, "cobrar")
    try:
        with transaction.atomic():
            cliente, _ = _resolver_entidades_express(payload, user=request.user)
            if not cliente:
                return 400, {"message": "Debe especificar un cliente o usar Alta Express."}

            monto_total = Decimal(str(payload.monto_total_venta))
            monto_pagado = Decimal(str(payload.monto_pagado))

            if monto_total <= 0 and monto_pagado <= 0:
                return 400, {"message": "Ingresá un importe mayor a cero."}

            saldo_disponible = Decimal(str(cliente.saldo_balance)) + monto_total
            if monto_pagado > saldo_disponible:
                return 400, {
                    "message": "El pago no puede superar el saldo total de la cuenta."
                }

            metodos_validos = {choice[0] for choice in MovimientoCuenta.METODO_CHOICES}
            if monto_pagado > 0 and payload.metodo_pago not in metodos_validos:
                return 400, {"message": "Seleccioná un medio de pago válido."}

            desc = payload.descripcion.strip()

            if monto_total > 0:
                fecha_promesa_obj = None
                if payload.fecha_promesa:
                    try:
                        fecha_promesa_obj = datetime.strptime(payload.fecha_promesa, "%Y-%m-%d").date()
                    except ValueError:
                        return 400, {"message": "La fecha prometida no tiene un formato válido."}
                MovimientoCuenta.objects.create(owner=request.user, cliente=cliente, tipo=MovimientoCuenta.TIPO_DEUDA, monto=monto_total, descripcion=f"Cargo: {desc}" if desc else "Venta a cuenta", fecha_promesa=fecha_promesa_obj)
                cliente.saldo_balance += monto_total

            if monto_pagado > 0:
                MovimientoCuenta.objects.create(owner=request.user, cliente=cliente, tipo=MovimientoCuenta.TIPO_PAGO, monto=monto_pagado, metodo_pago=payload.metodo_pago, descripcion=f"Abono: {desc}" if desc else "Abono en caja")
                cliente.saldo_balance -= monto_pagado
            
            cliente.save(update_fields=['saldo_balance'])
            return 201, {"message": "Operación exitosa.", "nuevo_saldo": float(cliente.saldo_balance)}
    except Http404:
        return 404, {"message": "No encontramos el cliente solicitado."}
    except Exception as error:
        return _internal_error("Error al registrar operación de caja", error)

@api.post("/compras/", response={201: RespuestaGenerica, 400: ErrorSchema}, tags=["Finanzas"])
def api_registrar_compra(request, payload: GastoIn):
    require_capability(request, "finanzas")
    try:
        tipos_validos = {choice[0] for choice in Gasto.TIPO_CHOICES}
        metodos_validos = {choice[0] for choice in MovimientoCuenta.METODO_CHOICES}
        descripcion = payload.descripcion.strip()
        if payload.tipo not in tipos_validos:
            return 400, {"message": "Seleccioná una categoría de gasto válida."}
        if payload.metodo_pago not in metodos_validos:
            return 400, {"message": "Seleccioná un medio de pago válido."}
        if not descripcion:
            return 400, {"message": "La descripción del gasto es obligatoria."}
        if payload.fecha and payload.fecha > timezone.localdate():
            return 400, {"message": "La fecha del gasto no puede estar en el futuro."}

        fecha_gasto = timezone.now()
        if payload.fecha:
            fecha_gasto = fecha_gasto.replace(
                year=payload.fecha.year,
                month=payload.fecha.month,
                day=payload.fecha.day,
            )

        gasto = Gasto.objects.create(
            owner=request.user,
            registrado_por=getattr(request, "actor", request.user),
            fecha=fecha_gasto,
            tipo=payload.tipo,
            metodo_pago=payload.metodo_pago,
            descripcion=descripcion,
            monto=Decimal(str(payload.monto)),
            comprobante=payload.comprobante.strip(),
        )
        taller = getattr(getattr(request, "membership", None), "taller", None)
        if taller:
            AuditoriaTaller.objects.create(
                taller=taller,
                actor=getattr(request, "actor", request.user),
                accion="GASTO_REGISTRADO",
                detalle=f"Gasto #{gasto.id}: {gasto.tipo} por ${gasto.monto}",
            )
        return 201, {"message": f"Gasto registrado (ID: {gasto.id})"}
    except Exception as error:
        return _internal_error("Error al registrar gasto", error)

@api.get("/clientes/{cliente_id}/movimientos", response=List[MovimientoCuentaOut], tags=["Directorio"])
def listar_movimientos_cliente(request, cliente_id: int):
    require_capability(request, "cobrar")
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

def _filtrar_gastos_financieros(
    request,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    tipo: Optional[str] = None,
    metodo: Optional[str] = None,
    buscar: Optional[str] = None,
):
    gastos = Gasto.objects.filter(owner=request.user)
    if fecha_desde:
        gastos = gastos.filter(fecha__date__gte=fecha_desde)
    if fecha_hasta:
        gastos = gastos.filter(fecha__date__lte=fecha_hasta)
    if tipo:
        gastos = gastos.filter(tipo=tipo)
    if metodo:
        gastos = gastos.filter(metodo_pago=metodo)
    if buscar:
        gastos = gastos.filter(
            Q(descripcion__icontains=buscar) | Q(comprobante__icontains=buscar)
        )
    return gastos


@api.get("/finanzas/gastos", response=List[GastoOut], tags=["Finanzas"])
def listar_gastos(
    request,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    tipo: Optional[str] = None,
    metodo: Optional[str] = None,
    buscar: Optional[str] = None,
):
    require_capability(request, "finanzas")
    gastos = _filtrar_gastos_financieros(
        request, fecha_desde, fecha_hasta, tipo, metodo, buscar
    ).select_related("registrado_por").order_by("-fecha")[:200]
    return [
        {
            "id": g.id,
            "fecha": g.fecha,
            "tipo": g.tipo,
            "descripcion": g.descripcion,
            "monto": float(g.monto),
            "comprobante": g.comprobante,
            "metodo_pago": g.metodo_pago,
            "registrado_por": (
                g.registrado_por.get_full_name()
                or g.registrado_por.username
                if g.registrado_por
                else "Sistema"
            ),
        }
        for g in gastos
    ]


@api.get("/finanzas/gastos/resumen", response=GastosResumenOut, tags=["Finanzas"])
def obtener_resumen_gastos(
    request,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
):
    require_capability(request, "finanzas")
    hoy = timezone.localdate()
    inicio_mes = hoy.replace(day=1)
    fin_mes_anterior = inicio_mes - timedelta(days=1)
    inicio_mes_anterior = fin_mes_anterior.replace(day=1)

    base = Gasto.objects.filter(owner=request.user)
    mes_actual = base.filter(
        fecha__date__gte=inicio_mes,
        fecha__date__lte=hoy,
    ).aggregate(
        total=Coalesce(Sum("monto"), Decimal("0.00"))
    )["total"]
    mes_anterior = base.filter(
        fecha__date__gte=inicio_mes_anterior,
        fecha__date__lte=fin_mes_anterior,
    ).aggregate(total=Coalesce(Sum("monto"), Decimal("0.00")))["total"]

    periodo = _filtrar_gastos_financieros(request, fecha_desde, fecha_hasta)
    agregado = periodo.aggregate(
        total=Coalesce(Sum("monto"), Decimal("0.00")),
        cantidad=Count("id"),
    )
    por_tipo = list(
        periodo.values("tipo")
        .annotate(
            total=Coalesce(Sum("monto"), Decimal("0.00")),
            cantidad=Count("id"),
        )
        .order_by("tipo")
    )
    return {
        "mes_actual": float(mes_actual),
        "mes_anterior": float(mes_anterior),
        "total_periodo": float(agregado["total"]),
        "cantidad_periodo": agregado["cantidad"],
        "por_tipo": [
            {
                "tipo": item["tipo"],
                "total": float(item["total"]),
                "cantidad": item["cantidad"],
            }
            for item in por_tipo
        ],
    }


@api.get("/finanzas/caja", response=List[MovimientoCajaOut], tags=["Finanzas"])
def obtener_movimientos_caja(
    request,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    metodo: Optional[str] = None,
):
    require_capability(request, "finanzas")
    movimientos = []
    pagos = MovimientoCuenta.objects.select_related("cliente").filter(
        tipo=MovimientoCuenta.TIPO_PAGO, owner=request.user
    )
    gastos = Gasto.objects.filter(owner=request.user)
    if fecha_desde:
        pagos = pagos.filter(fecha__date__gte=fecha_desde)
        gastos = gastos.filter(fecha__date__gte=fecha_desde)
    if fecha_hasta:
        pagos = pagos.filter(fecha__date__lte=fecha_hasta)
        gastos = gastos.filter(fecha__date__lte=fecha_hasta)
    if metodo:
        pagos = pagos.filter(metodo_pago=metodo)
        gastos = gastos.filter(metodo_pago=metodo)

    for pago in pagos.order_by("-fecha")[:200]:
        desc_clean = pago.descripcion.replace('Abono: ', '') if pago.descripcion else ''
        movimientos.append({"id": f"PAGO-{pago.id}", "fecha": pago.fecha, "tipo": "INGRESO", "concepto": f"Cobro a {pago.cliente.nombre_completo} {desc_clean and f'({desc_clean})'}", "monto": float(pago.monto), "metodo": pago.metodo_pago})

    for gasto in gastos.order_by("-fecha")[:200]:
        movimientos.append({"id": f"GASTO-{gasto.id}", "fecha": gasto.fecha, "tipo": "EGRESO", "concepto": f"Compra/Gasto: {gasto.descripcion}", "monto": float(gasto.monto), "metodo": gasto.metodo_pago})
    
    movimientos.sort(key=lambda x: x["fecha"], reverse=True)
    return movimientos[:200]


@api.get("/finanzas/caja/resumen", response=CajaResumenOut, tags=["Finanzas"])
def obtener_resumen_caja(
    request,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    metodo: Optional[str] = None,
):
    require_capability(request, "finanzas")
    pagos = MovimientoCuenta.objects.filter(
        tipo=MovimientoCuenta.TIPO_PAGO, owner=request.user
    )
    gastos = Gasto.objects.filter(owner=request.user)
    if fecha_desde:
        pagos = pagos.filter(fecha__date__gte=fecha_desde)
        gastos = gastos.filter(fecha__date__gte=fecha_desde)
    if fecha_hasta:
        pagos = pagos.filter(fecha__date__lte=fecha_hasta)
        gastos = gastos.filter(fecha__date__lte=fecha_hasta)
    if metodo:
        pagos = pagos.filter(metodo_pago=metodo)
        gastos = gastos.filter(metodo_pago=metodo)

    ingresos_data = pagos.aggregate(
        total=Coalesce(Sum("monto"), Decimal("0.00")), cantidad=Count("id")
    )
    egresos_data = gastos.aggregate(
        total=Coalesce(Sum("monto"), Decimal("0.00")), cantidad=Count("id")
    )
    ingresos = ingresos_data["total"]
    egresos = egresos_data["total"]
    return {
        "ingresos": float(ingresos),
        "egresos": float(egresos),
        "resultado": float(ingresos - egresos),
        "cantidad_movimientos": ingresos_data["cantidad"] + egresos_data["cantidad"],
    }


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
        portal_activo=True,
        portal_expires_at__gt=timezone.now(),
    )
    return _serializar_presupuesto_publico(request, presupuesto)


@api.patch("/public/presupuestos/{token}/estado/", response=PublicPresupuestoOut, auth=None, tags=["Portal Publico"])
def actualizar_estado_presupuesto_publico(request, token: str, payload: EstadoRapidoIn):
    token_uuid = _parsear_token_publico(token)
    presupuesto = get_object_or_404(
        Presupuesto.objects.select_related("cliente", "vehiculo", "owner").prefetch_related("items"),
        token=token_uuid,
        activo=True,
        portal_activo=True,
        portal_expires_at__gt=timezone.now(),
    )

    if presupuesto.estado != "ENVIADO":
        raise HttpError(400, "Este presupuesto ya no admite cambios desde el portal.")

    if payload.estado not in {"APROBADO", "RECHAZADO"}:
        raise HttpError(400, "Solo se puede aprobar o rechazar desde el portal.")

    presupuesto.estado = payload.estado
    presupuesto.save(update_fields=["estado"])
    return _serializar_presupuesto_publico(request, presupuesto)


@api.get("/public/vehiculos/{token}/", response=PublicVehiculoOut, auth=None, tags=["Portal Publico"])
def obtener_vehiculo_publico(request, token: str):
    token_uuid = _parsear_token_publico(token)
    vehiculo = get_object_or_404(
        Vehiculo.objects.select_related("cliente", "owner").prefetch_related("trabajos"),
        token=token_uuid,
        portal_activo=True,
        portal_expires_at__gt=timezone.now(),
    )
    return _serializar_vehiculo_publico(request, vehiculo)


@api.patch("/presupuestos/{presupuesto_id}/portal", response=PresupuestoDetalleOut, tags=["Presupuestos"])
def administrar_portal_presupuesto(request, presupuesto_id: int, payload: PortalAccessIn):
    require_capability(request, "portal")
    presupuesto = get_object_or_404(Presupuesto, id=presupuesto_id, activo=True, owner=request.user)
    presupuesto.portal_activo = payload.activo
    if payload.regenerar_token:
        presupuesto.token = uuid.uuid4()
        presupuesto.portal_activo = True
        presupuesto.portal_expires_at = timezone.now() + timedelta(days=90)
    presupuesto.save(update_fields=["portal_activo", "token", "portal_expires_at"])
    return presupuesto


@api.patch("/vehiculos/{vehiculo_id}/portal", response=VehiculoSchema, tags=["Directorio"])
def administrar_portal_vehiculo(request, vehiculo_id: int, payload: PortalAccessIn):
    require_capability(request, "portal")
    vehiculo = get_object_or_404(Vehiculo, id=vehiculo_id, owner=request.user)
    vehiculo.portal_activo = payload.activo
    if payload.regenerar_token:
        vehiculo.token = uuid.uuid4()
        vehiculo.portal_activo = True
        vehiculo.portal_expires_at = timezone.now() + timedelta(days=90)
    vehiculo.save(update_fields=["portal_activo", "token", "portal_expires_at"])
    return vehiculo

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
    taller_cuit: str = ""


def _login_rate_key(request) -> str:
    """Clave no reversible por IP para limitar intentos de acceso."""
    remote_addr = request.META.get("REMOTE_ADDR", "unknown")
    digest = hashlib.sha256(remote_addr.encode("utf-8")).hexdigest()
    return f"auth:login:{digest}"

class AuthOut(Schema):
    token: str
    user_id: int
    email: str
    nombre: str
    taller_nombre: str
    taller_ciudad: str = ""
    taller_tel: str = ""
    taller_cuit: str = ""
    taller_logo_url: Optional[str] = None
    taller_id: Optional[int] = None
    trial_start: Optional[str] = None
    plan_activo_hasta: Optional[str] = None
    rol: str = MembresiaTaller.ROL_ADMIN
    es_superusuario: bool = False


class SesionOut(Schema):
    """Identidad y estado comercial actual, sin exponer el token."""
    user_id: int
    email: str
    nombre: str
    taller_nombre: str
    taller_ciudad: str = ""
    taller_tel: str = ""
    taller_cuit: str = ""
    taller_logo_url: Optional[str] = None
    taller_id: Optional[int] = None
    trial_start: Optional[str] = None
    plan_activo_hasta: Optional[str] = None
    rol: str = MembresiaTaller.ROL_ADMIN
    es_superusuario: bool = False


class CeoTallerOut(Schema):
    id: int
    taller_nombre: str
    owner_nombre: str
    email: str
    ciudad: str = ""
    telefono: str = ""
    trial_start: str
    trial_hasta: str
    plan_activo_hasta: Optional[str] = None
    estado_acceso: str
    acceso_vigente: bool
    dias_restantes: int
    clientes: int
    trabajos: int
    es_superusuario: bool = False


class CeoResumenOut(Schema):
    total_talleres: int
    pruebas_vigentes: int
    planes_activos: int
    vencidos: int
    por_vencer: int
    talleres: List[CeoTallerOut]


class CeoPlanIn(Schema):
    accion: str
    hasta: Optional[datetime] = None


class CeoEnlaceRecuperacionOut(Schema):
    path: str
    expires_at: str
    email: str


class RecuperarContrasenaIn(Schema):
    password: str = Field(..., min_length=8, max_length=128)


class PerfilOut(Schema):
    nombre: str
    taller_nombre: str
    taller_ciudad: str = ""
    taller_tel: str = ""
    taller_cuit: str = ""
    logo_url: Optional[str] = None


class PerfilIn(Schema):
    nombre: str
    taller_nombre: str
    taller_ciudad: str = ""
    taller_tel: str = ""
    taller_cuit: str = ""


class MessageOut(Schema):
    message: str


class MiembroOut(Schema):
    id: int
    user_id: int
    nombre: str
    email: str
    rol: str
    activo: bool


class MiembroIn(Schema):
    nombre: str = Field(..., min_length=2, max_length=100)
    email: str
    password: str = Field(..., min_length=8)
    rol: str


class MiembroUpdateIn(Schema):
    rol: Optional[str] = None
    activo: Optional[bool] = None

class InvitacionIn(Schema):
    email: str
    rol: str

class AceptarInvitacionIn(Schema):
    nombre: str
    password: str = Field(..., min_length=8)


def _serializar_miembro(miembro: MembresiaTaller) -> MiembroOut:
    return MiembroOut(
        id=miembro.id,
        user_id=miembro.user_id,
        nombre=miembro.user.get_full_name() or miembro.user.username,
        email=miembro.user.email or miembro.user.username,
        rol=miembro.rol,
        activo=miembro.activo,
    )


def _auditar_equipo(request, taller: Taller, accion: str, detalle: str) -> None:
    AuditoriaTaller.objects.create(taller=taller, actor=getattr(request, "actor", request.user), accion=accion, detalle=detalle)


@api.get("/equipo/", response=List[MiembroOut], tags=["Equipo"])
def listar_equipo(request):
    require_capability(request, "equipo")
    taller = getattr(getattr(request, "membership", None), "taller", None)
    if taller is None:
        taller = get_object_or_404(Taller, owner=request.user)
    miembros = MembresiaTaller.objects.select_related("user").filter(taller=taller).order_by("-activo", "user__first_name")
    return [_serializar_miembro(miembro) for miembro in miembros]


@api.post("/equipo/", response={201: MiembroOut, 400: ErrorSchema}, tags=["Equipo"])
def crear_miembro(request, payload: MiembroIn):
    require_capability(request, "equipo")
    if payload.rol not in dict(MembresiaTaller.ROL_CHOICES):
        return 400, {"message": "Rol inválido."}
    email = payload.email.strip().lower()
    if User.objects.filter(email__iexact=email).exists() or User.objects.filter(username__iexact=email).exists():
        return 400, {"message": "Ya existe una cuenta con ese email."}
    taller = getattr(getattr(request, "membership", None), "taller", None) or get_object_or_404(Taller, owner=request.user)
    user = User.objects.create_user(username=email, email=email, password=payload.password, first_name=payload.nombre.strip())
    miembro = MembresiaTaller.objects.create(taller=taller, user=user, rol=payload.rol)
    _auditar_equipo(request, taller, "EQUIPO_MIEMBRO_CREADO", f"Se creó el acceso de {email} como {payload.rol}.")
    return 201, _serializar_miembro(miembro)

@api.post("/equipo/invitaciones/", response=MessageOut, tags=["Equipo"])
def crear_invitacion(request, payload: InvitacionIn):
    require_capability(request, "equipo")
    if payload.rol not in dict(MembresiaTaller.ROL_CHOICES): raise HttpError(400, "Rol inválido.")
    taller = getattr(getattr(request, "membership", None), "taller", None) or get_object_or_404(Taller, owner=request.user)
    invitacion = InvitacionTaller.objects.create(taller=taller, email=payload.email.strip().lower(), rol=payload.rol, creada_por=getattr(request, "actor", request.user))
    _auditar_equipo(request, taller, "EQUIPO_INVITACION_CREADA", f"Se invitó a {invitacion.email} como {invitacion.rol}.")
    return {"message": f"Invitación creada: /invitacion/{invitacion.token}"}

@api.post("/public/invitaciones/{token}/aceptar", auth=None, response=MessageOut, tags=["Equipo"])
def aceptar_invitacion(request, token: str, payload: AceptarInvitacionIn):
    try:
        token_uuid = UUID(token)
    except ValueError:
        raise HttpError(404, "Invitación no encontrada.")
    invitacion = get_object_or_404(InvitacionTaller.objects.select_related("taller"), token=token_uuid)
    if not invitacion.vigente:
        raise HttpError(400, "Esta invitación venció o ya fue utilizada.")
    if User.objects.filter(email__iexact=invitacion.email).exists():
        raise HttpError(400, "Ya existe una cuenta con este email. Pedí al administrador que te agregue a su taller.")
    with transaction.atomic():
        user = User.objects.create_user(username=invitacion.email, email=invitacion.email, password=payload.password, first_name=payload.nombre.strip())
        MembresiaTaller.objects.create(taller=invitacion.taller, user=user, rol=invitacion.rol)
        invitacion.aceptada_en = timezone.now()
        invitacion.save(update_fields=["aceptada_en"])
        AuditoriaTaller.objects.create(taller=invitacion.taller, actor=user, accion="EQUIPO_INVITACION_ACEPTADA", detalle=f"{invitacion.email} aceptó la invitación como {invitacion.rol}.")
    return {"message": "Acceso creado correctamente. Ya podés iniciar sesión."}


@api.patch("/equipo/{miembro_id}", response=MiembroOut, tags=["Equipo"])
def actualizar_miembro(request, miembro_id: int, payload: MiembroUpdateIn):
    require_capability(request, "equipo")
    taller = getattr(getattr(request, "membership", None), "taller", None) or get_object_or_404(Taller, owner=request.user)
    miembro = get_object_or_404(MembresiaTaller.objects.select_related("user"), id=miembro_id, taller=taller)
    if miembro.user_id == taller.owner_id and payload.activo is False:
        raise HttpError(400, "No podés desactivar al dueño del taller.")
    if payload.rol is not None:
        if payload.rol not in dict(MembresiaTaller.ROL_CHOICES):
            raise HttpError(400, "Rol inválido.")
        miembro.rol = payload.rol
    if payload.activo is not None:
        miembro.activo = payload.activo
    miembro.save(update_fields=["rol", "activo"])
    _auditar_equipo(request, taller, "EQUIPO_MIEMBRO_ACTUALIZADO", f"Se actualizó {miembro.user.email}: rol={miembro.rol}, activo={miembro.activo}.")
    return _serializar_miembro(miembro)


@api.post("/auth/login/", response=AuthOut, auth=None, tags=["Auth"])
def login_api(request, payload: LoginIn):
    """
    Login para el frontend Next.js.
    Devuelve un token de sesión que debe enviarse en cada request
    como: Authorization: Token <token>
    """
    rate_key = _login_rate_key(request)
    attempts = cache.get(rate_key, 0)
    if attempts >= LOGIN_MAX_ATTEMPTS:
        raise HttpError(429, "Demasiados intentos. Esperá 15 minutos antes de volver a probar.")

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
        cache.set(rate_key, attempts + 1, LOGIN_RATE_WINDOW_SECONDS)
        raise HttpError(400, "Email, usuario o contraseña incorrectos")

    # Obtener o crear token para este usuario
    api_token, created = ApiToken.objects.get_or_create(user=user)
    if not created and api_token.is_expired:
        api_token.rotate()
    cache.delete(rate_key)

    membresia = MembresiaTaller.objects.select_related("taller", "taller__owner").filter(
        user=user, activo=True, taller__activo=True
    ).first()
    taller = membresia.taller if membresia else None
    owner = taller.owner if taller else user

    # Los datos comerciales pertenecen al dueño del taller, no al empleado.
    try:
        perfil = owner.perfil
    except PerfilTaller.DoesNotExist:
        perfil = None

    return AuthOut(
        token=api_token.key,
        user_id=user.id,
        email=user.email or identifier_lower,
        # Identidad personal del actor; la marca del taller sí pertenece al owner.
        nombre=user.get_full_name() or user.first_name or user.username,
        taller_nombre=perfil.taller_nombre if perfil else (taller.nombre if taller else user.last_name or "Mi Taller"),
        taller_ciudad=perfil.taller_ciudad if perfil else "",
        taller_tel=perfil.taller_tel if perfil else "",
        taller_cuit=perfil.taller_cuit if perfil else "",
        taller_logo_url=_logo_url(request, perfil) if perfil else None,
        trial_start=perfil.trial_start.isoformat() if perfil else None,
        plan_activo_hasta=perfil.plan_activo_hasta.isoformat() if perfil and perfil.plan_activo_hasta else None,
        taller_id=taller.id if taller else None,
        rol=membresia.rol if membresia else MembresiaTaller.ROL_ADMIN,
        es_superusuario=user.is_superuser,
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
    actor = getattr(request, "actor", request.user)
    membresia = getattr(request, "membership", None)
    if api_token is None:
        api_token, _ = ApiToken.objects.get_or_create(user=actor)
    else:
        api_token.rotate()

    try:
        perfil = request.user.perfil
    except PerfilTaller.DoesNotExist:
        perfil = None

    return AuthOut(
        token=api_token.key,
        user_id=actor.id,
        email=actor.email or actor.username,
        nombre=actor.get_full_name() or actor.first_name or actor.username,
        taller_nombre=perfil.taller_nombre if perfil else (request.user.last_name or "Mi Taller"),
        taller_ciudad=perfil.taller_ciudad if perfil else "",
        taller_tel=perfil.taller_tel if perfil else "",
        taller_cuit=perfil.taller_cuit if perfil else "",
        taller_logo_url=_logo_url(request, perfil) if perfil else None,
        trial_start=perfil.trial_start.isoformat() if perfil else None,
        plan_activo_hasta=perfil.plan_activo_hasta.isoformat() if perfil and perfil.plan_activo_hasta else None,
        taller_id=membresia.taller_id if membresia else None,
        rol=membresia.rol if membresia else MembresiaTaller.ROL_ADMIN,
        es_superusuario=actor.is_superuser,
    )


def _ceo_taller_out(perfil: PerfilTaller, now, clientes: int, trabajos: int) -> CeoTallerOut:
    """Serializa el estado comercial desde la fuente de verdad del backend."""
    trial_hasta = perfil.trial_start + timedelta(days=7)
    if perfil.plan_vigente:
        estado = "PLAN_ACTIVO"
        vencimiento = perfil.plan_activo_hasta
    elif not perfil.trial_vencido:
        estado = "PRUEBA_VIGENTE"
        vencimiento = trial_hasta
    else:
        estado = "VENCIDO"
        vencimiento = perfil.plan_activo_hasta or trial_hasta

    segundos_restantes = (vencimiento - now).total_seconds()
    dias_restantes = max(0, int((segundos_restantes + 86399) // 86400))
    user = perfil.user
    return CeoTallerOut(
        id=perfil.id,
        taller_nombre=perfil.taller_nombre,
        owner_nombre=perfil.nombre or user.get_full_name() or user.username,
        email=user.email or user.username,
        ciudad=perfil.taller_ciudad,
        telefono=perfil.taller_tel,
        trial_start=perfil.trial_start.isoformat(),
        trial_hasta=trial_hasta.isoformat(),
        plan_activo_hasta=perfil.plan_activo_hasta.isoformat() if perfil.plan_activo_hasta else None,
        estado_acceso=estado,
        acceso_vigente=perfil.acceso_vigente,
        dias_restantes=dias_restantes,
        clientes=clientes,
        trabajos=trabajos,
        es_superusuario=user.is_superuser,
    )


@api.get("/auth/sesion/", response=SesionOut, tags=["Auth"])
def sesion_api(request):
    """Refresca el estado de la cuenta desde Django sin rotar la credencial."""
    actor = getattr(request, "actor", request.user)
    membresia = getattr(request, "membership", None)
    try:
        perfil = request.user.perfil
    except PerfilTaller.DoesNotExist:
        perfil = None
    return SesionOut(
        user_id=actor.id,
        email=actor.email or actor.username,
        nombre=actor.get_full_name() or actor.first_name or actor.username,
        taller_nombre=perfil.taller_nombre if perfil else (request.user.last_name or "Mi Taller"),
        taller_ciudad=perfil.taller_ciudad if perfil else "",
        taller_tel=perfil.taller_tel if perfil else "",
        taller_cuit=perfil.taller_cuit if perfil else "",
        taller_logo_url=_logo_url(request, perfil) if perfil else None,
        taller_id=membresia.taller_id if membresia else None,
        trial_start=perfil.trial_start.isoformat() if perfil else None,
        plan_activo_hasta=perfil.plan_activo_hasta.isoformat() if perfil and perfil.plan_activo_hasta else None,
        rol=membresia.rol if membresia else MembresiaTaller.ROL_ADMIN,
        es_superusuario=actor.is_superuser,
    )


@api.get("/ceo/resumen/", response=CeoResumenOut, tags=["CEO"])
def ceo_resumen(request):
    """Vista comercial global. Sólo un superusuario puede leerla."""
    require_platform_admin(request)
    now = timezone.now()
    perfiles = list(
        PerfilTaller.objects.select_related("user")
        .annotate(
            clientes_count=Count("user__clientes", distinct=True),
            trabajos_count=Count("user__trabajos", distinct=True),
        )
        .order_by("taller_nombre", "id")
    )
    talleres = [
        _ceo_taller_out(perfil, now, perfil.clientes_count, perfil.trabajos_count)
        for perfil in perfiles
    ]
    return CeoResumenOut(
        total_talleres=len(talleres),
        pruebas_vigentes=sum(t.estado_acceso == "PRUEBA_VIGENTE" for t in talleres),
        planes_activos=sum(t.estado_acceso == "PLAN_ACTIVO" for t in talleres),
        vencidos=sum(t.estado_acceso == "VENCIDO" for t in talleres),
        por_vencer=sum(t.acceso_vigente and t.dias_restantes <= 3 for t in talleres),
        talleres=talleres,
    )


@api.patch("/ceo/talleres/{perfil_id}/plan/", response=CeoTallerOut, tags=["CEO"])
def actualizar_plan_ceo(request, perfil_id: int, payload: CeoPlanIn):
    """Gestiona altas y renovaciones sin confiar en fechas del cliente web."""
    actor = require_platform_admin(request)
    perfil = get_object_or_404(PerfilTaller.objects.select_related("user"), id=perfil_id)
    now = timezone.now()
    accion = payload.accion.strip().upper()

    if accion == "ACTIVAR_30_DIAS":
        perfil.plan_activo_hasta = now + timedelta(days=30)
        detalle = "Se otorgaron 30 días de acceso desde hoy."
    elif accion == "EXTENDER_30_DIAS":
        base = perfil.plan_activo_hasta if perfil.plan_activo_hasta and perfil.plan_activo_hasta > now else now
        perfil.plan_activo_hasta = base + timedelta(days=30)
        detalle = "Se extendió el acceso por 30 días."
    elif accion == "FIJAR_FECHA":
        if payload.hasta is None:
            raise HttpError(400, "Indicá una fecha de vigencia para el plan.")
        hasta = payload.hasta
        if timezone.is_naive(hasta):
            hasta = timezone.make_aware(hasta, timezone.get_current_timezone())
        if hasta <= now:
            raise HttpError(400, "La fecha de vigencia debe estar en el futuro.")
        perfil.plan_activo_hasta = hasta
        detalle = f"Se fijó el acceso hasta {hasta.date().isoformat()}."
    elif accion == "QUITAR_PLAN":
        perfil.plan_activo_hasta = None
        detalle = "Se quitó el plan pago; el acceso vuelve a depender de la prueba."
    else:
        raise HttpError(400, "Acción de plan inválida.")

    perfil.save(update_fields=["plan_activo_hasta"])
    taller = Taller.objects.filter(owner=perfil.user).first()
    if taller:
        AuditoriaTaller.objects.create(
            taller=taller,
            actor=actor,
            accion=f"CEO_{accion}",
            detalle=detalle,
        )
    return _ceo_taller_out(
        perfil,
        now,
        Cliente.objects.filter(owner=perfil.user).count(),
        Trabajo.objects.filter(owner=perfil.user).count(),
    )


@api.post("/ceo/talleres/{perfil_id}/enlace-recuperacion/", response=CeoEnlaceRecuperacionOut, tags=["CEO"])
def generar_enlace_recuperacion_ceo(request, perfil_id: int):
    """Emite un enlace temporal para que el dueño recupere su propia clave."""
    actor = require_platform_admin(request)
    perfil = get_object_or_404(PerfilTaller.objects.select_related("user"), id=perfil_id, user__is_superuser=False)
    if not perfil.user.is_active:
        raise HttpError(400, "No se puede recuperar una cuenta desactivada.")

    now = timezone.now()
    # Un único enlace útil por cuenta: emitir uno nuevo vence cualquiera previo.
    RecuperacionContrasena.objects.filter(
        user=perfil.user,
        usada_en__isnull=True,
        expires_at__gt=now,
    ).update(expires_at=now)
    token = secrets.token_urlsafe(32)
    recuperacion = RecuperacionContrasena.objects.create(
        user=perfil.user,
        token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        expires_at=now + timedelta(hours=1),
        creada_por=actor,
    )
    taller = Taller.objects.filter(owner=perfil.user).first()
    if taller:
        AuditoriaTaller.objects.create(
            taller=taller,
            actor=actor,
            accion="CEO_RECUPERACION_GENERADA",
            detalle="Se generó un enlace de recuperación de contraseña válido por una hora.",
        )
    return CeoEnlaceRecuperacionOut(
        path=f"/recuperar/{recuperacion.id}/{token}",
        expires_at=recuperacion.expires_at.isoformat(),
        email=perfil.user.email or perfil.user.username,
    )


@api.post("/public/recuperacion/{recuperacion_id}/{token}/", auth=None, response=MessageOut, tags=["Auth"])
def recuperar_contrasena_publica(request, recuperacion_id: int, token: str, payload: RecuperarContrasenaIn):
    """Consume un enlace temporal y revoca las sesiones anteriores del usuario."""
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = timezone.now()
    with transaction.atomic():
        recuperacion = RecuperacionContrasena.objects.select_for_update().select_related("user").filter(
            id=recuperacion_id,
            token_hash=token_hash,
            usada_en__isnull=True,
            expires_at__gt=now,
        ).first()
        if recuperacion is None:
            raise HttpError(400, "Este enlace es inválido, ya fue utilizado o venció.")
        try:
            validate_password(payload.password, recuperacion.user)
        except DjangoValidationError as error:
            raise HttpError(400, " ".join(error.messages))

        user = recuperacion.user
        user.set_password(payload.password)
        user.save(update_fields=["password"])
        ApiToken.objects.filter(user=user).delete()
        recuperacion.usada_en = now
        recuperacion.save(update_fields=["usada_en"])

    taller = Taller.objects.filter(owner=user).first()
    if taller:
        AuditoriaTaller.objects.create(
            taller=taller,
            actor=user,
            accion="CONTRASENA_RESTABLECIDA",
            detalle="La contraseña fue restablecida mediante un enlace de recuperación.",
        )
    return {"message": "Contraseña actualizada. Ya podés iniciar sesión."}


def _logo_url(request, perfil: PerfilTaller) -> Optional[str]:
    if not perfil.logo:
        return None
    try:
        return request.build_absolute_uri(perfil.logo.url)
    except ValueError:
        # El archivo referenciado por el campo no existe físicamente en disco.
        return None


def _perfil_out(request, perfil: PerfilTaller) -> PerfilOut:
    return PerfilOut(
        nombre=perfil.nombre,
        taller_nombre=perfil.taller_nombre,
        taller_ciudad=perfil.taller_ciudad,
        taller_tel=perfil.taller_tel,
        taller_cuit=perfil.taller_cuit,
        logo_url=_logo_url(request, perfil),
    )


@api.get("/perfil/", response=PerfilOut, tags=["Auth"])
def get_perfil(request):
    """Devuelve el perfil del taller del usuario autenticado."""
    try:
        perfil = request.user.perfil
    except PerfilTaller.DoesNotExist:
        raise HttpError(404, "Perfil no encontrado. Completá tu perfil desde la app.")
    return _perfil_out(request, perfil)


@api.put("/perfil/", response=PerfilOut, tags=["Auth"])
def update_perfil(request, payload: PerfilIn):
    """Actualiza (o crea) el perfil del taller del usuario autenticado."""
    require_capability(request, "configuracion")
    try:
        perfil = request.user.perfil
        perfil.nombre        = payload.nombre
        perfil.taller_nombre = payload.taller_nombre
        perfil.taller_ciudad = payload.taller_ciudad
        perfil.taller_tel    = payload.taller_tel
        perfil.taller_cuit   = payload.taller_cuit
        perfil.save()
    except PerfilTaller.DoesNotExist:
        perfil = PerfilTaller.objects.create(
            user=request.user,
            nombre=payload.nombre,
            taller_nombre=payload.taller_nombre,
            taller_ciudad=payload.taller_ciudad,
            taller_tel=payload.taller_tel,
            taller_cuit=payload.taller_cuit,
        )
    return _perfil_out(request, perfil)


LOGO_MAX_BYTES = 3 * 1024 * 1024  # 3MB
LOGO_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
LOGO_MAX_DIMENSION = 4096


def _validar_logo(archivo: UploadedFile) -> None:
    if archivo.content_type not in LOGO_CONTENT_TYPES:
        raise HttpError(400, "Formato no soportado. Usá PNG, JPG o WEBP.")
    if archivo.size > LOGO_MAX_BYTES:
        raise HttpError(400, "El archivo pesa más de 3MB. Subí una imagen más liviana.")

    try:
        archivo.seek(0)
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            imagen = Image.open(archivo)
            if imagen.width > LOGO_MAX_DIMENSION or imagen.height > LOGO_MAX_DIMENSION:
                raise HttpError(400, "El logo no puede superar 4096 × 4096 píxeles.")
            imagen.verify()
    except HttpError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HttpError(400, "El archivo no contiene una imagen válida.")
    finally:
        archivo.seek(0)


@api.post("/perfil/logo/", response=PerfilOut, tags=["Auth"])
def subir_logo_perfil(request, archivo: UploadedFile = File(...)):
    """Sube (o reemplaza) el logo del taller, usado en presupuestos y comprobantes."""
    require_capability(request, "configuracion")
    _validar_logo(archivo)

    perfil, _ = PerfilTaller.objects.get_or_create(
        user=request.user,
        defaults={"nombre": request.user.first_name or request.user.username, "taller_nombre": "Mi Taller"},
    )
    logo_anterior = perfil.logo.name if perfil.logo else None
    try:
        perfil.logo = archivo
        perfil.save(update_fields=["logo"])
    except Exception:
        if perfil.logo and perfil.logo.name != logo_anterior:
            perfil.logo.storage.delete(perfil.logo.name)
        raise
    if logo_anterior and logo_anterior != perfil.logo.name:
        perfil.logo.storage.delete(logo_anterior)
    return _perfil_out(request, perfil)


@api.delete("/perfil/logo/", response=PerfilOut, tags=["Auth"])
def eliminar_logo_perfil(request):
    """Quita el logo del taller (vuelve a mostrarse el placeholder de iniciales)."""
    require_capability(request, "configuracion")
    try:
        perfil = request.user.perfil
    except PerfilTaller.DoesNotExist:
        raise HttpError(404, "Perfil no encontrado.")
    if perfil.logo:
        nombre_logo = perfil.logo.name
        perfil.logo = None
        perfil.save(update_fields=["logo"])
        perfil.logo.storage.delete(nombre_logo)
    return _perfil_out(request, perfil)


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
            taller_cuit=payload.taller_cuit,
        )
        taller = Taller.objects.create(owner=user, nombre=payload.taller_nombre)
        MembresiaTaller.objects.create(taller=taller, user=user, rol=MembresiaTaller.ROL_ADMIN)
        api_token = ApiToken.objects.create(user=user)

    return AuthOut(
        token=api_token.key,
        user_id=user.id,
        email=user.email,
        nombre=perfil.nombre,
        taller_nombre=perfil.taller_nombre,
        taller_ciudad=perfil.taller_ciudad,
        taller_tel=perfil.taller_tel,
        taller_cuit=perfil.taller_cuit,
        trial_start=perfil.trial_start.isoformat(),
        plan_activo_hasta=perfil.plan_activo_hasta.isoformat() if perfil.plan_activo_hasta else None,
    )
