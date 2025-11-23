import logging

from guardian.actions.base import Action

logger = logging.getLogger(__name__)


class QuarantineAction(Action):
    name = "quarantine"

    async def execute(self, target: str, event_id: str) -> bool:
        logger.info("Quarantining target: %s (event: %s)", target, event_id)
        # Stub: isolate compromised system
        return True
