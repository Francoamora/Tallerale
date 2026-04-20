from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def asignar_owner_a_datos_existentes(apps, schema_editor):
    """Asigna todos los registros legacy al primer usuario del sistema (Ale)."""
    User = apps.get_model('auth', 'User')
    Cliente = apps.get_model('taller', 'Cliente')
    Presupuesto = apps.get_model('taller', 'Presupuesto')
    Gasto = apps.get_model('taller', 'Gasto')
    Turno = apps.get_model('taller', 'Turno')

    primer_usuario = User.objects.order_by('id').first()
    if not primer_usuario:
        return

    Cliente.objects.filter(owner__isnull=True).update(owner=primer_usuario)
    Presupuesto.objects.filter(owner__isnull=True).update(owner=primer_usuario)
    Gasto.objects.filter(owner__isnull=True).update(owner=primer_usuario)
    Turno.objects.filter(owner__isnull=True).update(owner=primer_usuario)


class Migration(migrations.Migration):

    dependencies = [
        ('taller', '0010_apitoken_perfiltaller'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='cliente',
            name='owner',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='clientes',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='presupuesto',
            name='owner',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='presupuestos',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='gasto',
            name='owner',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='gastos',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='turno',
            name='owner',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='turnos_agenda',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(
            asignar_owner_a_datos_existentes,
            migrations.RunPython.noop,
        ),
    ]
