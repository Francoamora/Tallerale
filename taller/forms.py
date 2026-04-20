# forms.py
from decimal import Decimal, InvalidOperation

from django import forms
from django.core.exceptions import ValidationError
from django.forms import inlineformset_factory
from django.forms.models import BaseInlineFormSet
from django.utils import timezone

from .models import (
    Cliente,
    Vehiculo,
    Trabajo,
    TrabajoItem,
    MovimientoCuenta,
    Turno,
    Presupuesto,
    PresupuestoItem,
)


# ==========================
#   PARSEO NÚMEROS AR
# ==========================

def _parse_decimal_ar(value):
    if value in (None, ""):
        return None
    if isinstance(value, Decimal):
        return value
    s = str(value).strip().replace(" ", "")

    if "," in s:
        s = s.replace(".", "")
        s = s.replace(",", ".")
    else:
        if s.count(".") == 1:
            left, right = s.split(".")
            if right.isdigit() and 1 <= len(right) <= 2:
                pass
            else:
                s = s.replace(".", "")
        elif s.count(".") > 1:
            s = s.replace(".", "")

    try:
        return Decimal(s)
    except (InvalidOperation, ValueError):
        raise ValidationError("Número inválido. Usá formato tipo 1.000 o 1.000,50.")


def _parse_int_ar(value):
    if value in (None, ""):
        return None
    s = str(value).strip().replace(" ", "").replace(".", "")
    if not s.isdigit():
        raise ValidationError("Número inválido. Ej: 125.000")
    return int(s)


class ARDecimalField(forms.DecimalField):
    def to_python(self, value):
        if value in (None, ""):
            return None
        return _parse_decimal_ar(value)


class ARIntegerField(forms.IntegerField):
    def to_python(self, value):
        if value in (None, ""):
            return None
        return _parse_int_ar(value)


# ==========================
#   BASE FORM (BOOTSTRAP)
# ==========================

class BaseModelForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)

        for name, field in self.fields.items():
            widget = field.widget

            if isinstance(widget, forms.CheckboxInput):
                widget.attrs.setdefault("class", "form-check-input")
            elif isinstance(widget, (forms.Select, forms.SelectMultiple)):
                self._add_class(widget, "form-select form-select-sm")
            elif isinstance(widget, forms.Textarea):
                self._add_class(widget, "form-control form-control-sm")
                widget.attrs.setdefault("rows", 3)
            else:
                self._add_class(widget, "form-control form-control-sm")

            widget.attrs.setdefault("aria-label", field.label or name)

    def _add_class(self, widget, cls: str):
        existing = widget.attrs.get("class", "")
        widget.attrs["class"] = (existing + f" {cls}").strip()


# ==========================
#   CLIENTES / VEHÍCULOS
# ==========================

class ClienteForm(BaseModelForm):
    class Meta:
        model = Cliente
        fields = ["nombre", "apellido", "telefono", "email", "dni", "direccion", "notas"]


class VehiculoForm(BaseModelForm):
    class Meta:
        model = Vehiculo
        fields = [
            "cliente",
            "patente",
            "marca",
            "modelo",
            "anio",
            "color",
            "kilometraje_actual",
            "estado_cubiertas",
            "proximo_service_km",
            "proximo_service_fecha",
            "notas",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.user and "cliente" in self.fields:
            self.fields["cliente"].queryset = Cliente.objects.filter(owner=self.user).order_by("nombre", "apellido")

        if "kilometraje_actual" in self.fields:
            self.fields["kilometraje_actual"] = ARIntegerField(
                required=False,
                label=self.fields["kilometraje_actual"].label,
                help_text=self.fields["kilometraje_actual"].help_text,
            )
            self.fields["kilometraje_actual"].widget = forms.TextInput(
                attrs={
                    "class": "form-control form-control-sm",
                    "inputmode": "numeric",
                    "placeholder": "Ej: 125.000",
                    "autocomplete": "off",
                }
            )

    def clean_cliente(self):
        cliente = self.cleaned_data.get("cliente")
        if cliente and self.user and cliente.owner_id != self.user.id:
            raise ValidationError("No podés asociar un vehículo a un cliente de otra cuenta.")
        return cliente

    def clean_patente(self):
        patente = "".join((self.cleaned_data.get("patente") or "").split()).upper()
        if not patente:
            raise ValidationError("La patente es obligatoria.")
        return patente

    def clean(self):
        cleaned_data = super().clean()
        cliente = cleaned_data.get("cliente")
        patente = cleaned_data.get("patente")

        if cliente:
            self.instance.owner = cliente.owner

        if cliente and patente:
            duplicado = (
                Vehiculo.objects.filter(owner=cliente.owner, patente=patente)
                .exclude(pk=self.instance.pk)
                .select_related("cliente")
                .first()
            )
            if duplicado:
                if duplicado.cliente_id == cliente.id:
                    self.add_error("patente", "La patente ya está cargada para este cliente en tu taller.")
                else:
                    self.add_error("patente", "La patente ya está registrada en tu taller a nombre de otro cliente.")

        return cleaned_data


# ==========================
#   TRABAJOS
# ==========================

class TrabajoForm(BaseModelForm):
    class Meta:
        model = Trabajo
        exclude = ("total_mano_obra", "total_repuestos", "total")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.user:
            if "cliente" in self.fields:
                self.fields["cliente"].queryset = Cliente.objects.filter(owner=self.user).order_by("nombre", "apellido")
            if "vehiculo" in self.fields:
                self.fields["vehiculo"].queryset = Vehiculo.objects.select_related("cliente").filter(owner=self.user).order_by("patente")

        if "kilometraje" in self.fields:
            self.fields["kilometraje"] = ARIntegerField(required=True, label="Kilometraje")
            self.fields["kilometraje"].widget = forms.TextInput(
                attrs={
                    "class": "form-control form-control-sm",
                    "inputmode": "numeric",
                    "placeholder": "Ej: 125.000",
                    "autocomplete": "off",
                }
            )

        if "proximo_control_km" in self.fields:
            self.fields["proximo_control_km"] = ARIntegerField(required=False, label=self.fields["proximo_control_km"].label)
            self.fields["proximo_control_km"].widget = forms.TextInput(
                attrs={
                    "class": "form-control form-control-sm",
                    "inputmode": "numeric",
                    "placeholder": "Ej: 150.000",
                    "autocomplete": "off",
                }
            )

        if self.instance and self.instance.pk:
            for fname in ("fecha_ingreso", "fecha_egreso_estimado", "fecha_egreso_real"):
                if fname in self.fields:
                    existing_class = self.fields[fname].widget.attrs.get("class", "form-control form-control-sm")
                    self.fields[fname].widget = forms.DateTimeInput(
                        attrs={"type": "datetime-local", "class": existing_class}
                    )
        else:
            for fname in ("fecha_ingreso", "fecha_egreso_estimado", "fecha_egreso_real"):
                self.fields.pop(fname, None)

    def clean(self):
        cleaned_data = super().clean()
        cliente = cleaned_data.get("cliente")
        vehiculo = cleaned_data.get("vehiculo")

        if cliente and self.user and cliente.owner_id != self.user.id:
            self.add_error("cliente", "No podés usar un cliente de otra cuenta.")

        if vehiculo and self.user and vehiculo.cliente.owner_id != self.user.id:
            self.add_error("vehiculo", "No podés usar un vehículo de otra cuenta.")

        if cliente and vehiculo and vehiculo.cliente_id != cliente.id:
            self.add_error("vehiculo", "El vehículo seleccionado no pertenece al cliente elegido.")

        return cleaned_data


class TrabajoItemForm(BaseModelForm):
    class Meta:
        model = TrabajoItem
        exclude = ("subtotal",)
        widgets = {"descripcion": forms.TextInput(attrs={"placeholder": "Ej: Mano de obra · cambio de pastillas"})}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if "cantidad" in self.fields:
            self.fields["cantidad"] = ARDecimalField(
                required=True,
                min_value=Decimal("0.01"),
                decimal_places=2,
                max_digits=10,
                label="Cantidad",
            )
            self.fields["cantidad"].widget = forms.TextInput(
                attrs={"class": "form-control form-control-sm text-end", "inputmode": "decimal", "placeholder": "", "autocomplete": "off"}
            )

        if "precio_unitario" in self.fields:
            self.fields["precio_unitario"] = ARDecimalField(
                required=True,
                min_value=Decimal("0.00"),
                decimal_places=2,
                max_digits=12,
                label="Precio unit.",
            )
            self.fields["precio_unitario"].widget = forms.TextInput(
                attrs={"class": "form-control form-control-sm text-end", "inputmode": "decimal", "placeholder": "0", "autocomplete": "off"}
            )


class BaseTrabajoItemFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()
        if any(self.errors):
            return

        for form in self.forms:
            if self.can_delete and form.cleaned_data.get("DELETE"):
                continue

            desc = (form.cleaned_data.get("descripcion") or "").strip()
            cantidad = form.cleaned_data.get("cantidad")
            precio = form.cleaned_data.get("precio_unitario")

            if not desc and (cantidad in (None, "")) and (precio in (None, "")):
                continue

            if not desc:
                form.add_error("descripcion", "Completá la descripción del ítem.")
            if cantidad in (None, ""):
                form.add_error("cantidad", "Completá la cantidad.")
            if precio in (None, ""):
                form.add_error("precio_unitario", "Completá el precio unitario.")


TrabajoItemFormSet = inlineformset_factory(
    Trabajo,
    TrabajoItem,
    form=TrabajoItemForm,
    formset=BaseTrabajoItemFormSet,
    extra=8,
    can_delete=True,
)


# ==========================
#   MOVIMIENTOS / TURNOS
# ==========================

class MovimientoCuentaForm(BaseModelForm):
    class Meta:
        model = MovimientoCuenta
        exclude = ("cliente",)
        widgets = {
            "fecha": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "descripcion": forms.TextInput(attrs={"placeholder": "Ej: Pago parcial / Ajuste / Deuda trabajo #12"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.user and "trabajo" in self.fields:
            self.fields["trabajo"].queryset = Trabajo.objects.select_related("cliente", "vehiculo").filter(owner=self.user).order_by("-fecha_ingreso")

        if "monto" in self.fields:
            self.fields["monto"] = ARDecimalField(
                required=True,
                min_value=Decimal("0.00"),
                decimal_places=2,
                max_digits=12,
                label="Monto",
            )
            self.fields["monto"].widget = forms.TextInput(
                attrs={"class": "form-control form-control-sm", "inputmode": "decimal", "placeholder": "Ej: 10.000", "autocomplete": "off"}
            )

        # metodo_pago: solo relevante cuando tipo=PAGO
        if "metodo_pago" in self.fields:
            self.fields["metodo_pago"].required = False
            self.fields["metodo_pago"].label = "Método de pago"


class TurnoForm(BaseModelForm):
    class Meta:
        model = Turno
        fields = ["cliente", "vehiculo", "fecha_hora", "estado", "motivo", "notas"]
        widgets = {
            "fecha_hora": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "motivo": forms.Textarea(attrs={"rows": 3, "placeholder": "Ej: Service, frenos, diagnóstico de ruido…"}),
            "notas": forms.Textarea(attrs={"rows": 3, "placeholder": "Solo uso interno (no lo ve el cliente)."}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.user:
            if "cliente" in self.fields:
                self.fields["cliente"].queryset = Cliente.objects.filter(owner=self.user).order_by("nombre", "apellido")
            if "vehiculo" in self.fields:
                self.fields["vehiculo"].queryset = Vehiculo.objects.select_related("cliente").filter(owner=self.user).order_by("patente")

    def clean(self):
        cleaned_data = super().clean()
        cliente = cleaned_data.get("cliente")
        vehiculo = cleaned_data.get("vehiculo")

        if cliente and self.user and cliente.owner_id != self.user.id:
            self.add_error("cliente", "No podés usar un cliente de otra cuenta.")

        if vehiculo and self.user and vehiculo.cliente.owner_id != self.user.id:
            self.add_error("vehiculo", "No podés usar un vehículo de otra cuenta.")

        if cliente and vehiculo and vehiculo.cliente_id != cliente.id:
            self.add_error("vehiculo", "El vehículo seleccionado no pertenece al cliente elegido.")

        return cleaned_data


# ==========================
#   PRESUPUESTOS
# ==========================

class PresupuestoForm(BaseModelForm):
    class Meta:
        model = Presupuesto
        fields = [
            "tipo",
            "estado",
            "titulo",
            "cliente",
            "vehiculo",
            "fecha",
            "valido_hasta",
            "resumen",
            "descuento",
            "notas_internas",
        ]
        widgets = {
            "fecha": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "valido_hasta": forms.DateInput(attrs={"type": "date"}),
            "titulo": forms.TextInput(attrs={"placeholder": "Ej: Tren delantero / Distribución / Diagnóstico"}),
            "resumen": forms.Textarea(attrs={"rows": 3, "placeholder": "Explicación clara para el cliente…"}),
            "notas_internas": forms.Textarea(attrs={"rows": 3, "placeholder": "Notas internas (no se imprime)…"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.user:
            if "cliente" in self.fields:
                self.fields["cliente"].queryset = Cliente.objects.filter(owner=self.user).order_by("nombre", "apellido")
            if "vehiculo" in self.fields:
                self.fields["vehiculo"].queryset = Vehiculo.objects.select_related("cliente").filter(owner=self.user).order_by("patente")

        if not (self.instance and self.instance.pk):
            if "fecha" in self.fields and not self.initial.get("fecha"):
                self.initial["fecha"] = timezone.localtime(timezone.now()).strftime("%Y-%m-%dT%H:%M")

        if "descuento" in self.fields:
            self.fields["descuento"] = ARDecimalField(
                required=False,
                min_value=Decimal("0.00"),
                decimal_places=2,
                max_digits=12,
                label="Descuento ($)",
            )
            # ✅ importante: placeholder 0, pero si lo borran queda vacío y NO debe romper
            self.fields["descuento"].widget = forms.TextInput(
                attrs={
                    "class": "form-control form-control-sm",
                    "inputmode": "decimal",
                    "placeholder": "0",
                    "autocomplete": "off",
                }
            )

    def clean_descuento(self):
        """
        ✅ FIX CRÍTICO:
        Si viene vacío, lo normalizamos a 0.00 para no violar NOT NULL en DB.
        """
        val = self.cleaned_data.get("descuento")
        if val in (None, ""):
            return Decimal("0.00")
        return val

    def clean(self):
        cleaned_data = super().clean()
        cliente = cleaned_data.get("cliente")
        vehiculo = cleaned_data.get("vehiculo")

        if cliente and self.user and cliente.owner_id != self.user.id:
            self.add_error("cliente", "No podés usar un cliente de otra cuenta.")

        if vehiculo and self.user and vehiculo.cliente.owner_id != self.user.id:
            self.add_error("vehiculo", "No podés usar un vehículo de otra cuenta.")

        if cliente and vehiculo and vehiculo.cliente_id != cliente.id:
            self.add_error("vehiculo", "El vehículo seleccionado no pertenece al cliente elegido.")

        return cleaned_data


class PresupuestoItemForm(BaseModelForm):
    class Meta:
        model = PresupuestoItem
        exclude = ("subtotal",)
        widgets = {"descripcion": forms.TextInput(attrs={"placeholder": "Ej: Mano de obra / Repuesto / Insumo…"})}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # ✅ Cantidad: requerida, PERO sin valor “1” pre-cargado en filas extra
        if "cantidad" in self.fields:
            self.fields["cantidad"] = ARDecimalField(
                required=True,
                min_value=Decimal("0.01"),
                decimal_places=2,
                max_digits=10,
                label="Cant.",
            )
            self.fields["cantidad"].widget = forms.TextInput(
                attrs={
                    "class": "form-control form-control-sm text-end",
                    "inputmode": "decimal",
                    "placeholder": "",   # ✅ vacío (no confunde)
                    "autocomplete": "off",
                }
            )

            # ✅ clave: en filas extra (sin bound) no mostramos el default 1.00 del modelo
            if not self.is_bound and (not self.instance or not self.instance.pk):
                self.initial["cantidad"] = None

        if "precio_unitario" in self.fields:
            self.fields["precio_unitario"] = ARDecimalField(
                required=True,
                min_value=Decimal("0.00"),
                decimal_places=2,
                max_digits=12,
                label="Precio unit.",
            )
            self.fields["precio_unitario"].widget = forms.TextInput(
                attrs={
                    "class": "form-control form-control-sm text-end",
                    "inputmode": "decimal",
                    "placeholder": "0",
                    "autocomplete": "off",
                }
            )


class BasePresupuestoItemFormSet(BaseInlineFormSet):
    """DETALLADO: permite varias filas, pero exige al menos 1 ítem completo."""
    def clean(self):
        super().clean()
        if any(self.errors):
            return

        items_ok = 0

        for form in self.forms:
            if not hasattr(form, "cleaned_data"):
                continue
            if self.can_delete and form.cleaned_data.get("DELETE"):
                continue

            desc = (form.cleaned_data.get("descripcion") or "").strip()
            cantidad = form.cleaned_data.get("cantidad")
            precio = form.cleaned_data.get("precio_unitario")

            # fila vacía => ignorar
            if not desc and (cantidad in (None, "")) and (precio in (None, "")):
                continue

            if not desc:
                form.add_error("descripcion", "Completá la descripción del ítem.")
            if cantidad in (None, ""):
                form.add_error("cantidad", "Completá la cantidad.")
            if precio in (None, ""):
                form.add_error("precio_unitario", "Completá el precio unitario.")

            if desc and (cantidad not in (None, "")) and (precio not in (None, "")):
                items_ok += 1

        if items_ok < 1:
            raise ValidationError("Cargá al menos 1 ítem en el presupuesto.")


class BasePresupuestoRapidoItemFormSet(BaseInlineFormSet):
    """
    RÁPIDO: exactamente 1 fila.
    - fuerza cantidad=1 (oculta)
    - valida 1 ítem completo (desc + precio)
    """
    def add_fields(self, form, index):
        super().add_fields(form, index)

        if "cantidad" in form.fields:
            form.fields["cantidad"].initial = Decimal("1.00")
            form.fields["cantidad"].widget = forms.HiddenInput()
            form.fields["cantidad"].required = True

    def clean(self):
        super().clean()
        if any(self.errors):
            return

        items_ok = 0

        for form in self.forms:
            if not hasattr(form, "cleaned_data"):
                continue
            if self.can_delete and form.cleaned_data.get("DELETE"):
                continue

            desc = (form.cleaned_data.get("descripcion") or "").strip()
            precio = form.cleaned_data.get("precio_unitario")
            cantidad = form.cleaned_data.get("cantidad")

            # fila vacía => ignorar
            if not desc and (precio in (None, "")):
                continue

            if not desc:
                form.add_error("descripcion", "Completá la descripción del ítem.")
            if precio in (None, ""):
                form.add_error("precio_unitario", "Completá el precio unitario.")

            # cantidad fija y válida
            if cantidad in (None, ""):
                form.add_error("cantidad", "Cantidad inválida.")
            else:
                try:
                    if Decimal(str(cantidad)) <= 0:
                        form.add_error("cantidad", "Cantidad inválida.")
                except Exception:
                    form.add_error("cantidad", "Cantidad inválida.")

            if desc and (precio not in (None, "")):
                items_ok += 1

        if items_ok != 1:
            raise ValidationError("En Presupuesto rápido tenés que cargar exactamente 1 ítem (TOTAL).")


PresupuestoItemFormSet = inlineformset_factory(
    Presupuesto,
    PresupuestoItem,
    form=PresupuestoItemForm,
    formset=BasePresupuestoItemFormSet,
    extra=8,
    can_delete=True,
)

PresupuestoItemFormSetRapido = inlineformset_factory(
    Presupuesto,
    PresupuestoItem,
    form=PresupuestoItemForm,
    formset=BasePresupuestoRapidoItemFormSet,
    extra=1,
    can_delete=True,
)
