from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("taller", "0023_trabajo_finalizado_en_trabajo_iniciado_en_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="gasto",
            name="metodo_pago",
            field=models.CharField(
                choices=[
                    ("EFECTIVO", "Efectivo"),
                    ("TRANSFERENCIA", "Transferencia"),
                    ("TARJETA", "Tarjeta"),
                    ("CHEQUE", "Cheque"),
                    ("CONTADO", "Contado"),
                ],
                default="EFECTIVO",
                max_length=20,
                verbose_name="Método de pago",
            ),
        ),
        migrations.AddField(
            model_name="gasto",
            name="registrado_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="gastos_registrados",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
