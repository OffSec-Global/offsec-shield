from .base import BaseDetector
from .brute_force import BruteForceDetector
from .scanner import ScannerDetector
from .anomaly_simple import AnomalyDetector

DETECTOR_REGISTRY = {
    "brute_force": BruteForceDetector,
    "scanner": ScannerDetector,
    "anomaly_simple": AnomalyDetector,
}


def get_detector(name: str) -> BaseDetector | None:
    detector_cls = DETECTOR_REGISTRY.get(name)
    return detector_cls() if detector_cls else None


def load_detectors(enabled: list[str]) -> list[BaseDetector]:
    detectors: list[BaseDetector] = []
    for name in enabled:
        detector = get_detector(name)
        if detector:
            detectors.append(detector)
    return detectors
