# taller/models.py
import secrets
import uuid
from decimal import Decimal
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q
from django.core.validators import MinValueValidator
from django.utils import timezone

# ========================
#    SISTEMA (SAAS / NUEVO)
# ========================

class ConfiguracionTaller(models.Model):
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
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="clientes", null=True, blank=True)
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
    codigo = models.CharField(max_length=50, unique=True)
    nombre = models.CharField(max_length=200)
    stock_actual = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_minimo = models.DecimalField(max_digits=10, decimal_places=2, default=5)
    precio_costo = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    precio_venta = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Producto / Repuesto"
        verbose_name_plural = "Productos y Repuestos"

    def __str__(self):
        return f"[{self.codigo}] {self.nombre}"

# ========================
#    VEHÍCULOS
# ========================

class Vehiculo(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="vehiculos", null=True, blank=True)
    cliente = models.ForeignKey(Cliente, related_name="vehiculos", on_delete=models.CASCADE)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
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

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="trabajos", null=True, blank=True)
    vehiculo = models.ForeignKey(Vehiculo, related_name="trabajos", on_delete=models.CASCADE)
    cliente = models.ForeignKey(Cliente, related_name="trabajos", on_delete=models.PROTECT)

    fecha_ingreso = models.DateTimeField(default=timezone.now)
    fecha_egreso_estimado = models.DateTimeField(null=True, blank=True)
    fecha_egreso_real = models.DateTimeField(null=True, blank=True)

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

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="movimientos_cuenta", null=True, blank=True)
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

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="turnos_agenda", null=True, blank=True)
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

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="presupuestos", null=True, blank=True)
    cliente = models.ForeignKey(Cliente, related_name="presupuestos", on_delete=models.PROTECT, null=True, blank=True)
    vehiculo = models.ForeignKey(Vehiculo, related_name="presupuestos", on_delete=models.PROTECT, null=True, blank=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)

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

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="gastos", null=True, blank=True)
    fecha = models.DateTimeField(default=timezone.now)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default=TIPO_REPUESTOS)
    descripcion = models.CharField(max_length=255)
    monto = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    comprobante = models.CharField(max_length=50, blank=True)


# ========================
#    AUTH / SAAS
# ========================

class PerfilTaller(models.Model):
    """Perfil extendido del usuario: datos del taller para el SaaS multi-tenant."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="perfil")
    nombre = models.CharField(max_length=100, help_text="Nombre del dueño / operador")
    taller_nombre = models.CharField(max_length=150)
    taller_ciudad = models.CharField(max_length=100, blank=True)
    taller_tel = models.CharField(max_length=50, blank=True)
    trial_start = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Perfil del Taller"
        verbose_name_plural = "Perfiles de Talleres"

    def __str__(self):
        return f"{self.taller_nombre} ({self.user.email})"


def _generar_token():
    return secrets.token_hex(32)


class ApiToken(models.Model):
    """Token de autenticación para el frontend Next.js."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="api_token")
    key = models.CharField(max_length=64, unique=True, db_index=True, default=_generar_token)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Token API"
        verbose_name_plural = "Tokens API"

    def __str__(self):
        return f"Token de {self.user.email}"

    def rotate(self):
        self.key = _generar_token()
        self.save(update_fields=["key"])
        return self
