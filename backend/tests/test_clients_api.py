import pytest


@pytest.mark.django_db
class TestClientsAPI:
    def test_list_clients_authenticated(self, authenticated_client, client_instance):
        resp = authenticated_client.get("/api/clients/")
        assert resp.status_code == 200
        assert "results" in resp.data
        assert len(resp.data["results"]) >= 1

    def test_create_client_authenticated(self, authenticated_client):
        resp = authenticated_client.post(
            "/api/clients/",
            {
                "name": "Maria Nova",
                "email": "maria@example.com",
                "phone": "+258 84 999 0000",
                "status": "ativo",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["name"] == "Maria Nova"
        assert resp.data["email"] == "maria@example.com"
