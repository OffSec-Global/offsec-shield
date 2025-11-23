import os
import logging
from pathlib import Path
from typing import List, Optional
import toml

logger = logging.getLogger(__name__)


class Config:
    def __init__(self):
        env_path = os.getenv("GUARDIAN_CONFIG")
        if env_path:
            self.config_path = Path(env_path)
        else:
            root_config = Path(__file__).resolve().parents[3] / "config"
            default_path = root_config / "dev.toml"
            if not default_path.exists():
                default_path = root_config / "dev.example.toml"
            self.config_path = default_path

        self.data = self._load_config()
        self._apply_env_overrides()

    def _load_config(self) -> dict:
        try:
            if self.config_path.exists():
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return toml.load(f)
        except Exception as exc:
            logger.warning("Failed to load config from %s: %s", self.config_path, exc)

        return self._default_config()

    def _apply_env_overrides(self) -> None:
        """
        Allow container env vars to override key settings without editing toml.
        """
        env_api = os.getenv("GUARDIAN_API_URL") or os.getenv("OFFSEC_PORTAL_URL")
        if env_api:
            self.data.setdefault("guardian", {})
            self.data["guardian"]["api_url"] = env_api

        env_actions = os.getenv("GUARDIAN_ALLOWED_ACTIONS")
        if env_actions:
            actions = [a.strip() for a in env_actions.split(",") if a.strip()]
            self.data.setdefault("actions", {})
            self.data["actions"]["allowed"] = actions

        allowed = _parse_csv_env("GUARDIAN_ALLOWED_ACTIONS")
        if allowed:
            self.data.setdefault("actions", {})
            self.data["actions"]["allowed"] = allowed

    def _default_config(self) -> dict:
        return {
            "server": {"listen": "0.0.0.0:8001", "log_level": "info"},
            "vaultmesh": {"portal_url": "http://localhost:9110", "timeout_secs": 30},
            "guardian": {
                "id": "guardian-dev",
                "tags": ["dev"],
                "api_url": "http://localhost:9115",
                "capability_token": "dev-token",
                "jwt_private_key_path": str(
                    Path(__file__).resolve().parents[3]
                    / "config"
                    / "dev-guardian.ed25519"
                ),
                "jwt_hs256_secret": "dev-secret",
            },
            "detectors": {"enabled": ["brute_force", "scanner", "anomaly_simple"]},
            "actions": {
                "allowed": ["block_ip", "alert_human", "quarantine"],
                "require_approval": True,
            },
            "logging": {"format": "json", "level": "debug"},
        }

    def get(self, path: str, default=None):
        keys = path.split(".")
        value = self.data
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return default
        return value if value is not None else default


def _parse_csv_env(name: str) -> List[str]:
    raw = os.getenv(name)
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def guardian_id() -> str:
    env_id = os.getenv("OFFSEC_GUARDIAN_ID") or os.getenv("GUARDIAN_ID")
    config_id = config.get("guardian.id")
    guardian = env_id or config_id
    if not guardian:
        raise ValueError(
            "Guardian id not set. Set OFFSEC_GUARDIAN_ID or guardian.id in the config."
        )
    return guardian


def guardian_tags() -> List[str]:
    env_tags = _parse_csv_env("GUARDIAN_TAGS") or _parse_csv_env("OFFSEC_GUARDIAN_TAGS")
    if env_tags:
        return env_tags
    return config.get("guardian.tags", []) or []


config = Config()
