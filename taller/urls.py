# taller/urls.py
from django.urls import path

from .views import (
    DashboardView,

    # Clientes
    ClienteListView, ClienteCreateView, ClienteDetailView, ClienteUpdateView,

    # Vehículos
    VehiculoListView, VehiculoCreateView, VehiculoDetailView, VehiculoUpdateView,

    # Trabajos
    TrabajoListView, TrabajoDetailView,
    TrabajoComprobanteView, TrabajoComprobantePDFView,
    trabajo_create, trabajo_update,
    TrabajoDeleteView, TrabajoRestoreView, TrabajoPapeleraListView,

    # Movimientos
    movimiento_cuenta_create,

    # Turnos
    TurnoListView, TurnoDetailView, TurnoCreateView, TurnoUpdateView,

    # API
    vehiculos_por_cliente_json,

    # Presupuestos
    PresupuestoListView, PresupuestoDetailView,
    PresupuestoComprobanteView,
    presupuesto_create_detallado, presupuesto_update,
    PresupuestoDeleteView, PresupuestoRestoreView, PresupuestoPapeleraListView,
)

app_name = "taller"

urlpatterns = [
    # ========================
    # DASHBOARD
    # ========================
    path("", DashboardView.as_view(), name="dashboard"),

    # ========================
    # CLIENTES
    # ========================
    path("clientes/", ClienteListView.as_view(), name="cliente_list"),
    path("clientes/nuevo/", ClienteCreateView.as_view(), name="cliente_create"),
    path("clientes/<int:pk>/", ClienteDetailView.as_view(), name="cliente_detail"),
    path("clientes/<int:pk>/editar/", ClienteUpdateView.as_view(), name="cliente_update"),
    path("clientes/<int:cliente_id>/movimientos/nuevo/", movimiento_cuenta_create, name="movimiento_cuenta_create"),

    # ========================
    # VEHÍCULOS
    # ========================
    path("vehiculos/", VehiculoListView.as_view(), name="vehiculo_list"),
    path("vehiculos/nuevo/", VehiculoCreateView.as_view(), name="vehiculo_create"),
    path("vehiculos/<int:pk>/", VehiculoDetailView.as_view(), name="vehiculo_detail"),
    path("vehiculos/<int:pk>/editar/", VehiculoUpdateView.as_view(), name="vehiculo_update"),

    # ========================
    # TRABAJOS
    # ========================
    path("trabajos/", TrabajoListView.as_view(), name="trabajo_list"),
    path("trabajos/eliminados/", TrabajoPapeleraListView.as_view(), name="trabajo_papelera"),
    path("trabajos/nuevo/", trabajo_create, name="trabajo_create"),
    path("trabajos/<int:pk>/", TrabajoDetailView.as_view(), name="trabajo_detail"),
    path("trabajos/<int:pk>/editar/", trabajo_update, name="trabajo_update"),

    path("trabajos/<int:pk>/comprobante/", TrabajoComprobanteView.as_view(), name="trabajo_comprobante"),
    path("trabajos/<int:pk>/pdf/", TrabajoComprobantePDFView.as_view(), name="trabajo_comprobante_pdf"),

    # ✅ soft delete / restore (deberían ser POST-only en views)
    path("trabajos/<int:pk>/eliminar/", TrabajoDeleteView.as_view(), name="trabajo_delete"),
    path("trabajos/<int:pk>/restaurar/", TrabajoRestoreView.as_view(), name="trabajo_restore"),

    # ========================
    # PRESUPUESTOS
    # ========================
    path("presupuestos/", PresupuestoListView.as_view(), name="presupuesto_list"),
    path("presupuestos/eliminados/", PresupuestoPapeleraListView.as_view(), name="presupuesto_papelera"),

    # Ruta recomendada: un solo flujo (DETALLADO)
    path("presupuestos/nuevo/", presupuesto_create_detallado, name="presupuesto_create"),

    # Compatibilidad: mantener rutas viejas (ambas crean DETALLADO)
    path("presupuestos/nuevo/rapido/", presupuesto_create_detallado, name="presupuesto_create_rapido"),
    path("presupuestos/nuevo/detallado/", presupuesto_create_detallado, name="presupuesto_create_detallado"),

    path("presupuestos/<int:pk>/", PresupuestoDetailView.as_view(), name="presupuesto_detail"),
    path("presupuestos/<int:pk>/editar/", presupuesto_update, name="presupuesto_update"),
    path("presupuestos/<int:pk>/comprobante/", PresupuestoComprobanteView.as_view(), name="presupuesto_comprobante"),

    # ✅ soft delete / restore (deberían ser POST-only en views)
    path("presupuestos/<int:pk>/eliminar/", PresupuestoDeleteView.as_view(), name="presupuesto_delete"),
    path("presupuestos/<int:pk>/restaurar/", PresupuestoRestoreView.as_view(), name="presupuesto_restore"),

    # ========================
    # TURNOS
    # ========================
    path("turnos/", TurnoListView.as_view(), name="turno_list"),
    path("turnos/nuevo/", TurnoCreateView.as_view(), name="turno_create"),
    path("turnos/<int:pk>/", TurnoDetailView.as_view(), name="turno_detail"),
    path("turnos/<int:pk>/editar/", TurnoUpdateView.as_view(), name="turno_update"),

    # ========================
    # API
    # ========================
    path("api/vehiculos-por-cliente/", vehiculos_por_cliente_json, name="vehiculos_por_cliente_json"),
]
