from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import taller.models

class Migration(migrations.Migration):
    dependencies = [("taller", "0020_auditoriataller")]
    operations = [migrations.CreateModel(name="InvitacionTaller", fields=[
        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
        ("email", models.EmailField(max_length=254)),
        ("rol", models.CharField(choices=[("ADMIN", "Administrador"), ("RECEPCION", "Recepción"), ("MECANICO", "Mecánico"), ("CONTADOR", "Contador")], max_length=20)),
        ("token", models.UUIDField(db_index=True, default=__import__('uuid').uuid4, editable=False, unique=True)),
        ("expires_at", models.DateTimeField(default=taller.models._invitation_expiry_default)),
        ("aceptada_en", models.DateTimeField(blank=True, null=True)),
        ("creada_por", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="invitaciones_creadas", to=settings.AUTH_USER_MODEL)),
        ("taller", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="invitaciones", to="taller.taller")),
    ])]
