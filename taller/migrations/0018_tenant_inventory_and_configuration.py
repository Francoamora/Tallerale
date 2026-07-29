from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def assign_legacy_owner(apps, schema_editor):
    User = apps.get_model("auth", "User")
    ConfiguracionTaller = apps.get_model("taller", "ConfiguracionTaller")
    Producto = apps.get_model("taller", "Producto")
    owner = User.objects.order_by("id").first()
    if owner is None:
        return
    ConfiguracionTaller.objects.filter(owner__isnull=True).update(owner=owner)
    Producto.objects.filter(owner__isnull=True).update(owner=owner)


class Migration(migrations.Migration):
    dependencies = [
        ("taller", "0017_portal_access_expiry"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="configuraciontaller",
            name="owner",
            field=models.OneToOneField(null=True, on_delete=django.db.models.deletion.CASCADE, related_name="configuracion_taller", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name="producto",
            name="owner",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name="productos", to=settings.AUTH_USER_MODEL),
        ),
        migrations.RunPython(assign_legacy_owner, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="configuraciontaller",
            name="owner",
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="configuracion_taller", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name="producto",
            name="codigo",
            field=models.CharField(max_length=50),
        ),
        migrations.AlterField(
            model_name="producto",
            name="owner",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="productos", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddConstraint(
            model_name="producto",
            constraint=models.UniqueConstraint(fields=("owner", "codigo"), name="uniq_producto_owner_codigo"),
        ),
    ]
