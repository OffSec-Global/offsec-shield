import threading
import os

import httpx
import pytest

from guardian.action_server import start_action_server


@pytest.mark.asyncio
async def test_healthz_returns_ok():
    server = start_action_server(host="127.0.0.1", port=0)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"http://127.0.0.1:{port}/healthz", timeout=2.0)
        assert resp.status_code == 200
        assert resp.json().get("status") == "ok"
    finally:
        server.shutdown()
        thread.join(timeout=2)


@pytest.mark.asyncio
async def test_readiness_returns_ok(tmp_path):
    prev_dir = os.environ.get("OFFSEC_DATA_DIR")
    prev_age = os.environ.get("OFFSEC_READY_MAX_DETECTOR_AGE")
    os.environ["OFFSEC_DATA_DIR"] = str(tmp_path)
    os.environ["OFFSEC_READY_MAX_DETECTOR_AGE"] = "600"

    server = start_action_server(host="127.0.0.1", port=0)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"http://127.0.0.1:{port}/healthz/ready", timeout=2.0
            )
        assert resp.status_code == 200
        assert resp.json().get("ready") is True
        details = resp.json().get("details", {})
        assert "data_writable" in details
        assert "detector_ok" in details
    finally:
        server.shutdown()
        thread.join(timeout=2)
        if prev_dir is not None:
            os.environ["OFFSEC_DATA_DIR"] = prev_dir
        else:
            os.environ.pop("OFFSEC_DATA_DIR", None)
        if prev_age is not None:
            os.environ["OFFSEC_READY_MAX_DETECTOR_AGE"] = prev_age
        else:
            os.environ.pop("OFFSEC_READY_MAX_DETECTOR_AGE", None)
