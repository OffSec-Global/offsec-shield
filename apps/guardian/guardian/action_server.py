import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, Any

import httpx

from guardian.actions.alert_human import AlertHumanAction
from guardian.actions.block_ip import BlockIPAction
from guardian.actions.quarantine import QuarantineAction

logger = logging.getLogger(__name__)

PORTAL_URL = os.getenv("OFFSEC_PORTAL_URL", "http://localhost:9115")
ACTION_SERVER_PORT = int(os.getenv("OFFSEC_ACTION_SERVER_PORT", "9120"))

ACTION_MAP = {
    "offsec.action.block_ip": BlockIPAction(),
    "offsec.action.quarantine": QuarantineAction(),
    "offsec.action.alert_human": AlertHumanAction(),
}


async def send_update(req: Dict[str, Any], status: str, details: Dict[str, Any]):
    payload = {
        "action_id": req.get("action_id"),
        "action_type": req.get("action_type"),
        "status": status,
        "details": details,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    url = f"{PORTAL_URL}/offsec/action/update"
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            await client.post(url, json=payload)
        except Exception as exc:
            logger.error("Failed to send action update: %s", exc)


async def process_action(req: Dict[str, Any]) -> Dict[str, Any]:
    action_type = req.get("action_type")
    target = req.get("target", {}) or {}
    target_ip = target.get("ip", "")
    action = ACTION_MAP.get(action_type)
    if not action:
        await send_update(req, "failed", {"error": f"unsupported action_type {action_type}"})
        return {"status": "failed", "details": {"error": "unsupported action"}}

    try:
        ok = await action.execute(target_ip, req.get("action_id", ""))
        status = "applied" if ok else "failed"
        details = {"ip": target_ip, "ok": ok}
    except Exception as exc:
        status = "failed"
        details = {"error": str(exc)}

    await send_update(req, status, details)
    return {"status": status, "details": details}


class ActionHandler(BaseHTTPRequestHandler):
    def _json_response(self, code: int, payload: Dict[str, Any]):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):  # noqa: N802
        if self.path != "/actions/apply":
            self._json_response(404, {"error": "not_found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._json_response(400, {"error": "invalid_json"})
            return

        result = asyncio.run(process_action(data))
        self._json_response(200, {"status": "accepted", **result})


def start_action_server():
    server = ThreadingHTTPServer(("0.0.0.0", ACTION_SERVER_PORT), ActionHandler)
    logger.info("Action server listening on %s", ACTION_SERVER_PORT)
    return server
