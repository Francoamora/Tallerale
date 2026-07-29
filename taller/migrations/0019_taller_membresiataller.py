from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def create_tenants_for_existing_profiles(apps, schema_editor):
    PerfilTaller = apps.get_model("taller", "PerfilTaller")
    Taller = apps.get_model("taller", "Taller")
    MembresiaTaller = apps.get_model("taller", "MembresiaTaller")
    for perfil in PerfilTaller.objects.select_related("user").iterator():
        taller, _ = Taller.objects.get_or_create(owner=perfil.user, defaults={"nombre": perfil.taller_nombre or "Mi Taller"})
        MembresiaTaller.objects.get_or_create(taller=taller, user=perfil.user, defaults={"rol": "ADMIN"})


class Migration(migrations.Migration):
    dependencies = [("taller", "0018_tenant_inventory_and_configuration")]
    operations = [
        migrations.CreateModel(
            name="Taller",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=150)),
                ("activo", models.BooleanField(default=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("owner", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="taller_propietario", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="MembresiaTaller",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("rol", models.CharField(choices=[("ADMIN", "Administrador"), ("RECEPCION", "Recepción"), ("MECANICO", "Mecánico"), ("CONTADOR", "Contador")], default="MECANICO", max_length=20)),
                ("activo", models.BooleanField(default=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("taller", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="miembros", to="taller.taller")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="membresias_taller", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(model_name="membresiataller", constraint=models.UniqueConstraint(fields=("taller", "user"), name="uniq_membresia_taller_usuario")),
        migrations.RunPython(create_tenants_for_existing_profiles, migrations.RunPython.noop),
    ]
