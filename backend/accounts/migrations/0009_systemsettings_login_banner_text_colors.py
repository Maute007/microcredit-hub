from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_systemsettings_login_banner_typography"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="login_body_color",
            field=models.CharField(
                blank=True,
                help_text="Vazio = cor padrão.",
                max_length=32,
                verbose_name="Cor do corpo",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_subtitle_color",
            field=models.CharField(
                blank=True,
                help_text="Vazio = cor padrão.",
                max_length=32,
                verbose_name="Cor do subtítulo",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_title_color",
            field=models.CharField(
                blank=True,
                help_text="Ex.: #ffffff, rgb(...), var(--token). Vazio = cor padrão.",
                max_length=32,
                verbose_name="Cor do título",
            ),
        ),
    ]
