"""Fixtures partilhados para testes da API: clientes HTTP, utilizadores, autenticação."""
import pytest
from rest_framework.test import APIClient

from accounts.models import Role, User
from clients.models import Client


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def default_role(db):
    role, _ = Role.objects.get_or_create(
        code="default",
        defaults={"name": "Utilizador padrão", "description": "Permissões básicas", "is_system": True},
    )
    return role


@pytest.fixture
def user(db, default_role):
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
        first_name="Test",
        last_name="User",
        role=default_role,
    )


@pytest.fixture
def superuser(db, default_role):
    return User.objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="adminpass123",
    )


@pytest.fixture
def authenticated_client(api_client, superuser):
    """Uses superuser to bypass DjangoModelPermissions for API tests."""
    api_client.force_authenticate(user=superuser)
    return api_client


@pytest.fixture
def client_instance(db):
    return Client.objects.create(
        name="João Teste",
        email="joao@example.com",
        phone="+258 84 123 4567",
        document="123456789",
        city="Maputo",
        status="ativo",
    )
