# taller/models.py
import secrets
import uuid
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q
from django.core.validators import MinValueValidator
from django.utils import timezone


def _portal_expiry_default():
    """Los enlaces públicos son capacidades: expiran por defecto."""
    return timezone.now() + timedelta(days=90)


def _invitation_expiry_default():
    return timezone.now() + timedelta(days=7)


def logo_taller_upload_to(instance, filename):
    """Evita colisiones y filtrar nombres originales entre talleres."""
    extension = Path(filename).suffix.lower()
    return f"taller/logos/{instance.user_id}/{uuid.uuid4().hex}{extension}"

# ========================
#    SISTEMA (SAAS / NUEVO)
# ========================

class ConfiguracionTaller(models.Model):
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name="configuracion_taller")
    nombre_taller = models.CharField(max_length=150)
    logo = models.ImageField(upload_to="taller/logos/", null=True, blank=True)
    moneda = models.CharField(max_length=5, default="$")
    prefijo_nro_trabajo = models.CharField(max_length=5, default="OT")

    class Meta:
        verbose_name = "Configuración del Taller"
        verbose_name_plural = "Configuraciones del Taller"

    def __str__(self):
        return self.nombre_taller

# ========================
#    CLIENTES
# ========================

class Cliente(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="clientes")
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    dni = models.CharField("DNI / CUIT", max_length=20, blank=True, db_index=True)
    direccion = models.CharField(max_length=255, blank=True)

    saldo_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), editable=False)
    notas = models.TextField(blank=True, help_text="Comentarios generales sobre el cliente.")

    class Meta:
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        ordering = ["nombre", "apellido"]

    def __str__(self):
        return self.nombre_completo

    @property
    def nombre_completo(self):
        if self.apellido:
            return f"{self.nombre} {self.apellido}"
        return self.nombre

    @property
    def saldo_actual(self) -> Decimal:
        return self.saldo_balance

# ========================
#    INVENTARIO
# ========================

class Producto(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="productos")
    codigo = models.CharField(max_length=50)
    nombre = models.CharField(max_length=200)
    stock_actual = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_minimo = models.DecimalField(max_digits=10, decimal_places=2, default=5)
    precio_costo = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    precio_venta = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Producto / Repuesto"
        verbose_name_plural = "Productos y Repuestos"
        constraints = [
            models.UniqueConstraint(fields=["owner", "codigo"], name="uniq_producto_owner_codigo"),
        ]

    def __str__(self):
        return f"[{self.codigo}] {self.nombre}"

# ========================
#    VEHÍCULOS
# ========================

class Vehiculo(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="vehiculos")
    cliente = models.ForeignKey(Cliente, related_name="vehiculos", on_delete=models.CASCADE)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    portal_activo = models.BooleanField(default=True)
    portal_expires_at = models.DateTimeField(default=_portal_expiry_default, db_index=True)
    patente = models.CharField(max_length=10, db_index=True)
    marca = models.CharField(max_length=50)
    modelo = models.CharField(max_length=100)
    anio = models.PositiveIntegerField("Año", null=True, blank=True)
    color = models.CharField(max_length=50, blank=True)

    kilometraje_actual = models.PositiveIntegerField(default=0)
    estado_cubiertas = models.CharField(max_length=200, blank=True)
    proximo_service_km = models.PositiveIntegerField(null=True, blank=True)
    proximo_service_fecha = models.DateField(null=True, blank=True)
    notas = models.TextField(blank=True)

    class Meta:
        verbose_name = "Vehículo"
        verbose_name_plural = "Vehículos"
        ordering = ["patente"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "patente"], name="uniq_vehiculo_owner_patente"),
        ]

    def __str__(self):
        return f"{self.patente} – {self.marca} {self.modelo}"

    @property
    def cliente_nombre(self):
        return self.cliente.nombre_completo

    def save(self, *args, **kwargs):
        if self.cliente_id and self.cliente and self.owner_id != self.cliente.owner_id:
            self.owner = self.cliente.owner
        super().save(*args, **kwargs)

# ========================
#    TRABAJOS
# ========================

class Trabajo(models.Model):
    ESTADO_INGRESADO = "INGRESADO"
    ESTADO_EN_PROCESO = "EN_PROCESO"
    ESTADO_FINALIZADO = "FINALIZADO"
    ESTADO_ENTREGADO = "ENTREGADO"
    ESTADO_ANULADO = "ANULADO"
    ESTADO_CHOICES = [
        (ESTADO_INGRESADO, "Ingresado"),
        (ESTADO_EN_PROCESO, "En proceso"),
        (ESTADO_FINALIZADO, "Finalizado"),
        (ESTADO_ENTREGADO, "Entregado al cliente"),
        (ESTADO_ANULADO, "Anulado"),
    ]

    ESTADO_GENERAL_EXCELENTE = "EXCELENTE"
    ESTADO_GENERAL_BUENO = "BUENO"
    ESTADO_GENERAL_REGULAR = "REGULAR"
    ESTADO_GENERAL_CRITICO = "CRITICO"
    ESTADO_GENERAL_CHOICES = [
        (ESTADO_GENERAL_EXCELENTE, "Excelente"),
        (ESTADO_GENERAL_BUENO, "Bueno"),
        (ESTADO_GENERAL_REGULAR, "Regular"),
        (ESTADO_GENERAL_CRITICO, "Crítico"),
    ]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="trabajos")
    vehiculo = models.ForeignKey(Vehiculo, related_name="trabajos", on_delete=models.CASCADE)
    cliente = models.ForeignKey(Cliente, related_name="trabajos", on_delete=models.PROTECT)
    # Mantiene la trazabilidad: una OT creada desde una cotización nunca pierde
    # el documento comercial que le dio origen.
    presupuesto_origen = models.ForeignKey(
        "Presupuesto",
        related_name="trabajos_generados",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    fecha_ingreso = models.DateTimeField(default=timezone.now)
    fecha_egreso_estimado = models.DateTimeField(null=True, blank=True)
    fecha_egreso_real = models.DateTimeField(null=True, blank=True)
    iniciado_en = models.DateTimeField(null=True, blank=True)
    finalizado_en = models.DateTimeField(null=True, blank=True)
    responsable = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="trabajos_asignados",
    )

    kilometraje = models.PositiveIntegerField()
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default=ESTADO_INGRESADO)

    resumen_trabajos = models.TextField()
    observaciones_cliente = models.TextField(blank=True)
    observaciones_internas = models.TextField(blank=True)

    estado_general = models.CharField(max_length=20, choices=ESTADO_GENERAL_CHOICES, default=ESTADO_GENERAL_BUENO)
    estado_cubiertas_trabajo = models.CharField(max_length=200, blank=True)
    recomendaciones_proximo_service = models.TextField(blank=True)
    proximo_control_km = models.PositiveIntegerField(null=True, blank=True)

    activo = models.BooleanField(default=True, db_index=True)
    eliminado_en = models.DateTimeField(null=True, blank=True)

    total_mano_obra = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), validators=[MinValueValidator(Decimal("0.00"))])
    total_repuestos = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), validators=[MinValueValidator(Decimal("0.00"))])
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), validators=[MinValueValidator(Decimal("0.00"))])
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), editable=False)

    class Meta:
        verbose_name = "Trabajo"
        verbose_name_plural = "Trabajos"
        ordering = ["-fecha_ingreso"]

    def __str__(self):
        return f"Trabajo #{self.id} – {self.vehiculo.patente}"

    def save(self, *args, **kwargs):
        if self.cliente_id and self.cliente and self.owner_id != self.cliente.owner_id:
            self.owner = self.cliente.owner
        super().save(*args, **kwargs)
        
    def calcular_total(self) -> Decimal:
        bruto = (self.total_mano_obra or Decimal("0.00")) + (self.total_repuestos or Decimal("0.00"))
        total = bruto - (self.descuento or Decimal("0.00"))
        return total if total > 0 else Decimal("0.00")

    def enviar_a_eliminados(self):
        self.activo = False
        self.eliminado_en = timezone.now()
        self.save(update_fields=['activo', 'eliminado_en'])

    @property
    def responsable_nombre(self):
        if not self.responsable:
            return ""
        return self.responsable.get_full_name() or self.responsable.email or self.responsable.username

class TrabajoItem(models.Model):
    TIPO_MANO_OBRA = "MANO_OBRA"
    TIPO_REPUESTO = "REPUESTO"
    TIPO_INSUMO = "INSUMO"
    TIPO_OTRO = "OTRO"
    TIPO_CHOICES = [(TIPO_MANO_OBRA, "Mano de obra"), (TIPO_REPUESTO, "Repuesto"), (TIPO_INSUMO, "Insumo"), (TIPO_OTRO, "Otro")]

    trabajo = models.ForeignKey(Trabajo, related_name="items", on_delete=models.CASCADE)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default=TIPO_MANO_OBRA)
    descripcion = models.CharField(max_length=255)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1.00"))
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), editable=False)
    completado = models.BooleanField(default=False, db_index=True)
    completado_en = models.DateTimeField(null=True, blank=True)
    completado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="items_trabajo_completados",
    )

    class Meta:
        verbose_name = "Ítem de trabajo"
        verbose_name_plural = "Ítems de trabajo"

    def save(self, *args, **kwargs):
        self.subtotal = (self.cantidad or Decimal("0.00")) * (self.precio_unitario or Decimal("0.00"))
        super().save(*args, **kwargs)

class TrabajoImagen(models.Model):
    trabajo = models.ForeignKey(Trabajo, related_name="imagenes", on_delete=models.CASCADE)
    imagen = models.ImageField(upload_to="trabajos/evidencia/")
    descripcion = models.CharField(max_length=100, blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

# ========================
#    CUENTA CORRIENTE 
# ========================

class MovimientoCuenta(models.Model):
    TIPO_DEUDA = "DEUDA" # Usamos este para el FIADO
    TIPO_PAGO = "PAGO"
    TIPO_CHOICES = [("DEUDA", "Deuda generada / Fiado"), ("PAGO", "Pago registrado")]
    METODO_CHOICES = [("EFECTIVO", "Efectivo"), ("TRANSFERENCIA", "Transferencia"), ("TARJETA", "Tarjeta"), ("CHEQUE", "Cheque"), ("CONTADO", "Contado")]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="movimientos_cuenta")
    cliente = models.ForeignKey(Cliente, related_name="movimientos_cuenta", on_delete=models.CASCADE)
    trabajo = models.ForeignKey(Trabajo, related_name="movimientos_cuenta", null=True, blank=True, on_delete=models.SET_NULL)
    fecha = models.DateTimeField(default=timezone.now)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    metodo_pago = models.CharField("Método de pago", max_length=20, choices=METODO_CHOICES, blank=True)
    descripcion = models.CharField(max_length=255, blank=True)
    monto = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    
    fecha_promesa = models.DateField(null=True, blank=True, help_text="Fecha en la que promete pagar la deuda")

    class Meta:
        verbose_name = "Movimiento de cuenta"
        verbose_name_plural = "Movimientos de cuenta"
        ordering = ["fecha"]

    def __str__(self):
        signo = "+" if self.tipo == self.TIPO_DEUDA else "-"
        return f"{self.fecha.date()} {signo}${self.monto} – {self.cliente}"

    def save(self, *args, **kwargs):
        if self.cliente_id and self.cliente and self.owner_id != self.cliente.owner_id:
            self.owner = self.cliente.owner
        super().save(*args, **kwargs)

# ========================
#    TURNOS
# ========================

class Turno(models.Model):
    ESTADO_CHOICES = [("PENDIENTE", "Pendiente"), ("CONFIRMADO", "Confirmado"), ("CANCELADO", "Cancelado"), ("CUMPLIDO", "Cumplido")]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="turnos_agenda")
    cliente = models.ForeignKey(Cliente, related_name="turnos", on_delete=models.SET_NULL, null=True, blank=True)
    vehiculo = models.ForeignKey(Vehiculo, related_name="turnos", on_delete=models.SET_NULL, null=True, blank=True)
    fecha_hora = models.DateTimeField()
    motivo = models.CharField(max_length=255)
    notas = models.TextField(blank=True)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default="PENDIENTE")
    creado_en = models.DateTimeField(auto_now_add=True)

# ========================
#    PRESUPUESTOS (¡ARREGLADO!)
# ========================

class Presupuesto(models.Model):
    TIPO_CHOICES = [("RAPIDO", "Presupuesto rápido"), ("DETALLADO", "Presupuesto detallado")]
    ESTADO_CHOICES = [("BORRADOR", "Borrador"), ("ENVIADO", "Enviado al Cliente"), ("APROBADO", "Aprobado"), ("RECHAZADO", "Rechazado")]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="presupuestos")
    cliente = models.ForeignKey(Cliente, related_name="presupuestos", on_delete=models.PROTECT, null=True, blank=True)
    vehiculo = models.ForeignKey(Vehiculo, related_name="presupuestos", on_delete=models.PROTECT, null=True, blank=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    portal_activo = models.BooleanField(default=True)
    portal_expires_at = models.DateTimeField(default=_portal_expiry_default, db_index=True)

    # ---> CAMPOS LEGACY (Mantenidos para que no explote forms.py ni el admin viejo)
    tipo = models.CharField(max_length=15, choices=TIPO_CHOICES, default="DETALLADO")
    fecha = models.DateTimeField(default=timezone.now)
    titulo = models.CharField(max_length=160, default="Presupuesto")
    resumen = models.TextField(blank=True)

    # ---> CAMPOS NUEVOS (Usados por nuestra nueva API en Next.js)
    fecha_creacion = models.DateTimeField(default=timezone.now)
    valido_hasta = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default="BORRADOR")
    resumen_corto = models.CharField(max_length=255, blank=True)
    notas_internas = models.TextField(blank=True)
    
    activo = models.BooleanField(default=True, db_index=True)
    eliminado_en = models.DateTimeField(null=True, blank=True)
    
    total_mano_obra = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_repuestos = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), validators=[MinValueValidator(Decimal("0.00"))])
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), editable=False)

    def enviar_a_eliminados(self):
        self.activo = False
        self.eliminado_en = timezone.now()
        self.save(update_fields=['activo', 'eliminado_en'])

class PresupuestoItem(models.Model):
    TIPO_CHOICES = [("MANO_OBRA", "Mano de obra"), ("REPUESTO", "Repuesto"), ("INSUMO", "Insumo"), ("OTRO", "Otro")]

    presupuesto = models.ForeignKey(Presupuesto, related_name="items", on_delete=models.CASCADE)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default="REPUESTO")
    descripcion = models.CharField(max_length=255)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1.00"))
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), editable=False)

    def save(self, *args, **kwargs):
        self.subtotal = (self.cantidad or Decimal("0.00")) * (self.precio_unitario or Decimal("0.00"))
        super().save(*args, **kwargs)

# ========================
#    COMPRAS Y GASTOS 
# ========================

class Gasto(models.Model):
    TIPO_REPUESTOS = "REPUESTOS"
    TIPO_INSUMOS = "INSUMOS"
    TIPO_SERVICIOS = "SERVICIOS"
    TIPO_OTROS = "OTROS"
    TIPO_CHOICES = [
        (TIPO_REPUESTOS, "Compra de Repuestos"),
        (TIPO_INSUMOS, "Insumos (Aceite, trapos, etc)"),
        (TIPO_SERVICIOS, "Servicios (Luz, Alquiler)"),
        (TIPO_OTROS, "Otros Gastos"),
    ]

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="gastos")
    registrado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="gastos_registrados",
    )
    fecha = models.DateTimeField(default=timezone.now)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default=TIPO_REPUESTOS)
    metodo_pago = models.CharField(
        "Método de pago",
        max_length=20,
        choices=MovimientoCuenta.METODO_CHOICES,
        default="EFECTIVO",
    )
    descripcion = models.CharField(max_length=255)
    monto = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    comprobante = models.CharField(max_length=50, blank=True)


# ========================
#    AUTH / SAAS
# ========================

class Taller(models.Model):
    """Tenant formal: el contenedor aislado de datos y miembros."""
    owner = models.OneToOneField(User, on_delete=models.CASCADE, related_name="taller_propietario")
    nombre = models.CharField(max_length=150)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nombre


class MembresiaTaller(models.Model):
    ROL_ADMIN = "ADMIN"
    ROL_RECEPCION = "RECEPCION"
    ROL_MECANICO = "MECANICO"
    ROL_CONTADOR = "CONTADOR"
    ROL_CHOICES = [
        (ROL_ADMIN, "Administrador"),
        (ROL_RECEPCION, "Recepción"),
        (ROL_MECANICO, "Mecánico"),
        (ROL_CONTADOR, "Contador"),
    ]
    taller = models.ForeignKey(Taller, on_delete=models.CASCADE, related_name="miembros")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="membresias_taller")
    rol = models.CharField(max_length=20, choices=ROL_CHOICES, default=ROL_MECANICO)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["taller", "user"], name="uniq_membresia_taller_usuario")]


class InvitacionTaller(models.Model):
    taller = models.ForeignKey(Taller, on_delete=models.CASCADE, related_name="invitaciones")
    email = models.EmailField()
    rol = models.CharField(max_length=20, choices=MembresiaTaller.ROL_CHOICES)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    expires_at = models.DateTimeField(default=_invitation_expiry_default)
    aceptada_en = models.DateTimeField(null=True, blank=True)
    creada_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="invitaciones_creadas")

    @property
    def vigente(self):
        return self.aceptada_en is None and self.expires_at > timezone.now()


class AuditoriaTaller(models.Model):
    taller = models.ForeignKey(Taller, on_delete=models.CASCADE, related_name="auditoria")
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="acciones_taller")
    accion = models.CharField(max_length=80)
    detalle = models.CharField(max_length=255)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]


TRIAL_DAYS = 7


class PerfilTaller(models.Model):
    """Perfil extendido del usuario: datos del taller para el SaaS multi-tenant."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="perfil")
    nombre = models.CharField(max_length=100, help_text="Nombre del dueño / operador")
    taller_nombre = models.CharField(max_length=150)
    taller_ciudad = models.CharField(max_length=100, blank=True)
    taller_tel = models.CharField(max_length=50, blank=True)
    taller_cuit = models.CharField("CUIT", max_length=20, blank=True)
    logo = models.ImageField(upload_to=logo_taller_upload_to, null=True, blank=True)
    trial_start = models.DateTimeField(auto_now_add=True)
    plan_activo_hasta = models.DateTimeField(
        "Plan pago vigente hasta",
        null=True,
        blank=True,
        help_text="Se completa a mano desde el admin al acordar el pago por WhatsApp. Vacío = solo corre el trial.",
    )

    class Meta:
        verbose_name = "Perfil del Taller"
        verbose_name_plural = "Perfiles de Talleres"

    def __str__(self):
        return f"{self.taller_nombre} ({self.user.email})"

    @property
    def trial_vencido(self) -> bool:
        return timezone.now() >= self.trial_start + timedelta(days=TRIAL_DAYS)

    @property
    def plan_vigente(self) -> bool:
        return bool(self.plan_activo_hasta) and timezone.now() < self.plan_activo_hasta

    @property
    def acceso_vigente(self) -> bool:
        """Puerta de acceso real: trial sin vencer o plan pago activo."""
        return self.plan_vigente or not self.trial_vencido


def _generar_token():
    return secrets.token_hex(32)


def _token_expiry_default():
    return timezone.now() + timedelta(days=30)


class ApiToken(models.Model):
    """Token de autenticación para el frontend Next.js."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="api_token")
    key = models.CharField(max_length=64, unique=True, db_index=True, default=_generar_token)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=_token_expiry_default, db_index=True)

    class Meta:
        verbose_name = "Token API"
        verbose_name_plural = "Tokens API"

    def __str__(self):
        return f"Token de {self.user.email}"

    def rotate(self):
        self.key = _generar_token()
        self.expires_at = _token_expiry_default()
        self.save(update_fields=["key", "expires_at"])
        return self

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()


class RecuperacionContrasena(models.Model):
    """Enlace de recuperación de un solo uso, creado por soporte.

    Nunca se guarda el secreto que viaja en el enlace: sólo su hash. Al emitir
    uno nuevo, los anteriores se vencen y al usarlo queda inutilizable.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="recuperaciones_contrasena")
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    usada_en = models.DateTimeField(null=True, blank=True)
    creada_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="recuperaciones_creadas")
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Recuperación de contraseña"
        verbose_name_plural = "Recuperaciones de contraseña"
        ordering = ["-creada_en"]

    @property
    def vigente(self):
        return self.usada_en is None and self.expires_at > timezone.now()
