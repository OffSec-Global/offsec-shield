import re
import uuid
from datetime import datetime, timezone

from guardian.detectors import touch_detection
from guardian.detectors.base import BaseDetector
from guardian.models import ThreatEvent


class BruteForceDetector(BaseDetector):
    name = "brute_force"

    def __init__(self, threshold: int = 5):
        self.threshold = threshold
        self.failed_attempts: dict[str, int] = {}

    async def detect(self, log_line: str) -> list[ThreatEvent]:
        lowered = log_line.lower()
        if "failed password" not in lowered and "invalid user" not in lowered:
            return []

        ip = self._extract_ip(log_line)
        if not ip:
            return []

        self.failed_attempts[ip] = self.failed_attempts.get(ip, 0) + 1
        if self.failed_attempts[ip] < self.threshold:
            return []

        touch_detection()
        return [
            ThreatEvent(
                id=str(uuid.uuid4()),
                timestamp=datetime.now(timezone.utc).isoformat(),
                severity="high",
                event_type=self.name,
                source="ssh/nginx",
                description=f"Brute force attack detected from {ip}",
                affected=[ip],
                metadata={"attempts": self.failed_attempts[ip]},
            )
        ]

    @staticmethod
    def _extract_ip(line: str) -> str:
        match = re.search(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", line)
        return match.group(0) if match else ""
