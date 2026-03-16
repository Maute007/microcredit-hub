import pytest


@pytest.mark.django_db
class TestReportsAPI:
    def test_reports_list_authenticated(self, authenticated_client):
        resp = authenticated_client.get("/api/reports/")
        assert resp.status_code == 200
        assert "reports" in resp.data
        assert len(resp.data["reports"]) > 0
        first = resp.data["reports"][0]
        assert "id" in first
        assert "title" in first
        assert "description" in first
        assert "type" in first
