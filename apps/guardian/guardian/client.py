import logging
import httpx
from guardian.capability import build_capability_issuer
from guardian.config import config
from guardian.models import ThreatEvent, ActionRequest

logger = logging.getLogger(__name__)


class PortalClient:
    def __init__(self):
        self.api_url = config.get("guardian.api_url", "http://localhost:9115")
        self.timeout = config.get("vaultmesh.timeout_secs", 30)
        self.client = httpx.AsyncClient(timeout=self.timeout)
        self.issuer = build_capability_issuer()

    def _auth_header(self) -> dict:
        token = self.issuer.token()
        return {"Authorization": f"Bearer {token}"}

    async def ingest_event(self, event: ThreatEvent) -> bool:
        try:
            response = await self.client.post(
                f"{self.api_url}/offsec/ingest",
                json=event.dict(),
                headers=self._auth_header(),
            )
            return response.status_code == 200
        except Exception as exc:
            logger.error("Failed to ingest event: %s", exc)
            return False

    async def submit_action(self, action: ActionRequest) -> bool:
        try:
            response = await self.client.post(
                f"{self.api_url}/offsec/action",
                json=action.dict(),
                headers=self._auth_header(),
            )
            return response.status_code == 200
        except Exception as exc:
            logger.error("Failed to submit action: %s", exc)
            return False

    async def close(self):
        await self.client.aclose()
