import os
import time
from pathlib import Path
from secrets import token_hex
from typing import List, Optional

import jwt

from guardian.config import config


class CapabilityIssuer:
    def __init__(
        self,
        guardian_id: str,
        allowed_actions: List[str],
        private_key: Optional[str],
        hs256_secret: Optional[str],
        audience: str = "offsec-portal",
    ):
        self.guardian_id = guardian_id
        self.allowed_actions = allowed_actions
        self.private_key = private_key
        self.hs256_secret = hs256_secret or "dev-secret"
        self.audience = audience
        self._cached_token: Optional[str] = None
        self._expires_at: int = 0

    def _issue(self, lifetime_sec: int = 300) -> str:
        now = int(time.time())
        exp = now + lifetime_sec
        payload = {
            "sub": self.guardian_id,
            "aud": self.audience,
            "iat": now,
            "exp": exp,
            "actions": self.allowed_actions,
            "nonce": token_hex(8),
        }

        if self.private_key:
            token = jwt.encode(payload, self.private_key, algorithm="EdDSA")
        else:
            token = jwt.encode(payload, self.hs256_secret, algorithm="HS256")

        self._cached_token = token
        self._expires_at = exp
        return token

    def token(self) -> str:
        now = int(time.time())
        if not self._cached_token or now >= (self._expires_at - 120):
            return self._issue()
        return self._cached_token


def load_private_key() -> Optional[str]:
    env_key = os.getenv("GUARDIAN_JWT_PRIVATE_KEY")
    if env_key:
        return env_key

    key_path = config.get("guardian.jwt_private_key_path")
    if key_path and Path(key_path).expanduser().exists():
        return Path(key_path).expanduser().read_text().strip()
    return None


def build_capability_issuer() -> CapabilityIssuer:
    guardian_id = config.get("guardian.id", "guardian-dev")
    allowed_actions = config.get("actions.allowed", [])
    hs_secret = os.getenv(
        "GUARDIAN_JWT_HS256_SECRET",
        config.get("guardian.jwt_hs256_secret", "dev-secret"),
    )
    private_key = load_private_key()
    audience = os.getenv("GUARDIAN_CAP_AUD", "offsec-portal")
    return CapabilityIssuer(
        guardian_id=guardian_id,
        allowed_actions=allowed_actions,
        private_key=private_key,
        hs256_secret=hs_secret,
        audience=audience,
    )
