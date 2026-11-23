from django.db import migrations, models


def frenar_si_hay_productos(apps, schema_editor):
    """El inventario nunca tuvo pantalla, así que la tabla debería estar vacía.
    Si alguien cargó productos por otro lado, se frena el despliegue en vez de
    borrarlos: Railway mantiene la versión anterior y no se pierde nada."""
    Producto = apps.get_model("taller", "Producto")
    cantidad = Producto.objects.count()
    if cantidad:
        raise RuntimeError(
            f"Hay {cantidad} productos cargados en el inventario: no se borra la tabla. "
            "Revisarlos antes de volver a desplegar."
        )


class Migration(migrations.Migration):

    dependencies = [
        ("taller", "0033_whatsapp_contador"),
    ]

    operations = [
        migrations.AddField(
            model_name="cliente",
            name="condicion_iva",
            field=models.CharField(
                choices=[
                    ("CONSUMIDOR_FINAL", "Consumidor final"),
                    ("RESPONSABLE_INSCRIPTO", "Responsable inscripto"),
                    ("MONOTRIBUTO", "Monotributo"),
                    ("EXENTO", "IVA exento"),
                ],
                default="CONSUMIDOR_FINAL",
                max_length=30,
                verbose_name="Condición frente al IVA",
            ),
        ),
        migrations.RunPython(frenar_si_hay_productos, migrations.RunPython.noop),
        migrations.DeleteModel(name="Producto"),
    ]
