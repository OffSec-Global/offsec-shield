import logging

logger = logging.getLogger(__name__)


class Action:
    name: str = "action"

    async def execute(self, target: str, event_id: str) -> bool:
        """Override in subclass to perform the action."""
        logger.info("Executing action %s on %s (event %s)", self.name, target, event_id)
        return False
