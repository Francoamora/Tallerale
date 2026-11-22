"""Usuarios y datos de prueba para el entorno local.

    python manage.py seed_demo

Crea (o repara) un taller de demo con una cuenta por rol, todas con la misma
contraseña de desarrollo, más una cuenta de soporte con acceso al Centro CEO:

    Rol            Usuario                      Contraseña
    -------------  ---------------------------  -----------------
    Administrador  demo@tallerista.test         Taller-Local-2026
    Recepción      recepcion@tallerista.test    Taller-Local-2026
    Mecánico       mecanico@tallerista.test     Taller-Local-2026
    Contador       contador@tallerista.test     Taller-Local-2026
    Soporte (CEO)  soporte@tallerista.test      Taller-Local-2026

Es idempotente: si las cuentas ya existen les vuelve a poner esta contraseña,
así que sirve también para recuperar el acceso local. Sólo corre con DEBUG
activo: en producción no deben existir cuentas con una contraseña publicada
en el repositorio.
"""
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from taller.models import (
    Cliente,
    Gasto,
    MembresiaTaller,
    MovimientoCuenta,
    PerfilTaller,
    Presupuesto,
    PresupuestoItem,
    Taller,
    Trabajo,
    TrabajoItem,
    Turno,
    Vehiculo,
)

PASSWORD_LOCAL = "Taller-Local-2026"
TALLER_NOMBRE = "Taller San Martín"

DUENO = ("demo@tallerista.test", "Franco", "Mora")
EMPLEADOS = (
    ("recepcion@tallerista.test", "Lucía", "Recepción", MembresiaTaller.ROL_RECEPCION),
    ("mecanico@tallerista.test", "Diego", "Mecánico", MembresiaTaller.ROL_MECANICO),
    ("contador@tallerista.test", "Marta", "Contadora", MembresiaTaller.ROL_CONTADOR),
)
SOPORTE = ("soporte@tallerista.test", "Soporte", "Tallerista")

CLIENTES = (
    # nombre, apellido, teléfono, saldo, patente, marca, modelo, año, km, faltan_km
    ("Marcela", "Ríos", "342-5551020", "0", "AB123CD", "Volkswagen", "Amarok", 2021, 142_000, 800),
    ("Jorge", "Benítez", "342-5559911", "45000", "AC456EF", "Ford", "Ranger", 2019, 98_000, 1_500),
    ("Lucía", "Ferreyra", "342-5553388", "0", "AD789GH", "Toyota", "Hilux", 2022, 61_000, 9_000),
    ("Diego", "Sosa", "342-5557744", "128000", "AE321IJ", "Chevrolet", "Onix", 2020, 77_000, 9_000),
    ("Paula", "Giménez", "342-5552266", "7500", "AF654KL", "Renault", "Kangoo", 2018, 180_000, 9_000),
)
# Clientes que vinieron hace meses y no volvieron (para "Clientes para
# recuperar"): nombre, apellido, teléfono, patente, marca, modelo, año, km,
# meses desde la última visita, trabajo.
CLIENTES_INACTIVOS = (
    ("Ramiro", "Acosta", "342-5554411", "AG987MN", "Fiat", "Cronos", 2021, 64_000, 7, "Service de 60.000 km"),
    ("Silvina", "Paz", "342-5556622", "AH246OP", "Peugeot", "208", 2020, 88_000, 9, "Cambio de amortiguadores"),
    ("Hernán", "Ledesma", "342-5558833", "AI135QR", "Toyota", "Etios", 2017, 151_000, 12, "Embrague completo"),
)
# Visitas viejas (ya entregadas) para que el historial de algunos autos tenga
# más de un año: patente, días atrás, km, resumen, recomendación, ítems.
HISTORIAL_VIEJO = (
    ("AD789GH", 540, 32_000, "Service de 30.000 km", "", (("MANO_OBRA", "Service completo"), ("REPUESTO", "Aceite 5W30 sintético"), ("REPUESTO", "Filtro de aceite"), ("REPUESTO", "Filtro de aire"))),
    ("AD789GH", 330, 45_000, "Cambio de neumáticos y alineación", "", (("MANO_OBRA", "Alineación"), ("MANO_OBRA", "Balanceo de 4 ruedas"), ("REPUESTO", "Neumáticos 265/65 R17"))),
    ("AD789GH", 150, 53_500, "Service de 50.000 km", "Revisar pastillas delanteras.", (("MANO_OBRA", "Service completo"), ("REPUESTO", "Aceite 5W30 sintético"), ("REPUESTO", "Filtro de aceite"), ("REPUESTO", "Filtro de combustible"), ("MANO_OBRA", "Limpieza de inyectores"))),
    ("AB123CD", 400, 120_000, "Service de 120.000 km", "", (("MANO_OBRA", "Service completo"), ("REPUESTO", "Aceite 5W40"), ("REPUESTO", "Filtro de aceite"), ("REPUESTO", "Filtro de aire"))),
    ("AB123CD", 200, 131_000, "Frenos traseros", "", (("MANO_OBRA", "Cambio de cintas de freno"), ("REPUESTO", "Cintas de freno traseras"), ("INSUMO", "Líquido de frenos DOT4"))),
)

MOTIVOS_TURNO = (
    "Revisión general", "Service de 100.000 km", "Diagnóstico de ruido",
    "Cambio de aceite y filtros", "Control de frenos", "Alineación y balanceo",
)

# Lo que se le hizo a cada auto (tipo, descripción): es lo que muestra el
# historial del vehículo, así que va con detalle real y no "Mano de obra".
DETALLE_TRABAJOS = (
    (("MANO_OBRA", "Cambio de correa de distribución"), ("MANO_OBRA", "Cambio de bomba de agua"), ("REPUESTO", "Kit de distribución"), ("REPUESTO", "Bomba de agua")),
    (("MANO_OBRA", "Service completo"), ("REPUESTO", "Aceite 5W30 sintético"), ("REPUESTO", "Filtro de aceite"), ("REPUESTO", "Filtro de aire")),
    (("MANO_OBRA", "Cambio de pastillas delanteras"), ("MANO_OBRA", "Rectificado de discos"), ("REPUESTO", "Pastillas de freno delanteras")),
    (("MANO_OBRA", "Cambio de embrague"), ("REPUESTO", "Kit de embrague"), ("REPUESTO", "Cilindro de embrague")),
    (("MANO_OBRA", "Alineación"), ("MANO_OBRA", "Balanceo de 4 ruedas"), ("INSUMO", "Contrapesos")),
)
RECOMENDACIONES = (
    "", "", "Revisar discos traseros en el próximo service.", "Controlar fluido de embrague a los 10.000 km.", "",
)

TRABAJOS = (
    # resumen, estado, mano de obra, repuestos
    ("Cambio de correa de distribución", Trabajo.ESTADO_EN_PROCESO, "85000", "120000"),
    ("Service completo + filtros", Trabajo.ESTADO_INGRESADO, "42000", "65000"),
    ("Frenos delanteros y pastillas", Trabajo.ESTADO_FINALIZADO, "56000", "48000"),
    ("Embrague y cilindro", Trabajo.ESTADO_ENTREGADO, "190000", "230000"),
    ("Alineación y balanceo", Trabajo.ESTADO_EN_PROCESO, "28000", "15000"),
)


def _cuenta(email: str, nombre: str, apellido: str, *, superusuario: bool = False) -> User:
    user, _ = User.objects.get_or_create(
        username=email,
        defaults={"email": email, "first_name": nombre, "last_name": apellido},
    )
    user.email = email
    user.is_active = True
    user.is_superuser = superusuario
    user.is_staff = superusuario
    user.set_password(PASSWORD_LOCAL)
    user.save()
    return user


class Command(BaseCommand):
    help = "Crea o repara las cuentas y los datos de prueba del entorno local (sólo con DEBUG)."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "seed_demo sólo corre con DEBUG activo: crea cuentas con una "
                "contraseña publicada en el repositorio."
            )

        with transaction.atomic():
            dueno = _cuenta(*DUENO)
            # Plan vigente para que el corte por prueba vencida (402) no bloquee
            # el entorno local a los 7 días.
            PerfilTaller.objects.update_or_create(
                user=dueno,
                defaults={
                    "nombre": f"{DUENO[1]} {DUENO[2]}",
                    "taller_nombre": TALLER_NOMBRE,
                    "taller_ciudad": "Santa Fe",
                    "taller_tel": "342-4567890",
                    "plan_activo_hasta": timezone.now() + timedelta(days=3650),
                },
            )
            taller, _ = Taller.objects.get_or_create(owner=dueno, defaults={"nombre": TALLER_NOMBRE})
            MembresiaTaller.objects.update_or_create(
                taller=taller, user=dueno, defaults={"rol": MembresiaTaller.ROL_ADMIN, "activo": True},
            )

            for email, nombre, apellido, rol in EMPLEADOS:
                empleado = _cuenta(email, nombre, apellido)
                MembresiaTaller.objects.update_or_create(
                    taller=taller, user=empleado, defaults={"rol": rol, "activo": True},
                )

            _cuenta(*SOPORTE, superusuario=True)

            if not Cliente.objects.filter(owner=dueno).exists():
                self._cargar_datos(dueno)
            # Se corre siempre: la agenda de prueba vence con los días.
            self._refrescar_agenda(dueno)

        self.stdout.write(self.style.SUCCESS(f"Entorno local listo: {TALLER_NOMBRE}"))
        self.stdout.write(f"Contraseña de todas las cuentas: {PASSWORD_LOCAL}")
        roles = dict(MembresiaTaller.ROL_CHOICES)
        for email, rol in (
            (DUENO[0], roles[MembresiaTaller.ROL_ADMIN]),
            *((email, roles[rol]) for email, _, _, rol in EMPLEADOS),
            (SOPORTE[0], "Soporte (Centro CEO)"),
        ):
            self.stdout.write(f"  {rol:<22} {email}")

    def _cargar_datos(self, dueno: User) -> None:
        ahora = timezone.now()
        for i, (nombre, apellido, tel, saldo, patente, marca, modelo, anio, km, faltan) in enumerate(CLIENTES):
            cliente = Cliente.objects.create(
                owner=dueno, nombre=nombre, apellido=apellido, telefono=tel, saldo_balance=Decimal(saldo),
            )
            vehiculo = Vehiculo.objects.create(
                owner=dueno, cliente=cliente, patente=patente, marca=marca, modelo=modelo,
                anio=anio, kilometraje_actual=km, proximo_service_km=km + faltan,
            )
            resumen, estado, mano_obra, repuestos = TRABAJOS[i]
            trabajo = Trabajo(
                owner=dueno, cliente=cliente, vehiculo=vehiculo, kilometraje=km,
                resumen_trabajos=resumen, estado=estado,
                total_mano_obra=Decimal(mano_obra), total_repuestos=Decimal(repuestos),
            )
            trabajo.total = trabajo.calcular_total()
            trabajo.save()
            detalle = DETALLE_TRABAJOS[i]
            mano_obra_items = [d for d in detalle if d[0] == "MANO_OBRA"]
            otros_items = [d for d in detalle if d[0] != "MANO_OBRA"]
            terminado = estado in (Trabajo.ESTADO_FINALIZADO, Trabajo.ESTADO_ENTREGADO)
            for tipo, descripcion in detalle:
                grupo, total = (mano_obra_items, trabajo.total_mano_obra) if tipo == "MANO_OBRA" else (otros_items, trabajo.total_repuestos)
                TrabajoItem.objects.create(
                    trabajo=trabajo, tipo=tipo, descripcion=descripcion, cantidad=1,
                    precio_unitario=(Decimal(total) / len(grupo)).quantize(Decimal("1")), completado=terminado,
                )
            if RECOMENDACIONES[i]:
                trabajo.recomendaciones_proximo_service = RECOMENDACIONES[i]
                trabajo.save(update_fields=["recomendaciones_proximo_service"])
            MovimientoCuenta.objects.create(
                owner=dueno, cliente=cliente, tipo=MovimientoCuenta.TIPO_PAGO,
                monto=Decimal("40000"), metodo_pago="EFECTIVO", descripcion="Abono",
                fecha=ahora - timedelta(days=i * 20),
            )
            if i < 3:
                Turno.objects.create(
                    owner=dueno, cliente=cliente, vehiculo=vehiculo,
                    fecha_hora=timezone.localtime(ahora).replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1, hours=i * 2),
                    motivo=("Revisión general", "Service de 100.000 km", "Diagnóstico de ruido")[i],
                )
            if i < 2:
                presupuesto = Presupuesto.objects.create(
                    owner=dueno, cliente=cliente, vehiculo=vehiculo, estado="ENVIADO",
                    resumen_corto=("Distribución completa", "Tren delantero")[i],
                    total_mano_obra=Decimal("90000"), total_repuestos=Decimal("140000"),
                    total=Decimal("230000"),
                )
                items_presupuesto = (
                    (("MANO_OBRA", "Cambio de correa de distribución", 1, "90000"), ("REPUESTO", "Kit de distribución", 1, "110000"), ("REPUESTO", "Bomba de agua", 1, "30000")),
                    (("MANO_OBRA", "Reparación de tren delantero", 1, "60000"), ("MANO_OBRA", "Alineación y balanceo", 1, "30000"), ("REPUESTO", "Bujes de parrilla", 2, "35000"), ("REPUESTO", "Rótulas", 2, "35000")),
                )[i]
                for tipo, descripcion, cantidad, precio in items_presupuesto:
                    PresupuestoItem.objects.create(
                        presupuesto=presupuesto, tipo=tipo, descripcion=descripcion,
                        cantidad=cantidad, precio_unitario=Decimal(precio),
                    )
            Gasto.objects.create(
                owner=dueno, descripcion=("Aceite 20L", "Juego de filtros", "Luz del taller", "Pastillas de freno", "Insumos varios")[i],
                monto=Decimal(("85000", "45000", "120000", "67000", "23000")[i]),
                tipo=(Gasto.TIPO_REPUESTOS, Gasto.TIPO_REPUESTOS, Gasto.TIPO_SERVICIOS, Gasto.TIPO_REPUESTOS, Gasto.TIPO_INSUMOS)[i],
                registrado_por=dueno,
            )

    def _refrescar_agenda(self, dueno: User) -> None:
        """Deja turnos por delante y clientes para recuperar (idempotente)."""
        ahora = timezone.now()
        local = timezone.localtime(ahora)

        vehiculos = list(Vehiculo.objects.filter(owner=dueno).select_related("cliente").order_by("id")[:5])
        hay_turnos = Turno.objects.filter(owner=dueno, fecha_hora__gte=ahora).exclude(estado__in=["CANCELADO", "CUMPLIDO"]).exists()
        if vehiculos and not hay_turnos:
            # Hoy (si todavía queda jornada), mañana y los días siguientes.
            inicio = local.replace(hour=9, minute=0, second=0, microsecond=0)
            horarios = [inicio + timedelta(days=d, hours=h) for d, h in ((0, 6), (0, 8), (1, 0), (1, 2), (2, 1), (3, 0))]
            horarios = [h for h in horarios if h > local]
            for i, fecha in enumerate(horarios):
                vehiculo = vehiculos[i % len(vehiculos)]
                Turno.objects.create(
                    owner=dueno, cliente=vehiculo.cliente, vehiculo=vehiculo, fecha_hora=fecha,
                    motivo=MOTIVOS_TURNO[i % len(MOTIVOS_TURNO)],
                    estado="CONFIRMADO" if i % 2 == 0 else "PENDIENTE",
                )

        for nombre, apellido, tel, patente, marca, modelo, anio, km, meses, resumen in CLIENTES_INACTIVOS:
            if Vehiculo.objects.filter(owner=dueno, patente=patente).exists():
                continue
            cliente = Cliente.objects.create(owner=dueno, nombre=nombre, apellido=apellido, telefono=tel)
            vehiculo = Vehiculo.objects.create(
                owner=dueno, cliente=cliente, patente=patente, marca=marca, modelo=modelo,
                anio=anio, kilometraje_actual=km, proximo_service_km=km + 10_000,
            )
            trabajo = Trabajo(
                owner=dueno, cliente=cliente, vehiculo=vehiculo, kilometraje=km,
                resumen_trabajos=resumen, estado=Trabajo.ESTADO_ENTREGADO,
                total_mano_obra=Decimal("60000"), total_repuestos=Decimal("80000"),
                fecha_ingreso=ahora - timedelta(days=meses * 30),
            )
            trabajo.total = trabajo.calcular_total()
            trabajo.save()

        # Historial viejo: sólo si el auto todavía no tiene visitas anteriores.
        for patente, dias, km, resumen, recomendacion, items in HISTORIAL_VIEJO:
            vehiculo = Vehiculo.objects.filter(owner=dueno, patente=patente).select_related("cliente").first()
            if not vehiculo:
                continue
            fecha = ahora - timedelta(days=dias)
            if Trabajo.objects.filter(vehiculo=vehiculo, fecha_ingreso__date=fecha.date()).exists():
                continue
            trabajo = Trabajo(
                owner=dueno, cliente=vehiculo.cliente, vehiculo=vehiculo, kilometraje=km,
                resumen_trabajos=resumen, estado=Trabajo.ESTADO_ENTREGADO, fecha_ingreso=fecha,
                finalizado_en=fecha + timedelta(days=1), fecha_egreso_real=fecha + timedelta(days=1),
                recomendaciones_proximo_service=recomendacion,
                total_mano_obra=Decimal("45000"), total_repuestos=Decimal("60000"),
            )
            trabajo.total = trabajo.calcular_total()
            trabajo.save()
            for tipo, descripcion in items:
                TrabajoItem.objects.create(
                    trabajo=trabajo, tipo=tipo, descripcion=descripcion, cantidad=1,
                    precio_unitario=Decimal("15000"), completado=True,
                )
