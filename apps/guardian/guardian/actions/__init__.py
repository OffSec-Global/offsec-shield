from .base import Action
from .block_ip import BlockIPAction
from .alert_human import AlertHumanAction
from .quarantine import QuarantineAction

ACTION_REGISTRY = {
    "block_ip": BlockIPAction,
    "alert_human": AlertHumanAction,
    "quarantine": QuarantineAction,
}


def get_action(name: str) -> Action | None:
    action_cls = ACTION_REGISTRY.get(name)
    return action_cls() if action_cls else None
