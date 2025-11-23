import logging

from guardian.actions.base import Action

logger = logging.getLogger(__name__)


class AlertHumanAction(Action):
    name = "alert_human"

    async def execute(self, target: str, event_id: str) -> bool:
        logger.warning("Alerting human: %s (event: %s)", target, event_id)
        # Send notification via Slack/email/etc in production
        return True
