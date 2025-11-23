import os
import logging
from pathlib import Path
from typing import Optional
import toml

logger = logging.getLogger(__name__)


class Config:
    def __init__(self):
        root_config = Path(__file__).resolve().parents[3] / "config"
        default_path = root_config / "dev.toml"
        if not default_path.exists():
            default_path = root_config / "dev.example.toml"

        self.config_path = Path(os.getenv("GUARDIAN_CONFIG", default_path))
        self.data = self._load_config()

    def _load_config(self) -> dict:
        try:
            if self.config_path.exists():
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return toml.load(f)
        except Exception as exc:
            logger.warning("Failed to load config from %s: %s", self.config_path, exc)

        return self._default_config()

    def _default_config(self) -> dict:
        return {
            "server": {"listen": "0.0.0.0:8001", "log_level": "info"},
            "vaultmesh": {"portal_url": "http://localhost:9110", "timeout_secs": 30},
            "guardian": {
                "id": "guardian-dev",
                "api_url": "http://localhost:9115",
                "capability_token": "dev-token",
                "jwt_private_key_path": str(Path(__file__).resolve().parents[3] / "config" / "dev-guardian.ed25519"),
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


config = Config()
