from guardian.detectors.base import BaseDetector
from guardian.models import ThreatEvent


class AnomalyDetector(BaseDetector):
    name = "anomaly_simple"

    async def detect(self, log_line: str) -> list[ThreatEvent]:
        # Placeholder for ML/heuristic anomaly detection
        return []
