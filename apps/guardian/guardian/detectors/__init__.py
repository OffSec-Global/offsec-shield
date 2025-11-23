import time
from typing import Optional

_last_detection_ts: Optional[float] = None


def touch_detection() -> None:
    """Record the timestamp of the most recent detection."""
    global _last_detection_ts
    _last_detection_ts = time.time()


def last_detection_age() -> Optional[float]:
    """Return seconds since the last detection, or None if none recorded."""
    if _last_detection_ts is None:
        return None
    return time.time() - _last_detection_ts
