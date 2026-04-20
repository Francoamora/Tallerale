from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def poblar_owner_operaciones(apps, schema_editor):
    Trabajo = apps.get_model("taller", "Trabajo")
    MovimientoCuenta = apps.get_model("taller", "MovimientoCuenta")

    for trabajo in Trabajo.objects.select_related("cliente").filter(owner__isnull=True).iterator():
        trabajo.owner_id = trabajo.cliente.owner_id
        trabajo.save(update_fields=["owner"])

    for movimiento in MovimientoCuenta.objects.select_related("cliente").filter(owner__isnull=True).iterator():
        movimiento.owner_id = movimiento.cliente.owner_id
        movimiento.save(update_fields=["owner"])


class Migration(migrations.Migration):

    dependencies = [
        ("taller", "0013_public_tokens"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="trabajo",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="trabajos",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="movimientocuenta",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="movimientos_cuenta",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(poblar_owner_operaciones, migrations.RunPython.noop),
    ]
