import uuid
from datetime import datetime, timezone

from guardian.detectors.base import BaseDetector
from guardian.models import ThreatEvent

SCANNER_KEYWORDS = ["port scan", "nmap", "vulnerability", "exploit", "scanner"]


class ScannerDetector(BaseDetector):
    name = "scanner"

    async def detect(self, log_line: str) -> list[ThreatEvent]:
        lowered = log_line.lower()
        if not any(keyword in lowered for keyword in SCANNER_KEYWORDS):
            return []

        return [
            ThreatEvent(
                id=str(uuid.uuid4()),
                timestamp=datetime.now(timezone.utc).isoformat(),
                severity="medium",
                event_type=self.name,
                source="firewall/ids",
                description="Potential scan activity detected",
                metadata={"raw": log_line[:120]},
            )
        ]
