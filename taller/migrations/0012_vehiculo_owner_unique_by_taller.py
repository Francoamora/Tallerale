from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def copiar_owner_desde_cliente(apps, schema_editor):
    Vehiculo = apps.get_model("taller", "Vehiculo")

    for vehiculo in Vehiculo.objects.select_related("cliente").all().iterator():
        vehiculo.owner_id = vehiculo.cliente.owner_id
        vehiculo.save(update_fields=["owner"])


class Migration(migrations.Migration):

    dependencies = [
        ("taller", "0011_owner_multitenancy"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="vehiculo",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="vehiculos",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(copiar_owner_desde_cliente, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="vehiculo",
            name="patente",
            field=models.CharField(db_index=True, max_length=10),
        ),
        migrations.AddConstraint(
            model_name="vehiculo",
            constraint=models.UniqueConstraint(
                fields=("owner", "patente"),
                name="uniq_vehiculo_owner_patente",
            ),
        ),
    ]
