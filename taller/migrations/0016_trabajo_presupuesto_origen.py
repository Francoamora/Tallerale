from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("taller", "0015_apitoken_expires_at_alter_cliente_owner_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="trabajo",
            name="presupuesto_origen",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="trabajos_generados",
                to="taller.presupuesto",
            ),
        ),
    ]
