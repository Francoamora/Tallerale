from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [("taller", "0019_taller_membresiataller")]
    operations = [migrations.CreateModel(name="AuditoriaTaller", fields=[
        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
        ("accion", models.CharField(max_length=80)),
        ("detalle", models.CharField(max_length=255)),
        ("creado_en", models.DateTimeField(auto_now_add=True)),
        ("actor", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="acciones_taller", to=settings.AUTH_USER_MODEL)),
        ("taller", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="auditoria", to="taller.taller")),
    ])]
