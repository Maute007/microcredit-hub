import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="Role",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.SlugField(max_length=50, unique=True, verbose_name="Código")),
                ("name", models.CharField(max_length=100, verbose_name="Nome")),
                ("description", models.TextField(blank=True, verbose_name="Descrição")),
                (
                    "is_system",
                    models.BooleanField(
                        default=False,
                        help_text="Roles de sistema (superuser, default) não podem ser removidas.",
                        verbose_name="É sistema",
                    ),
                ),
            ],
            options={
                "verbose_name": "Papel",
                "verbose_name_plural": "Papéis",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                (
                    "is_superuser",
                    models.BooleanField(
                        default=False,
                        help_text="Designates that this user has all permissions without explicitly assigning them.",
                        verbose_name="superuser status",
                    ),
                ),
                ("username", models.CharField(error_messages={"unique": "A user with that username already exists."}, max_length=150, unique=True, verbose_name="username")),
                ("first_name", models.CharField(blank=True, max_length=150, verbose_name="first name")),
                ("last_name", models.CharField(blank=True, max_length=150, verbose_name="last name")),
                ("email", models.EmailField(blank=True, max_length=254, verbose_name="email address")),
                (
                    "is_staff",
                    models.BooleanField(
                        default=False,
                        help_text="Designates whether the user can log into this admin site.",
                        verbose_name="staff status",
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(
                        default=True,
                        help_text="Designates whether this user should be treated as active. Unselect this instead of deleting accounts.",
                        verbose_name="active",
                    ),
                ),
                ("date_joined", models.DateTimeField(auto_now_add=True, verbose_name="date joined")),
                (
                    "role",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="users",
                        to="accounts.role",
                        verbose_name="Papel",
                    ),
                ),
                (
                    "groups",
                    models.ManyToManyField(
                        blank=True,
                        help_text="The groups this user belongs to. A user will get all permissions granted to each of their groups.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.group",
                        verbose_name="groups",
                    ),
                ),
                (
                    "user_permissions",
                    models.ManyToManyField(
                        blank=True,
                        help_text="Specific permissions for this user.",
                        related_name="user_set",
                        related_query_name="user",
                        to="auth.permission",
                        verbose_name="user permissions",
                    ),
                ),
            ],
            options={
                "verbose_name": "Usuário",
                "verbose_name_plural": "Usuários",
            },
        ),
        migrations.CreateModel(
            name="Profile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("phone", models.CharField(blank=True, max_length=30, verbose_name="Telefone")),
                ("avatar", models.URLField(blank=True, null=True, max_length=500, verbose_name="Avatar (URL)")),
                ("address", models.TextField(blank=True, verbose_name="Morada")),
                ("birth_date", models.DateField(blank=True, null=True, verbose_name="Data de nascimento")),
                ("job_title", models.CharField(blank=True, max_length=100, verbose_name="Cargo")),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profile",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Usuário",
                    ),
                ),
            ],
            options={
                "verbose_name": "Perfil",
                "verbose_name_plural": "Perfis",
            },
        ),
        migrations.AddField(
            model_name="role",
            name="permissions",
            field=models.ManyToManyField(
                blank=True,
                related_name="role_set",
                to="auth.permission",
                verbose_name="Permissões",
            ),
        ),
        migrations.AddIndex(
            model_name="role",
            index=models.Index(fields=["code"], name="accounts_ro_code_7ffa44_idx"),
        ),
        migrations.AddIndex(
            model_name="role",
            index=models.Index(fields=["is_system"], name="accounts_ro_is_syst_1b8e88_idx"),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["email"], name="accounts_us_email_4f0d0a_idx"),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["username"], name="accounts_us_usernam_2e8a7b_idx"),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["is_active"], name="accounts_us_is_acti_9c3d2e_idx"),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["role_id"], name="accounts_us_role_id_8a1f5b_idx"),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["email", "is_active"], name="accounts_us_email_i_5a2b3c_idx"),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["username", "is_active"], name="accounts_us_usernam_6d4e5f_idx"),
        ),
        migrations.AddIndex(
            model_name="profile",
            index=models.Index(fields=["user_id"], name="accounts_pr_user_id_a8c9d0_idx"),
        ),
    ]
