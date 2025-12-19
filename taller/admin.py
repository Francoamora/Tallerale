from django.contrib import admin
from .models import Cliente, Vehiculo, Trabajo, TrabajoItem, MovimientoCuenta, Turno


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ("nombre_completo", "telefono", "email", "saldo_actual")
    search_fields = ("nombre", "apellido", "telefono", "email", "dni")
    list_per_page = 25


@admin.register(Vehiculo)
class VehiculoAdmin(admin.ModelAdmin):
    list_display = ("patente", "marca", "modelo", "anio", "cliente", "kilometraje_actual")
    search_fields = ("patente", "marca", "modelo", "cliente__nombre", "cliente__apellido")
    list_filter = ("marca", "anio")
    list_per_page = 25


class TrabajoItemInline(admin.TabularInline):
    model = TrabajoItem
    extra = 1


@admin.register(Trabajo)
class TrabajoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "vehiculo",
        "cliente",
        "fecha_ingreso",
        "estado",
        "estado_general",
        "total",
    )
    list_filter = ("estado", "estado_general", "fecha_ingreso")
    search_fields = ("vehiculo__patente", "cliente__nombre", "cliente__apellido")
    inlines = [TrabajoItemInline]
    date_hierarchy = "fecha_ingreso"


@admin.register(MovimientoCuenta)
class MovimientoCuentaAdmin(admin.ModelAdmin):
    list_display = ("fecha", "cliente", "tipo", "monto", "trabajo")
    list_filter = ("tipo", "fecha")
    search_fields = ("cliente__nombre", "cliente__apellido", "trabajo__vehiculo__patente")
    date_hierarchy = "fecha"


@admin.register(Turno)
class TurnoAdmin(admin.ModelAdmin):
    list_display = ("fecha_hora", "cliente", "vehiculo", "motivo", "estado")
    list_filter = ("estado", "fecha_hora")
    search_fields = ("cliente__nombre", "cliente__apellido", "vehiculo__patente", "motivo")
    date_hierarchy = "fecha_hora"
