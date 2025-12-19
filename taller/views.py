# views.py
from decimal import Decimal, InvalidOperation
import re

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db import transaction
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.views import View
from django.views.generic import TemplateView, ListView, CreateView, UpdateView, DetailView

from .models import (
    Cliente, Vehiculo, Trabajo, Turno, MovimientoCuenta,
    Presupuesto
)
from .forms import (
    ClienteForm, VehiculoForm,
    TrabajoForm, TrabajoItemFormSet,
    MovimientoCuentaForm, TurnoForm,
    PresupuestoForm, PresupuestoItemFormSet, PresupuestoItemFormSetRapido
)


# ========================
#    HELPERS
# ========================

def _get_q(request, key="q"):
    return (request.GET.get(key, "") or "").strip()


def _get_show(request, default="activos"):
    """
    show = activos | eliminados | todos
    """
    val = (request.GET.get("show") or default).strip().lower()
    if val not in ("activos", "eliminados", "todos"):
        return default
    return val


def _format_ars(value, decimals=2):
    """
    Formato ARS “humano”:
    - miles con punto: 1.000 / 10.000 / 1.000.000
    - decimales con coma: 1.234,50
    Devuelve string seguro o "" si no se puede convertir.
    """
    if value is None or value == "":
        return ""

    try:
        d = Decimal(str(value))
        q = Decimal("1." + ("0" * int(decimals))) if decimals else Decimal("1")
        d = d.quantize(q)
        s = f"{d:,.{decimals}f}"  # US: 1,234,567.89
        s = s.replace(",", "X").replace(".", ",").replace("X", ".")
        return s
    except (InvalidOperation, ValueError, TypeError):
        return ""


def _normalize_phone_for_whatsapp(raw: str) -> str:
    """
    Normaliza teléfonos AR para wa.me (solo dígitos) y los devuelve en formato:
      549 + area(sin 0) + numero(sin 15)

    Acepta entradas típicas:
      - 3482 15 331483
      - +54 9 3482 15 331483
      - 03482-15-331483
      - 549348215331483   (y le saca el 15 si está)

    Si no puede normalizar de forma segura, devuelve "".
    """
    if not raw:
        return ""

    digits = re.sub(r"\D+", "", str(raw))
    if not digits:
        return ""

    # 00 prefijo internacional
    if digits.startswith("00"):
        digits = digits[2:]

    # Quitar país si viene (54...)
    if digits.startswith("54"):
        digits = digits[2:]

    # Quitar "9" móvil si viene (WhatsApp lo usa en AR con 54 9 ...)
    if digits.startswith("9") and len(digits) >= 10:
        digits = digits[1:]

    # Quitar 0 de larga distancia
    if digits.startswith("0"):
        digits = digits[1:]

    if not digits:
        return ""

    # Si el usuario cargó solo "15xxxxxxx" sin área, no se puede arreglar bien
    if digits.startswith("15"):
        return ""

    # Sacar "15" después del área (probamos áreas 4, 3, 2; primero la más común en interior)
    for area_len in (4, 3, 2):
        if len(digits) > area_len + 2 and digits[area_len:area_len + 2] == "15":
            digits = digits[:area_len] + digits[area_len + 2:]
            break

    # Validación mínima (muy corto = raro)
    if len(digits) < 8:
        return ""

    # wa.me requiere countrycode + number (sin +). Para AR móviles usamos 549 + nacional
    return "549" + digits


def _wsp_text_trabajo(trabajo) -> str:
    c = getattr(trabajo, "cliente", None)
    v = getattr(trabajo, "vehiculo", None)

    nombre = ""
    if c:
        nombre = getattr(c, "nombre_completo", "") or ""

    total_txt = ""
    try:
        total_txt = _format_ars(getattr(trabajo, "total", None))
    except Exception:
        total_txt = ""

    lines = []
    lines.append(f"Hola {nombre}! 👋" if nombre else "Hola! 👋")
    lines.append("Te comparto el comprobante del trabajo realizado en Ale Gavilan Cars Solutions.")
    lines.append(f"Trabajo #{trabajo.id}")

    if v:
        patente = getattr(v, "patente", "") or ""
        marca = getattr(v, "marca", "") or ""
        modelo = getattr(v, "modelo", "") or ""
        parts = [p for p in [patente, marca, modelo] if p]
        if parts:
            lines.append(f"Vehículo: {' '.join(parts)}")

    if total_txt:
        lines.append(f"Total: $ {total_txt}")

    lines.append("Gracias por elegirnos 🙌")
    return "\n".join(lines)


def _wsp_text_presupuesto(presupuesto) -> str:
    c = getattr(presupuesto, "cliente", None)
    v = getattr(presupuesto, "vehiculo", None)

    nombre = ""
    if c:
        nombre = getattr(c, "nombre_completo", "") or ""

    total_txt = ""
    try:
        total_txt = _format_ars(getattr(presupuesto, "total", None))
    except Exception:
        total_txt = ""

    lines = []
    lines.append(f"Hola {nombre}! 👋" if nombre else "Hola! 👋")
    lines.append("Te comparto el presupuesto de Ale Gavilan Cars Solutions.")
    lines.append(f"Presupuesto #{presupuesto.id}")

    if v:
        patente = getattr(v, "patente", "") or ""
        marca = getattr(v, "marca", "") or ""
        modelo = getattr(v, "modelo", "") or ""
        parts = [p for p in [patente, marca, modelo] if p]
        if parts:
            lines.append(f"Vehículo: {' '.join(parts)}")

    if total_txt:
        lines.append(f"Total presupuesto: $ {total_txt}")

    valido_hasta = getattr(presupuesto, "valido_hasta", None)
    if valido_hasta:
        try:
            lines.append(f"Válido hasta: {valido_hasta.strftime('%d/%m/%Y')}")
        except Exception:
            pass

    lines.append("Cualquier duda, avisame y lo ajustamos 👍")
    return "\n".join(lines)


# ========================
#    DASHBOARD
# ========================

class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = "taller/dashboard.html"
    login_url = "login"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)

        ctx["total_clientes"] = Cliente.objects.count()
        ctx["total_vehiculos"] = Vehiculo.objects.count()

        ctx["trabajos_activos"] = Trabajo.objects.filter(activo=True).exclude(
            estado__in=[Trabajo.ESTADO_ENTREGADO, Trabajo.ESTADO_ANULADO]
        ).count()

        ahora = timezone.now()

        turnos_qs = (
            Turno.objects.filter(fecha_hora__gte=ahora)
            .select_related("cliente", "vehiculo")
            .order_by("fecha_hora")[:5]
        )
        ctx["turnos_proximos"] = list(turnos_qs)
        ctx["turnos_proximos_count"] = len(ctx["turnos_proximos"])

        trabajos_qs = (
            Trabajo.objects.filter(activo=True)
            .select_related("vehiculo", "cliente")
            .only(
                "id", "estado", "fecha_ingreso",
                "cliente__id", "cliente__nombre", "cliente__apellido",
                "vehiculo__id", "vehiculo__patente", "vehiculo__marca", "vehiculo__modelo",
            )
            .order_by("-fecha_ingreso")[:5]
        )
        trabajos = list(trabajos_qs)
        for t in trabajos:
            t.total_safe = ""
        ctx["trabajos_recientes"] = trabajos
        ctx["trabajos_recientes_count"] = len(trabajos)

        ctx["clientes_top"] = (
            Cliente.objects.annotate(cant_vehiculos=Count("vehiculos"))
            .order_by("-cant_vehiculos")[:5]
        )

        presupuestos_qs = (
            Presupuesto.objects.filter(activo=True)
            .select_related("cliente", "vehiculo")
            .only(
                "id", "tipo", "estado", "fecha", "titulo",
                "cliente__id", "cliente__nombre", "cliente__apellido",
                "vehiculo__id", "vehiculo__patente", "vehiculo__marca", "vehiculo__modelo",
            )
            .order_by("-fecha")[:5]
        )
        presupuestos = list(presupuestos_qs)
        ctx["presupuestos_recientes"] = presupuestos
        ctx["presupuestos_recientes_count"] = len(presupuestos)

        ctx["trabajos_eliminados_count"] = Trabajo.objects.filter(activo=False).count()
        ctx["presupuestos_eliminados_count"] = Presupuesto.objects.filter(activo=False).count()

        return ctx


# ========================
#    CLIENTES
# ========================

class ClienteListView(LoginRequiredMixin, ListView):
    model = Cliente
    template_name = "taller/cliente_list.html"
    context_object_name = "clientes"
    paginate_by = 20
    login_url = "login"

    def get_queryset(self):
        qs = super().get_queryset()
        q = _get_q(self.request, "q")
        if q:
            qs = qs.filter(
                Q(telefono__icontains=q) |
                Q(email__icontains=q) |
                Q(dni__icontains=q) |
                Q(nombre__icontains=q) |
                Q(apellido__icontains=q) |
                Q(direccion__icontains=q)
            )
        return qs.order_by("id")


class ClienteCreateView(LoginRequiredMixin, CreateView):
    model = Cliente
    form_class = ClienteForm
    template_name = "taller/cliente_form.html"
    success_url = reverse_lazy("taller:cliente_list")
    login_url = "login"


class ClienteUpdateView(LoginRequiredMixin, UpdateView):
    model = Cliente
    form_class = ClienteForm
    template_name = "taller/cliente_form.html"
    success_url = reverse_lazy("taller:cliente_list")
    login_url = "login"


class ClienteDetailView(LoginRequiredMixin, DetailView):
    model = Cliente
    template_name = "taller/cliente_detail.html"
    context_object_name = "cliente"
    login_url = "login"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        cliente = self.object

        ctx["vehiculos"] = cliente.vehiculos.all().order_by("patente")

        ctx["trabajos_recientes"] = (
            cliente.trabajos.filter(activo=True)
            .select_related("vehiculo")
            .order_by("-fecha_ingreso")[:5]
        )

        ctx["movimientos"] = cliente.movimientos_cuenta.order_by("-fecha")[:15]
        ctx["saldo_actual"] = cliente.saldo_actual

        ctx["presupuestos_recientes"] = (
            cliente.presupuestos.filter(activo=True)
            .select_related("vehiculo")
            .order_by("-fecha")[:5]
        )

        return ctx


# ========================
#    VEHÍCULOS
# ========================

class VehiculoListView(LoginRequiredMixin, ListView):
    model = Vehiculo
    template_name = "taller/vehiculo_list.html"
    context_object_name = "vehiculos"
    paginate_by = 20
    login_url = "login"

    def get_queryset(self):
        qs = Vehiculo.objects.select_related("cliente")
        q = _get_q(self.request, "q")
        if q:
            qs = qs.filter(
                Q(patente__icontains=q) |
                Q(marca__icontains=q) |
                Q(modelo__icontains=q) |
                Q(cliente__nombre__icontains=q) |
                Q(cliente__apellido__icontains=q) |
                Q(cliente__telefono__icontains=q) |
                Q(cliente__dni__icontains=q)
            ).distinct()
        return qs.order_by("patente")


class VehiculoCreateView(LoginRequiredMixin, CreateView):
    model = Vehiculo
    form_class = VehiculoForm
    template_name = "taller/vehiculo_form.html"
    success_url = reverse_lazy("taller:vehiculo_list")
    login_url = "login"


class VehiculoUpdateView(LoginRequiredMixin, UpdateView):
    model = Vehiculo
    form_class = VehiculoForm
    template_name = "taller/vehiculo_form.html"
    success_url = reverse_lazy("taller:vehiculo_list")
    login_url = "login"


class VehiculoDetailView(LoginRequiredMixin, DetailView):
    model = Vehiculo
    template_name = "taller/vehiculo_detail.html"
    context_object_name = "vehiculo"
    login_url = "login"


# ========================
#   API: VEHÍCULOS POR CLIENTE
# ========================

@login_required(login_url="login")
def vehiculos_por_cliente_json(request):
    cliente_id = request.GET.get("cliente_id")
    try:
        cliente_id = int(cliente_id)
    except (TypeError, ValueError):
        return JsonResponse({"vehiculos": []})

    vehiculos = (
        Vehiculo.objects.filter(cliente_id=cliente_id)
        .order_by("patente")
        .only("id", "patente", "marca", "modelo")
    )

    data = []
    for v in vehiculos:
        marca_modelo = " ".join([p for p in [v.marca, v.modelo] if p]).strip()
        label = f"{v.patente}"
        if marca_modelo:
            label = f"{label} – {marca_modelo}"
        data.append({"id": v.id, "label": label})

    return JsonResponse({"vehiculos": data})


# ========================
#    TRABAJOS
# ========================

class TrabajoListView(LoginRequiredMixin, ListView):
    model = Trabajo
    template_name = "taller/trabajo_list.html"
    context_object_name = "trabajos"
    paginate_by = 20
    login_url = "login"

    def get_queryset(self):
        show = _get_show(self.request, default="activos")

        qs = Trabajo.objects.select_related("vehiculo", "cliente")

        if show == "activos":
            qs = qs.filter(activo=True).order_by("-fecha_ingreso")
        elif show == "eliminados":
            qs = qs.filter(activo=False).order_by("-eliminado_en", "-fecha_ingreso")
        else:
            qs = qs.order_by("-fecha_ingreso")

        q = _get_q(self.request, "q")
        if q:
            qs = qs.filter(
                Q(vehiculo__patente__icontains=q) |
                Q(vehiculo__marca__icontains=q) |
                Q(vehiculo__modelo__icontains=q) |
                Q(cliente__nombre__icontains=q) |
                Q(cliente__apellido__icontains=q) |
                Q(cliente__telefono__icontains=q) |
                Q(cliente__dni__icontains=q) |
                Q(cliente__email__icontains=q) |
                Q(cliente__direccion__icontains=q)
            ).distinct()

        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["show"] = _get_show(self.request, default="activos")
        ctx["trabajos_activos_count"] = Trabajo.objects.filter(activo=True).count()
        ctx["trabajos_eliminados_count"] = Trabajo.objects.filter(activo=False).count()
        return ctx


class TrabajoPapeleraListView(TrabajoListView):
    """
    Ruta /trabajos/eliminados/ (compatibilidad)
    """
    def get_queryset(self):
        mutable = self.request.GET.copy()
        mutable["show"] = "eliminados"
        self.request.GET = mutable
        return super().get_queryset()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["show"] = "eliminados"
        return ctx


class TrabajoDetailView(LoginRequiredMixin, DetailView):
    model = Trabajo
    template_name = "taller/trabajo_detail.html"
    context_object_name = "trabajo"
    login_url = "login"

    def get_queryset(self):
        return Trabajo.objects.select_related("vehiculo", "cliente").prefetch_related("items")


class TrabajoComprobanteView(LoginRequiredMixin, DetailView):
    model = Trabajo
    template_name = "taller/trabajo_comprobante.html"
    context_object_name = "trabajo"
    login_url = "login"

    def get_queryset(self):
        return Trabajo.objects.filter(activo=True).select_related("vehiculo", "cliente").prefetch_related("items")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        trabajo = self.object
        tel = (trabajo.cliente.telefono if trabajo.cliente else "") or ""
        ctx["wsp_phone"] = _normalize_phone_for_whatsapp(tel)
        ctx["wsp_text"] = _wsp_text_trabajo(trabajo)
        return ctx


class TrabajoComprobantePDFView(LoginRequiredMixin, DetailView):
    model = Trabajo
    template_name = "taller/trabajo_comprobante.html"
    context_object_name = "trabajo"
    login_url = "login"

    def get_queryset(self):
        return Trabajo.objects.filter(activo=True).select_related("vehiculo", "cliente").prefetch_related("items")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["modo_pdf"] = True

        trabajo = self.object
        tel = (trabajo.cliente.telefono if trabajo.cliente else "") or ""
        ctx["wsp_phone"] = _normalize_phone_for_whatsapp(tel)
        ctx["wsp_text"] = _wsp_text_trabajo(trabajo)
        return ctx


@login_required(login_url="login")
@transaction.atomic
def trabajo_create(request):
    if request.method == "POST":
        form = TrabajoForm(request.POST)
        formset = TrabajoItemFormSet(request.POST, prefix="items")

        if form.is_valid() and formset.is_valid():
            trabajo = form.save(commit=False)
            trabajo.save()
            if hasattr(form, "save_m2m"):
                form.save_m2m()

            formset.instance = trabajo
            formset.save()

            messages.success(request, "Trabajo creado correctamente. Ya podés generar el comprobante.")
            return redirect("taller:trabajo_detail", pk=trabajo.pk)

        messages.error(request, "Revisá los campos marcados en rojo. Verificá datos e ítems cargados.")
    else:
        form = TrabajoForm()
        formset = TrabajoItemFormSet(prefix="items")

    return render(request, "taller/trabajo_form.html", {"form": form, "formset": formset, "trabajo": None})


@login_required(login_url="login")
@transaction.atomic
def trabajo_update(request, pk):
    trabajo = get_object_or_404(Trabajo, pk=pk)

    if not trabajo.activo:
        messages.error(request, "Este trabajo está en Eliminados. Restauralo para editarlo.")
        return redirect("taller:trabajo_detail", pk=trabajo.pk)

    if request.method == "POST":
        form = TrabajoForm(request.POST, instance=trabajo)
        formset = TrabajoItemFormSet(request.POST, instance=trabajo, prefix="items")

        if form.is_valid() and formset.is_valid():
            trabajo = form.save(commit=False)
            trabajo.save()
            if hasattr(form, "save_m2m"):
                form.save_m2m()

            formset.instance = trabajo
            formset.save()

            messages.success(request, "Trabajo actualizado correctamente.")
            return redirect("taller:trabajo_detail", pk=trabajo.pk)

        messages.error(request, "Revisá los campos marcados en rojo. Verificá datos e ítems cargados.")
    else:
        form = TrabajoForm(instance=trabajo)
        formset = TrabajoItemFormSet(instance=trabajo, prefix="items")

    return render(request, "taller/trabajo_form.html", {"form": form, "formset": formset, "trabajo": trabajo})


# ========================
#    MOVIMIENTOS CUENTA
# ========================

@login_required(login_url="login")
def movimiento_cuenta_create(request, cliente_id):
    cliente = get_object_or_404(Cliente, pk=cliente_id)

    if request.method == "POST":
        form = MovimientoCuentaForm(request.POST)
        if form.is_valid():
            mov = form.save(commit=False)
            mov.cliente = cliente

            if not mov.descripcion:
                if mov.tipo == MovimientoCuenta.TIPO_DEUDA and getattr(mov, "trabajo", None):
                    mov.descripcion = f"Deuda por trabajo #{mov.trabajo.id}"
                elif mov.tipo == MovimientoCuenta.TIPO_PAGO:
                    mov.descripcion = "Pago registrado en taller"
                else:
                    mov.descripcion = "Movimiento registrado"

            mov.save()
            messages.success(request, "Movimiento registrado correctamente.")
            return redirect("taller:cliente_detail", pk=cliente.pk)

        messages.error(request, "Revisá los campos marcados en rojo.")
    else:
        initial = {}
        tipo = request.GET.get("tipo")
        if tipo in [MovimientoCuenta.TIPO_DEUDA, MovimientoCuenta.TIPO_PAGO]:
            initial["tipo"] = tipo
        form = MovimientoCuentaForm(initial=initial)

    return render(request, "taller/movimiento_cuenta_form.html", {"cliente": cliente, "form": form})


# ========================
#    TURNOS
# ========================

class TurnoListView(LoginRequiredMixin, ListView):
    model = Turno
    template_name = "taller/turno_list.html"
    context_object_name = "turnos"
    paginate_by = 20
    login_url = "login"

    def get_queryset(self):
        return Turno.objects.select_related("cliente", "vehiculo").order_by("fecha_hora")


class TurnoDetailView(LoginRequiredMixin, DetailView):
    model = Turno
    template_name = "taller/turno_detail.html"
    context_object_name = "turno"
    login_url = "login"


class TurnoCreateView(LoginRequiredMixin, CreateView):
    model = Turno
    form_class = TurnoForm
    template_name = "taller/turno_form.html"
    success_url = reverse_lazy("taller:turno_list")
    login_url = "login"


class TurnoUpdateView(LoginRequiredMixin, UpdateView):
    model = Turno
    form_class = TurnoForm
    template_name = "taller/turno_form.html"
    success_url = reverse_lazy("taller:turno_list")
    login_url = "login"


# ========================
#    PRESUPUESTOS
# ========================

class PresupuestoListView(LoginRequiredMixin, ListView):
    model = Presupuesto
    template_name = "taller/presupuesto_list.html"
    context_object_name = "presupuestos"
    paginate_by = 20
    login_url = "login"

    def get_queryset(self):
        show = _get_show(self.request, default="activos")

        qs = Presupuesto.objects.select_related("cliente", "vehiculo")

        if show == "activos":
            qs = qs.filter(activo=True).order_by("-fecha")
        elif show == "eliminados":
            qs = qs.filter(activo=False).order_by("-eliminado_en", "-fecha")
        else:
            qs = qs.order_by("-fecha")

        q = _get_q(self.request, "q")
        if q:
            qs = qs.filter(
                Q(cliente__nombre__icontains=q) |
                Q(cliente__apellido__icontains=q) |
                Q(cliente__telefono__icontains=q) |
                Q(cliente__dni__icontains=q) |
                Q(cliente__email__icontains=q) |
                Q(cliente__direccion__icontains=q) |
                Q(vehiculo__patente__icontains=q) |
                Q(vehiculo__marca__icontains=q) |
                Q(vehiculo__modelo__icontains=q) |
                Q(titulo__icontains=q)
            ).distinct()

        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["show"] = _get_show(self.request, default="activos")
        ctx["presupuestos_activos_count"] = Presupuesto.objects.filter(activo=True).count()
        ctx["presupuestos_eliminados_count"] = Presupuesto.objects.filter(activo=False).count()
        return ctx


class PresupuestoPapeleraListView(PresupuestoListView):
    def get_queryset(self):
        mutable = self.request.GET.copy()
        mutable["show"] = "eliminados"
        self.request.GET = mutable
        return super().get_queryset()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["show"] = "eliminados"
        return ctx


def _presupuesto_save_common(request, *, instance=None, tipo_forzado=None, modo_template="detallado"):
    modo_template = (modo_template or "detallado").lower()
    FormSetCls = PresupuestoItemFormSetRapido if modo_template == "rapido" else PresupuestoItemFormSet

    if request.method == "POST":
        form = PresupuestoForm(request.POST, instance=instance)
        formset = FormSetCls(request.POST, instance=instance, prefix="items")

        if form.is_valid() and formset.is_valid():
            with transaction.atomic():
                presupuesto = form.save(commit=False)

                if tipo_forzado:
                    presupuesto.tipo = tipo_forzado

                if presupuesto.descuento in (None, ""):
                    presupuesto.descuento = Decimal("0.00")

                if instance and hasattr(instance, "activo") and instance.activo is False:
                    messages.error(request, "Este presupuesto está en Eliminados. Restauralo para editarlo.")
                    return redirect("taller:presupuesto_detail", pk=instance.pk)

                presupuesto.save()
                if hasattr(form, "save_m2m"):
                    form.save_m2m()

                formset.instance = presupuesto
                formset.save()

            messages.success(
                request,
                "Presupuesto actualizado correctamente." if instance else "Presupuesto creado correctamente."
            )
            return redirect("taller:presupuesto_detail", pk=presupuesto.pk)

        messages.error(request, "Revisá los campos en rojo. Verificá cliente/vehículo, resumen e ítems.")
    else:
        initial = {}
        if not instance:
            if tipo_forzado == Presupuesto.TIPO_RAPIDO:
                initial.update({"tipo": Presupuesto.TIPO_RAPIDO, "titulo": "Presupuesto rápido", "descuento": "0"})
            elif tipo_forzado == Presupuesto.TIPO_DETALLADO:
                initial.update({"tipo": Presupuesto.TIPO_DETALLADO, "titulo": "Presupuesto detallado", "descuento": "0"})

        form = PresupuestoForm(instance=instance, initial=initial)
        formset = FormSetCls(instance=instance, prefix="items")

    return render(
        request,
        "taller/presupuesto_form.html",
        {"form": form, "formset": formset, "modo": modo_template, "presupuesto": instance},
    )


@login_required(login_url="login")
def presupuesto_create_rapido(request):
    return _presupuesto_save_common(
        request,
        instance=None,
        tipo_forzado=Presupuesto.TIPO_RAPIDO,
        modo_template="rapido",
    )


@login_required(login_url="login")
def presupuesto_create_detallado(request):
    return _presupuesto_save_common(
        request,
        instance=None,
        tipo_forzado=Presupuesto.TIPO_DETALLADO,
        modo_template="detallado",
    )


@login_required(login_url="login")
def presupuesto_update(request, pk):
    presupuesto = get_object_or_404(Presupuesto, pk=pk)
    modo = "rapido" if presupuesto.tipo == Presupuesto.TIPO_RAPIDO else "detallado"
    return _presupuesto_save_common(
        request,
        instance=presupuesto,
        tipo_forzado=None,
        modo_template=modo,
    )


class PresupuestoDetailView(LoginRequiredMixin, DetailView):
    model = Presupuesto
    template_name = "taller/presupuesto_detail.html"
    context_object_name = "presupuesto"
    login_url = "login"

    def get_queryset(self):
        return Presupuesto.objects.select_related("cliente", "vehiculo").prefetch_related("items")


class PresupuestoComprobanteView(LoginRequiredMixin, DetailView):
    model = Presupuesto
    template_name = "taller/presupuesto_comprobante.html"
    context_object_name = "presupuesto"
    login_url = "login"

    def get_queryset(self):
        return Presupuesto.objects.filter(activo=True).select_related("cliente", "vehiculo").prefetch_related("items")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        presupuesto = self.object
        tel = (presupuesto.cliente.telefono if presupuesto.cliente else "") or ""
        ctx["wsp_phone"] = _normalize_phone_for_whatsapp(tel)
        ctx["wsp_text"] = _wsp_text_presupuesto(presupuesto)
        return ctx


# ========================
#   SOFT DELETE + RESTAURAR (PRO): TRABAJOS / PRESUPUESTOS
# ========================

class _SoftDeleteBase(LoginRequiredMixin, View):
    model = None
    template_name = "taller/confirm_delete.html"
    login_url = "login"

    success_url_name = None
    detail_url_name = None
    success_message = "Enviado a eliminados."
    object_label = "registro"

    def get_object(self, pk):
        return get_object_or_404(self.model, pk=pk)

    def get(self, request, pk):
        obj = self.get_object(pk)
        return render(request, self.template_name, {
            "object": obj,
            "object_name": self.object_label,
            "cancel_url": reverse(self.detail_url_name, kwargs={"pk": obj.pk}),
        })

    def post(self, request, pk):
        obj = self.get_object(pk)

        if getattr(obj, "activo", True) is False:
            messages.info(request, "Este registro ya estaba en Eliminados.")
            return redirect(self.success_url_name)

        if hasattr(obj, "enviar_a_eliminados"):
            obj.enviar_a_eliminados()
        else:
            obj.activo = False
            obj.eliminado_en = timezone.now()
            obj.save(update_fields=["activo", "eliminado_en"])

        messages.success(request, self.success_message)
        return redirect(self.success_url_name)


class _RestoreBase(LoginRequiredMixin, View):
    model = None
    login_url = "login"

    detail_url_name = None
    success_message = "Restaurado correctamente."

    def post(self, request, pk):
        obj = get_object_or_404(self.model, pk=pk)

        if getattr(obj, "activo", True) is True:
            messages.info(request, "Este registro ya estaba activo.")
            return redirect(self.detail_url_name, pk=obj.pk)

        if hasattr(obj, "restaurar"):
            obj.restaurar()
        else:
            obj.activo = True
            obj.eliminado_en = None
            obj.save(update_fields=["activo", "eliminado_en"])

        messages.success(request, self.success_message)
        return redirect(self.detail_url_name, pk=obj.pk)


class TrabajoDeleteView(_SoftDeleteBase):
    model = Trabajo
    success_url_name = "taller:trabajo_list"
    detail_url_name = "taller:trabajo_detail"
    success_message = "Trabajo enviado a eliminados."
    object_label = "trabajo"


class TrabajoRestoreView(_RestoreBase):
    model = Trabajo
    detail_url_name = "taller:trabajo_detail"
    success_message = "Trabajo restaurado correctamente."


class PresupuestoDeleteView(_SoftDeleteBase):
    model = Presupuesto
    success_url_name = "taller:presupuesto_list"
    detail_url_name = "taller:presupuesto_detail"
    success_message = "Presupuesto enviado a eliminados."
    object_label = "presupuesto"


class PresupuestoRestoreView(_RestoreBase):
    model = Presupuesto
    detail_url_name = "taller:presupuesto_detail"
    success_message = "Presupuesto restaurado correctamente."
