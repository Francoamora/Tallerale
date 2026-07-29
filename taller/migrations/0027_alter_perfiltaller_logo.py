from django.db import migrations, models

import taller.models


class Migration(migrations.Migration):

    dependencies = [
        ("taller", "0026_perfiltaller_logo"),
    ]

    operations = [
        migrations.AlterField(
            model_name="perfiltaller",
            name="logo",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=taller.models.logo_taller_upload_to,
            ),
        ),
    ]
