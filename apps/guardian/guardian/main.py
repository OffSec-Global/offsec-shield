import asyncio
import logging
import sys
import uuid
import threading
from datetime import datetime, timezone

from guardian.client import PortalClient
from guardian.config import config, guardian_id, guardian_tags
from guardian.detectors import load_detectors
from guardian.models import ActionRequest
from guardian.action_server import start_action_server

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


class Guardian:
    def __init__(self):
        self.client = PortalClient()
        self.detectors = load_detectors(config.get("detectors.enabled", []))
        self.allowed_actions = set(config.get("actions.allowed", []))
        self.guardian_id = guardian_id()
        self.guardian_tags = guardian_tags()

    async def run(self):
        logger.info(
            "Guardian starting (id=%s, tags=%s) with detectors: %s",
            self.guardian_id,
            self.guardian_tags,
            [d.name for d in self.detectors],
        )
        server = start_action_server()
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        try:
            await self._demo_ingestion()
            # Keep the process alive to serve actions and avoid restart loops.
            await self._idle_forever()
        except KeyboardInterrupt:
            logger.info("Guardian stopping...")
        finally:
            server.shutdown()
            await self.client.close()

    async def _demo_ingestion(self):
        """Demo mode: simulate threat events."""
        sample_logs = [
            "sshd[1234]: Failed password for invalid user admin from 192.168.1.100 port 12345",
            "nginx: 192.168.1.101 scanning ports...",
            "firewall: port scan detected from 192.168.1.102",
        ]

        logger.info("Running in demo mode. Processing sample logs...")

        for log_line in sample_logs:
            for detector in self.detectors:
                events = await detector.detect(log_line)
                for event in events:
                    logger.info(
                        "Event detected: %s - %s", event.event_type, event.description
                    )
                    await self.client.ingest_event(event)
                    await self._maybe_execute_action(
                        event.id, event.affected[0] if event.affected else ""
                    )

            await asyncio.sleep(1)

        logger.info("Demo ingestion complete.")

    async def _maybe_execute_action(self, event_id: str, target: str):
        action_name = "block_ip"
        if action_name not in self.allowed_actions:
            logger.debug("Action %s not allowed by capability", action_name)
            return

        action = ActionRequest(
            id=str(uuid.uuid4()),
            event_id=event_id,
            action=action_name,
            target=target,
            reason=f"Auto-response for {event_id}",
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        await self.client.submit_action(action)

    async def _idle_forever(self):
        while True:
            await asyncio.sleep(3600)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "run":
        guardian = Guardian()
        asyncio.run(guardian.run())
    else:
        logger.info("Usage: poetry run guardian run")


if __name__ == "__main__":
    main()
