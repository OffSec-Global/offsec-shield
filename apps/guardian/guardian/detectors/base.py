import logging
from guardian.models import ThreatEvent

logger = logging.getLogger(__name__)


class BaseDetector:
    name: str = "base"

    async def detect(self, log_line: str) -> list[ThreatEvent]:
        """Override in subclass to return ThreatEvent instances."""
        return []
