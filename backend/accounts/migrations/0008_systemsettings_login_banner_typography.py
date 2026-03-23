# Generated manually for login banner typography / alignment

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0007_add_login_banner_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="systemsettings",
            name="login_banner_title",
            field=models.CharField(
                blank=True,
                help_text="Se vazio, usa a frase de impacto (tagline).",
                max_length=300,
                verbose_name="Título do banner (login)",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_banner_subtitle",
            field=models.CharField(blank=True, max_length=400, verbose_name="Subtítulo do banner"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_banner_body",
            field=models.TextField(
                blank=True,
                help_text="Texto principal. Se vazio, usa a descrição do painel esquerdo.",
                verbose_name="Corpo do banner",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_banner_text_align",
            field=models.CharField(
                default="left",
                help_text="left, center, right ou justify",
                max_length=12,
                verbose_name="Alinhamento do texto",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_banner_block_align",
            field=models.CharField(
                default="start",
                help_text="start, center ou end — no painel.",
                max_length=12,
                verbose_name="Posição horizontal do bloco",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_banner_vertical_align",
            field=models.CharField(
                default="between",
                help_text="start, center, end ou between (espaça topo e rodapé).",
                max_length=12,
                verbose_name="Distribuição vertical do painel",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_banner_max_width",
            field=models.CharField(
                default="100%",
                help_text="Ex.: 36rem, 90%, 100%",
                max_length=32,
                verbose_name="Largura máx. do bloco de texto",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_banner_padding",
            field=models.CharField(
                default="0",
                help_text="Ex.: 0, 1rem, 1.5rem 2rem",
                max_length=32,
                verbose_name="Padding interno do bloco",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_title_font_size",
            field=models.CharField(
                blank=True,
                help_text="Ex.: 1.75rem ou 28px. Vazio = tamanho responsivo padrão.",
                max_length=16,
                verbose_name="Tamanho do título",
            ),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_subtitle_font_size",
            field=models.CharField(blank=True, max_length=16, verbose_name="Tamanho do subtítulo"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_body_font_size",
            field=models.CharField(blank=True, max_length=16, verbose_name="Tamanho do corpo"),
        ),
        migrations.AddField(
            model_name="systemsettings",
            name="login_show_feature_boxes",
            field=models.BooleanField(default=True, verbose_name="Mostrar caixas de destaques no login"),
        ),
    ]
