from django.contrib import admin, messages

from .models import (
    ApiToken,
    Cliente,
    Gasto,
    MovimientoCuenta,
    PerfilTaller,
    Presupuesto,
    PresupuestoItem,
    Trabajo,
    TrabajoItem,
    Turno,
    Vehiculo,
)


class TenantScopedAdmin(admin.ModelAdmin):
    list_per_page = 25


@admin.register(PerfilTaller)
class PerfilTallerAdmin(TenantScopedAdmin):
    list_display = ("taller_nombre", "nombre", "user", "taller_ciudad", "taller_tel", "trial_start")
    search_fields = ("taller_nombre", "nombre", "user__email", "user__username", "taller_tel")
    readonly_fields = ("trial_start",)


@admin.register(ApiToken)
class ApiTokenAdmin(TenantScopedAdmin):
    list_display = ("user", "email", "short_key", "created_at")
    search_fields = ("user__email", "user__username")
    readonly_fields = ("created_at", "key")
    actions = ("rotate_tokens",)

    @admin.display(description="Email")
    def email(self, obj):
        return obj.user.email or obj.user.username

    @admin.display(description="Token")
    def short_key(self, obj):
        return f"{obj.key[:10]}..."

    @admin.action(description="Rotar tokens seleccionados")
    def rotate_tokens(self, request, queryset):
        count = 0
        for api_token in queryset:
            api_token.rotate()
            count += 1
        self.message_user(request, f"Se rotaron {count} token(s).", level=messages.SUCCESS)


@admin.register(Cliente)
class ClienteAdmin(TenantScopedAdmin):
    list_display = ("nombre_completo", "owner", "telefono", "email", "saldo_actual")
    search_fields = ("nombre", "apellido", "telefono", "email", "dni", "owner__email", "owner__username")
    list_filter = ("owner",)


@admin.register(Vehiculo)
class VehiculoAdmin(TenantScopedAdmin):
    list_display = ("patente", "owner", "marca", "modelo", "anio", "cliente", "kilometraje_actual")
    search_fields = ("patente", "marca", "modelo", "cliente__nombre", "cliente__apellido", "owner__email")
    list_filter = ("owner", "marca", "anio")
    readonly_fields = ("token",)


class TrabajoItemInline(admin.TabularInline):
    model = TrabajoItem
    extra = 0


@admin.register(Trabajo)
class TrabajoAdmin(TenantScopedAdmin):
    list_display = ("id", "owner", "vehiculo", "cliente", "fecha_ingreso", "estado", "estado_general", "total")
    list_filter = ("owner", "estado", "estado_general", "fecha_ingreso")
    search_fields = ("vehiculo__patente", "cliente__nombre", "cliente__apellido", "owner__email")
    inlines = [TrabajoItemInline]
    date_hierarchy = "fecha_ingreso"


@admin.register(MovimientoCuenta)
class MovimientoCuentaAdmin(TenantScopedAdmin):
    list_display = ("fecha", "owner", "cliente", "tipo", "monto", "trabajo")
    list_filter = ("owner", "tipo", "fecha", "metodo_pago")
    search_fields = ("cliente__nombre", "cliente__apellido", "trabajo__vehiculo__patente", "owner__email")
    date_hierarchy = "fecha"


@admin.register(Turno)
class TurnoAdmin(TenantScopedAdmin):
    list_display = ("fecha_hora", "owner", "cliente", "vehiculo", "motivo", "estado")
    list_filter = ("owner", "estado", "fecha_hora")
    search_fields = ("cliente__nombre", "cliente__apellido", "vehiculo__patente", "motivo", "owner__email")
    date_hierarchy = "fecha_hora"


class PresupuestoItemInline(admin.TabularInline):
    model = PresupuestoItem
    extra = 0


@admin.register(Presupuesto)
class PresupuestoAdmin(TenantScopedAdmin):
    list_display = ("id", "owner", "cliente", "vehiculo", "estado", "fecha_creacion", "total")
    list_filter = ("owner", "estado", "fecha_creacion", "activo")
    search_fields = ("cliente__nombre", "cliente__apellido", "vehiculo__patente", "resumen_corto", "owner__email")
    readonly_fields = ("token",)
    inlines = [PresupuestoItemInline]
    date_hierarchy = "fecha_creacion"


@admin.register(Gasto)
class GastoAdmin(TenantScopedAdmin):
    list_display = ("fecha", "owner", "tipo", "descripcion", "monto", "comprobante")
    list_filter = ("owner", "tipo", "fecha")
    search_fields = ("descripcion", "comprobante", "owner__email")
    date_hierarchy = "fecha"
