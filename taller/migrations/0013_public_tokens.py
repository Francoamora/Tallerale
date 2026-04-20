import uuid

from django.db import migrations, models


def poblar_tokens_publicos(apps, schema_editor):
    Vehiculo = apps.get_model("taller", "Vehiculo")
    Presupuesto = apps.get_model("taller", "Presupuesto")

    for vehiculo in Vehiculo.objects.filter(token__isnull=True).iterator():
        vehiculo.token = uuid.uuid4()
        vehiculo.save(update_fields=["token"])

    for presupuesto in Presupuesto.objects.filter(token__isnull=True).iterator():
        presupuesto.token = uuid.uuid4()
        presupuesto.save(update_fields=["token"])


class Migration(migrations.Migration):

    dependencies = [
        ("taller", "0012_vehiculo_owner_unique_by_taller"),
    ]

    operations = [
        migrations.AddField(
            model_name="vehiculo",
            name="token",
            field=models.UUIDField(blank=True, db_index=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="presupuesto",
            name="token",
            field=models.UUIDField(blank=True, db_index=True, editable=False, null=True),
        ),
        migrations.RunPython(poblar_tokens_publicos, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="vehiculo",
            name="token",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name="presupuesto",
            name="token",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
