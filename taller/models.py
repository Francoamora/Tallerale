from decimal import Decimal

from django.db import models
from django.db.models import Q
from django.core.validators import MinValueValidator
from django.utils import timezone


# ========================
#    CLIENTES
# ========================

class Cliente(models.Model):
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100, blank=True)
    telefono = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    dni = models.CharField("DNI / CUIT", max_length=20, blank=True)
    direccion = models.CharField(max_length=255, blank=True)
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
        """
        Devuelve el saldo actual del cliente:
        deudas (DEUDA) – pagos (PAGO).
        """
        total_deudas = (
            self.movimientos_cuenta.filter(tipo=MovimientoCuenta.TIPO_DEUDA)
            .aggregate(models.Sum("monto"))["monto__sum"] or Decimal("0.00")
        )
        total_pagos = (
            self.movimientos_cuenta.filter(tipo=MovimientoCuenta.TIPO_PAGO)
            .aggregate(models.Sum("monto"))["monto__sum"] or Decimal("0.00")
        )
        return total_deudas - total_pagos


# ========================
#    VEHÍCULOS
# ========================

class Vehiculo(models.Model):
    cliente = models.ForeignKey(
        Cliente,
        related_name="vehiculos",
        on_delete=models.CASCADE,
    )
    patente = models.CharField(max_length=10, unique=True)
    marca = models.CharField(max_length=50)
    modelo = models.CharField(max_length=100)
    anio = models.PositiveIntegerField("Año", null=True, blank=True)
    color = models.CharField(max_length=50, blank=True)

    kilometraje_actual = models.PositiveIntegerField(
        default=0,
        help_text="Último kilometraje registrado.",
    )
    estado_cubiertas = models.CharField(
        max_length=200,
        blank=True,
        help_text="Ej: Delanteras 70%, traseras 40%.",
    )
    proximo_service_km = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Kilometraje sugerido para el próximo control.",
    )
    proximo_service_fecha = models.DateField(
        null=True,
        blank=True,
        help_text="Fecha sugerida para el próximo control.",
    )
    notas = models.TextField(
        blank=True,
        help_text="Observaciones generales del vehículo.",
    )

    class Meta:
        verbose_name = "Vehículo"
        verbose_name_plural = "Vehículos"
        ordering = ["patente"]

    def __str__(self):
        return f"{self.patente} – {self.marca} {self.modelo}"


# ========================
#    TRABAJOS
# ========================

class Trabajo(models.Model):
    """
    Orden de trabajo / intervención sobre el vehículo.
    De acá sale el comprobante premium para entregar al cliente.
    """

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

    vehiculo = models.ForeignKey(
        Vehiculo,
        related_name="trabajos",
        on_delete=models.CASCADE,
    )
    cliente = models.ForeignKey(
        Cliente,
        related_name="trabajos",
        on_delete=models.PROTECT,
        help_text="Cliente asociado al trabajo (por lo general dueño del vehículo).",
    )

    fecha_ingreso = models.DateTimeField(default=timezone.now)
    fecha_egreso_estimado = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha/hora estimada de entrega.",
    )
    fecha_egreso_real = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha/hora real de entrega.",
    )

    kilometraje = models.PositiveIntegerField(
        help_text="Kilometraje al momento del trabajo."
    )

    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default=ESTADO_INGRESADO,
    )

    resumen_trabajos = models.TextField(
        help_text="Resumen claro y entendible para el comprobante.",
    )
    observaciones_cliente = models.TextField(
        blank=True,
        help_text="Lo que comenta el cliente (ruidos, fallas, etc.).",
    )
    observaciones_internas = models.TextField(
        blank=True,
        help_text="Notas internas del taller.",
    )

    estado_general = models.CharField(
        max_length=20,
        choices=ESTADO_GENERAL_CHOICES,
        default=ESTADO_GENERAL_BUENO,
        help_text="Evaluación general del vehículo.",
    )
    estado_cubiertas_trabajo = models.CharField(
        max_length=200,
        blank=True,
        help_text="Estado de cubiertas observado en ESTE trabajo.",
    )
    recomendaciones_proximo_service = models.TextField(
        blank=True,
        help_text="Cosas a revisar / cambiar en la próxima visita.",
    )
    proximo_control_km = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Ej: revisar a los 150.000 km.",
    )

    # ✅ Baja lógica (PRO)
    activo = models.BooleanField(default=True, db_index=True)
    eliminado_en = models.DateTimeField(null=True, blank=True)

    # Subtotales
    total_mano_obra = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    total_repuestos = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    descuento = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Descuento total aplicado al trabajo.",
    )
    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        editable=False,
    )

    class Meta:
        verbose_name = "Trabajo"
        verbose_name_plural = "Trabajos"
        ordering = ["-fecha_ingreso"]
        constraints = [
            models.CheckConstraint(condition=Q(total_mano_obra__gte=0), name="trabajo_total_mano_obra_gte_0"),
            models.CheckConstraint(condition=Q(total_repuestos__gte=0), name="trabajo_total_repuestos_gte_0"),
            models.CheckConstraint(condition=Q(descuento__gte=0), name="trabajo_descuento_gte_0"),
            models.CheckConstraint(condition=Q(total__gte=0), name="trabajo_total_gte_0"),
        ]

    def __str__(self):
        return f"Trabajo #{self.id} – {self.vehiculo.patente}"

    def calcular_total(self) -> Decimal:
        bruto = (self.total_mano_obra or Decimal("0.00")) + (self.total_repuestos or Decimal("0.00"))
        total = bruto - (self.descuento or Decimal("0.00"))
        return total if total > 0 else Decimal("0.00")

    def enviar_a_eliminados(self):
        self.activo = False
        self.eliminado_en = timezone.now()
        self.save(update_fields=["activo", "eliminado_en"])

    def restaurar(self):
        self.activo = True
        self.eliminado_en = None
        self.save(update_fields=["activo", "eliminado_en"])

    def save(self, *args, **kwargs):
        estados_finales = {self.ESTADO_FINALIZADO, self.ESTADO_ENTREGADO}

        if self.estado in estados_finales and self.fecha_egreso_real is None:
            self.fecha_egreso_real = timezone.now()

        self.total = self.calcular_total()

        if self.kilometraje and (
            not self.vehiculo.kilometraje_actual
            or self.kilometraje > self.vehiculo.kilometraje_actual
        ):
            self.vehiculo.kilometraje_actual = self.kilometraje

        if self.proximo_control_km:
            self.vehiculo.proximo_service_km = self.proximo_control_km

        if self.estado_cubiertas_trabajo:
            self.vehiculo.estado_cubiertas = self.estado_cubiertas_trabajo

        self.vehiculo.save()
        super().save(*args, **kwargs)

        # Genera deuda automática al finalizar/entregar (una sola vez)
        if self.estado in estados_finales and self.total and self.total > 0:
            if not MovimientoCuenta.objects.filter(
                trabajo=self,
                tipo=MovimientoCuenta.TIPO_DEUDA,
            ).exists():
                MovimientoCuenta.objects.create(
                    cliente=self.cliente,
                    trabajo=self,
                    fecha=self.fecha_egreso_real or timezone.now(),
                    tipo=MovimientoCuenta.TIPO_DEUDA,
                    monto=self.total,
                    descripcion=f"Deuda por trabajo #{self.id}",
                )


class TrabajoItem(models.Model):
    TIPO_MANO_OBRA = "MANO_OBRA"
    TIPO_REPUESTO = "REPUESTO"
    TIPO_INSUMO = "INSUMO"
    TIPO_OTRO = "OTRO"
    TIPO_CHOICES = [
        (TIPO_MANO_OBRA, "Mano de obra"),
        (TIPO_REPUESTO, "Repuesto"),
        (TIPO_INSUMO, "Insumo"),
        (TIPO_OTRO, "Otro"),
    ]

    trabajo = models.ForeignKey(
        Trabajo,
        related_name="items",
        on_delete=models.CASCADE,
    )
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default=TIPO_MANO_OBRA,
    )
    descripcion = models.CharField(max_length=255)
    cantidad = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("1.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    precio_unitario = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        editable=False,
    )

    class Meta:
        verbose_name = "Ítem de trabajo"
        verbose_name_plural = "Ítems de trabajo"
        constraints = [
            models.CheckConstraint(condition=Q(cantidad__gt=0), name="trabajoitem_cantidad_gt_0"),
            models.CheckConstraint(condition=Q(precio_unitario__gte=0), name="trabajoitem_precio_unitario_gte_0"),
            models.CheckConstraint(condition=Q(subtotal__gte=0), name="trabajoitem_subtotal_gte_0"),
        ]

    def __str__(self):
        return f"{self.descripcion} ({self.trabajo})"

    def calcular_subtotal(self) -> Decimal:
        return (self.cantidad or Decimal("0.00")) * (self.precio_unitario or Decimal("0.00"))

    def save(self, *args, **kwargs):
        self.subtotal = self.calcular_subtotal()
        super().save(*args, **kwargs)

        trabajo = self.trabajo
        mano_obra = trabajo.items.filter(tipo=self.TIPO_MANO_OBRA).aggregate(
            models.Sum("subtotal")
        )["subtotal__sum"] or Decimal("0.00")
        otros = trabajo.items.exclude(tipo=self.TIPO_MANO_OBRA).aggregate(
            models.Sum("subtotal")
        )["subtotal__sum"] or Decimal("0.00")

        trabajo.total_mano_obra = mano_obra
        trabajo.total_repuestos = otros
        trabajo.total = trabajo.calcular_total()
        trabajo.save(update_fields=["total_mano_obra", "total_repuestos", "total"])


# ========================
#    CUENTA CORRIENTE
# ========================

class MovimientoCuenta(models.Model):
    TIPO_DEUDA = "DEUDA"
    TIPO_PAGO = "PAGO"
    TIPO_CHOICES = [
        (TIPO_DEUDA, "Deuda generada"),
        (TIPO_PAGO, "Pago registrado"),
    ]

    cliente = models.ForeignKey(
        Cliente,
        related_name="movimientos_cuenta",
        on_delete=models.CASCADE,
    )
    trabajo = models.ForeignKey(
        Trabajo,
        related_name="movimientos_cuenta",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        help_text="Trabajo asociado (opcional).",
    )
    fecha = models.DateTimeField(default=timezone.now)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    descripcion = models.CharField(max_length=255, blank=True)
    monto = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        verbose_name = "Movimiento de cuenta"
        verbose_name_plural = "Movimientos de cuenta"
        ordering = ["fecha"]
        constraints = [
            models.CheckConstraint(condition=Q(monto__gte=0), name="movimientocuenta_monto_gte_0"),
        ]

    def __str__(self):
        signo = "+" if self.tipo == self.TIPO_DEUDA else "-"
        return f"{self.fecha.date()} {signo}${self.monto} – {self.cliente}"


# ========================
#    TURNOS
# ========================

class Turno(models.Model):
    ESTADO_PENDIENTE = "PENDIENTE"
    ESTADO_CONFIRMADO = "CONFIRMADO"
    ESTADO_CANCELADO = "CANCELADO"
    ESTADO_CUMPLIDO = "CUMPLIDO"
    ESTADO_CHOICES = [
        (ESTADO_PENDIENTE, "Pendiente"),
        (ESTADO_CONFIRMADO, "Confirmado"),
        (ESTADO_CANCELADO, "Cancelado"),
        (ESTADO_CUMPLIDO, "Cumplido"),
    ]

    cliente = models.ForeignKey(
        Cliente,
        related_name="turnos",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    vehiculo = models.ForeignKey(
        Vehiculo,
        related_name="turnos",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    fecha_hora = models.DateTimeField()
    motivo = models.CharField(max_length=255, help_text="Ej: Service, cambio de embrague, etc.")
    notas = models.TextField(blank=True)
    estado = models.CharField(
        max_length=15,
        choices=ESTADO_CHOICES,
        default=ESTADO_PENDIENTE,
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Turno"
        verbose_name_plural = "Turnos"
        ordering = ["fecha_hora"]
        unique_together = [("fecha_hora", "vehiculo")]

    def __str__(self):
        base = self.motivo
        if self.vehiculo:
            base += f" – {self.vehiculo.patente}"
        return base


# ========================
#    PRESUPUESTOS
# ========================

class Presupuesto(models.Model):
    TIPO_RAPIDO = "RAPIDO"
    TIPO_DETALLADO = "DETALLADO"
    TIPO_CHOICES = [
        (TIPO_RAPIDO, "Presupuesto rápido"),
        (TIPO_DETALLADO, "Presupuesto detallado"),
    ]

    ESTADO_BORRADOR = "BORRADOR"
    ESTADO_ENTREGADO = "ENTREGADO"
    ESTADO_APROBADO = "APROBADO"
    ESTADO_RECHAZADO = "RECHAZADO"
    ESTADO_CHOICES = [
        (ESTADO_BORRADOR, "Borrador"),
        (ESTADO_ENTREGADO, "Entregado"),
        (ESTADO_APROBADO, "Aprobado"),
        (ESTADO_RECHAZADO, "Rechazado"),
    ]

    cliente = models.ForeignKey(
        Cliente,
        related_name="presupuestos",
        on_delete=models.PROTECT,
    )
    vehiculo = models.ForeignKey(
        Vehiculo,
        related_name="presupuestos",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        help_text="Opcional: si todavía no se sabe el vehículo exacto.",
    )

    tipo = models.CharField(max_length=15, choices=TIPO_CHOICES, default=TIPO_DETALLADO)
    fecha = models.DateTimeField(default=timezone.now)
    valido_hasta = models.DateField(null=True, blank=True)

    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default=ESTADO_BORRADOR)

    titulo = models.CharField(max_length=160, default="Presupuesto")
    resumen = models.TextField(help_text="Resumen claro del presupuesto para el cliente.")
    notas_internas = models.TextField(blank=True)

    # ✅ Baja lógica (PRO)
    activo = models.BooleanField(default=True, db_index=True)
    eliminado_en = models.DateTimeField(null=True, blank=True)

    descuento = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Descuento total (solo se muestra si > 0).",
    )

    total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        editable=False,
    )

    class Meta:
        verbose_name = "Presupuesto"
        verbose_name_plural = "Presupuestos"
        ordering = ["-fecha"]
        constraints = [
            models.CheckConstraint(condition=Q(descuento__gte=0), name="presupuesto_descuento_gte_0"),
            models.CheckConstraint(condition=Q(total__gte=0), name="presupuesto_total_gte_0"),
        ]

    def __str__(self):
        return f"Presupuesto #{self.id} – {self.cliente}"

    def calcular_total(self) -> Decimal:
        suma = self.items.aggregate(models.Sum("subtotal"))["subtotal__sum"] or Decimal("0.00")
        total = suma - (self.descuento or Decimal("0.00"))
        return total if total > 0 else Decimal("0.00")

    def enviar_a_eliminados(self):
        self.activo = False
        self.eliminado_en = timezone.now()
        self.save(update_fields=["activo", "eliminado_en"])

    def restaurar(self):
        self.activo = True
        self.eliminado_en = None
        self.save(update_fields=["activo", "eliminado_en"])

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        nuevo_total = self.calcular_total()
        if nuevo_total != self.total:
            self.total = nuevo_total
            super().save(update_fields=["total"])


class PresupuestoItem(models.Model):
    presupuesto = models.ForeignKey(
        Presupuesto,
        related_name="items",
        on_delete=models.CASCADE,
    )

    descripcion = models.CharField(max_length=255)
    cantidad = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("1.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    precio_unitario = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        editable=False,
    )

    class Meta:
        verbose_name = "Ítem de presupuesto"
        verbose_name_plural = "Ítems de presupuesto"
        constraints = [
            models.CheckConstraint(condition=Q(cantidad__gt=0), name="presupuestoitem_cantidad_gt_0"),
            models.CheckConstraint(condition=Q(precio_unitario__gte=0), name="presupuestoitem_precio_unitario_gte_0"),
            models.CheckConstraint(condition=Q(subtotal__gte=0), name="presupuestoitem_subtotal_gte_0"),
        ]

    def __str__(self):
        return f"{self.descripcion} ({self.presupuesto})"

    def calcular_subtotal(self) -> Decimal:
        return (self.cantidad or Decimal("0.00")) * (self.precio_unitario or Decimal("0.00"))

    def save(self, *args, **kwargs):
        self.subtotal = self.calcular_subtotal()
        super().save(*args, **kwargs)

        p = self.presupuesto
        p.total = p.calcular_total()
        p.save(update_fields=["total"])
