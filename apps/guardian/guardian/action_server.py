import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Dict, Any

import httpx

from guardian.actions.alert_human import AlertHumanAction
from guardian.actions.block_ip import BlockIPAction
from guardian.actions.quarantine import QuarantineAction
from guardian.config import guardian_id, guardian_tags

logger = logging.getLogger(__name__)

PORTAL_URL = os.getenv("OFFSEC_PORTAL_URL", "http://localhost:9115")
ACTION_SERVER_PORT = int(os.getenv("OFFSEC_ACTION_SERVER_PORT", "9120"))
READY_MAX_DETECTOR_AGE = int(os.getenv("OFFSEC_READY_MAX_DETECTOR_AGE", "600"))
DATA_DIR = os.getenv("OFFSEC_DATA_DIR", "/data")

ACTION_MAP = {
    "offsec.action.block_ip": BlockIPAction(),
    "offsec.action.quarantine": QuarantineAction(),
    "offsec.action.alert_human": AlertHumanAction(),
}

GUARDIAN_ID = guardian_id()
GUARDIAN_TAGS = guardian_tags()


async def send_update(req: Dict[str, Any], status: str, details: Dict[str, Any]):
    gid = req.get("guardian_id") or GUARDIAN_ID
    tags = req.get("guardian_tags") or GUARDIAN_TAGS
    payload = {
        "action_id": req.get("action_id"),
        "action_type": req.get("action_type"),
        "status": status,
        "details": details,
        "ts": datetime.now(timezone.utc).isoformat(),
        "guardian_id": gid,
        "guardian_tags": tags,
    }
    url = f"{PORTAL_URL}/offsec/action/update"
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            await client.post(url, json=payload)
        except Exception as exc:
            logger.error("Failed to send action update: %s", exc)


async def process_action(req: Dict[str, Any]) -> Dict[str, Any]:
    action_type = req.get("action_type")
    req.setdefault("guardian_id", GUARDIAN_ID)
    req.setdefault("guardian_tags", GUARDIAN_TAGS)
    target = req.get("target", {}) or {}
    target_ip = target.get("ip", "")
    action = ACTION_MAP.get(action_type)
    if not action:
        await send_update(
            req, "failed", {"error": f"unsupported action_type {action_type}"}
        )
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
    def _write_ready(self):
        ok, details = readiness_status()
        code = 200 if ok else 503
        self._json_response(code, {"ready": ok, "details": details})

    def _json_response(self, code: int, payload: Dict[str, Any]):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path == "/healthz":
            self._json_response(200, {"status": "ok"})
            return
        if self.path == "/healthz/ready":
            self._write_ready()
            return

        self._json_response(404, {"error": "not_found"})

    def do_HEAD(self):  # noqa: N802
        if self.path == "/healthz":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if self.path == "/healthz/ready":
            ok, _ = readiness_status()
            self.send_response(200 if ok else 503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()

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


def start_action_server(host: str = "0.0.0.0", port: int | None = None):
    listen_port = port if port is not None else ACTION_SERVER_PORT
    server = ThreadingHTTPServer((host, listen_port), ActionHandler)
    logger.info("Action server listening on %s", listen_port)
    return server


def _check_data_writable(path: str) -> tuple[bool, str]:
    try:
        os.makedirs(path, exist_ok=True)
        testpath = os.path.join(path, ".ready_write_test")
        with open(testpath, "w", encoding="utf-8") as fh:
            fh.write(str(time.time()))
        os.remove(testpath)
        return True, ""
    except Exception as exc:  # pragma: no cover - defensive
        return False, str(exc)


def _check_detector(max_age: int) -> tuple[bool, str]:
    try:
        from guardian.detectors import last_detection_age
    except Exception as exc:  # pragma: no cover - defensive
        return False, f"detector import error: {exc}"

    age = last_detection_age()
    if age is None:
        return True, "no_detection_yet"
    if age > max_age:
        return False, f"last_detection_age={age:.1f}s"
    return True, f"last_detection_age={age:.1f}s"


def readiness_status() -> tuple[bool, Dict[str, Any]]:
    data_dir = os.getenv("OFFSEC_DATA_DIR", DATA_DIR)
    max_age = int(os.getenv("OFFSEC_READY_MAX_DETECTOR_AGE", READY_MAX_DETECTOR_AGE))

    ok = True
    details: Dict[str, Any] = {}

    data_ok, data_msg = _check_data_writable(data_dir)
    details["data_writable"] = data_ok
    if data_msg:
        details["data_error"] = data_msg
    ok = ok and data_ok

    det_ok, det_msg = _check_detector(max_age)
    details["detector_ok"] = det_ok
    details["detector_status"] = det_msg
    ok = ok and det_ok

    return ok, details
