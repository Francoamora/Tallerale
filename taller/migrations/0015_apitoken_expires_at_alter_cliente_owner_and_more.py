from datetime import timedelta

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone
import taller.models


def assign_expiry_to_existing_tokens(apps, schema_editor):
    ApiToken = apps.get_model("taller", "ApiToken")
    ApiToken.objects.filter(expires_at__isnull=True).update(
        expires_at=timezone.now() + timedelta(days=30),
    )


class Migration(migrations.Migration):

    dependencies = [
        ("taller", "0014_owner_operaciones"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="apitoken",
            name="expires_at",
            field=models.DateTimeField(db_index=True, null=True),
        ),
        migrations.RunPython(assign_expiry_to_existing_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="apitoken",
            name="expires_at",
            field=models.DateTimeField(db_index=True, default=taller.models._token_expiry_default),
        ),
        migrations.AlterField(
            model_name="cliente",
            name="owner",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="clientes", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name="gasto",
            name="owner",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="gastos", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name="movimientocuenta",
            name="owner",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="movimientos_cuenta", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name="presupuesto",
            name="owner",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="presupuestos", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name="trabajo",
            name="owner",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="trabajos", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name="turno",
            name="owner",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="turnos_agenda", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name="vehiculo",
            name="owner",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="vehiculos", to=settings.AUTH_USER_MODEL),
        ),
    ]
