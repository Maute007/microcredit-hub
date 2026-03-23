"""
Carrega definição de papéis (Role) e permissões a partir de JSON parametrizável.
Ficheiro: accounts/config/role_permissions.json
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CONFIG_FILENAME = "role_permissions.json"


def _config_path() -> Path:
    return Path(__file__).resolve().parent / "config" / CONFIG_FILENAME


def load_role_permissions_config() -> dict[str, Any]:
    path = _config_path()
    if not path.is_file():
        raise FileNotFoundError(
            f"Ficheiro de configuração não encontrado: {path}. "
            "Crie accounts/config/role_permissions.json ou copie o exemplo do repositório."
        )
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def get_roles_definitions(config: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    data = config or load_role_permissions_config()
    roles = data.get("roles")
    if not isinstance(roles, list):
        raise ValueError("role_permissions.json: 'roles' deve ser uma lista.")
    return roles


def get_demo_users_definitions(config: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    data = config or load_role_permissions_config()
    users = data.get("demo_users") or []
    if not isinstance(users, list):
        raise ValueError("role_permissions.json: 'demo_users' deve ser uma lista.")
    return users
