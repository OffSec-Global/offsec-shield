import logging

from guardian.actions.base import Action

logger = logging.getLogger(__name__)


class BlockIPAction(Action):
    name = "block_ip"

    async def execute(self, target: str, event_id: str) -> bool:
        logger.info("Blocking IP: %s (event: %s)", target, event_id)
        # In production, call firewall API or iptables
        return True
