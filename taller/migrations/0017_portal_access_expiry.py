import django.db.models.deletion
from django.db import migrations, models
import taller.models


class Migration(migrations.Migration):
    dependencies = [
        ("taller", "0016_trabajo_presupuesto_origen"),
    ]

    operations = [
        migrations.AddField(
            model_name="presupuesto",
            name="portal_activo",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="presupuesto",
            name="portal_expires_at",
            field=models.DateTimeField(db_index=True, default=taller.models._portal_expiry_default),
        ),
        migrations.AddField(
            model_name="vehiculo",
            name="portal_activo",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="vehiculo",
            name="portal_expires_at",
            field=models.DateTimeField(db_index=True, default=taller.models._portal_expiry_default),
        ),
    ]
