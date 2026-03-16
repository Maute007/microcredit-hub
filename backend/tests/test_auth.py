import pytest


@pytest.mark.django_db
class TestAuth:
    def test_login_with_username(self, api_client, user):
        resp = api_client.post(
            "/api/auth/login/",
            {"identifier": "testuser", "password": "testpass123"},
            format="json",
        )
        assert resp.status_code == 200
        assert "detail" in resp.data

    def test_login_with_email(self, api_client, user):
        resp = api_client.post(
            "/api/auth/login/",
            {"identifier": "test@example.com", "password": "testpass123"},
            format="json",
        )
        assert resp.status_code == 200

    def test_login_wrong_password(self, api_client, user):
        resp = api_client.post(
            "/api/auth/login/",
            {"identifier": "testuser", "password": "wrongpass"},
            format="json",
        )
        assert resp.status_code in (400, 401)

    def test_login_missing_identifier(self, api_client):
        url = "/api/auth/login/"
        resp = api_client.post(url, {"password": "testpass123"}, format="json")
        assert resp.status_code in (400, 401)

    def test_protected_endpoint_requires_auth(self, api_client):
        resp = api_client.get("/api/clients/")
        assert resp.status_code == 401
