from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0009_systemsettings_login_banner_text_colors"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="login_banner_kicker",
            field=models.CharField(
                blank=True,
                help_text="Texto pequeno em forma de selo no banner (ex.: nome do sistema). Vazio = usa nome.",
                max_length=120,
                verbose_name="Kicker do banner (selo)",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_banner_image_url",
            field=models.URLField(
                blank=True,
                help_text="URL opcional para imagem de fundo do banner (login e dashboard).",
                max_length=600,
                verbose_name="Imagem de fundo do banner (URL)",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="calendar_type_labels",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Mapa tipo->rótulo (ex.: meeting='Reunião').",
                verbose_name="Rótulos de categorias do calendário",
            ),
        ),
    ]

