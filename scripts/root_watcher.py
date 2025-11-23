#!/usr/bin/env python3
"""
OffSec Shield Root Watcher

Watches ROOT.txt for changes, writes ANCHOR.json + anchors/<ts>.json,
and optionally posts a WS-friendly event to portal-ext.

Env vars:
  OFFSEC_DATA_DIR           (default: ./data)
  OFFSEC_ANCHOR_CMD         (optional) shell command template, e.g. "vm-spawn anchor --root {root}"
  OFFSEC_ANCHOR_BROADCAST_URL (optional) e.g. http://localhost:9115/offsec/ingest
  OFFSEC_ANCHOR_TOKEN       (optional) Bearer token for broadcast
  OFFSEC_POLL_INTERVAL_SEC  (default: 5)
"""
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    import blake3  # type: ignore
except ImportError:  # pragma: no cover - fallback to hashlib
    blake3 = None
import hashlib
import urllib.request


def blake3_hex(data: bytes) -> str:
    if blake3:
        return blake3.blake3(data).hexdigest()
    return hashlib.sha256(data).hexdigest()


def read_root(root_path: Path) -> Optional[str]:
    if not root_path.exists():
        return None
    try:
        return root_path.read_text().strip()
    except Exception:
        return None


def anchor(root: str) -> dict:
    ts = datetime.now(timezone.utc).isoformat()
    root_hash = blake3_hex(root.encode())
    metadata = {
        "root": root,
        "root_hash": root_hash,
        "ts": ts,
        "chain": "dev-null",
        "txid": f"demo-{root_hash[:16]}",
        "status": "simulated",
        "command": None,
        "command_output": None,
        "error": None,
    }

    anchor_cmd = os.getenv("OFFSEC_ANCHOR_CMD")
    if anchor_cmd:
        try:
            cmd = anchor_cmd.format(root=root)
            result = subprocess.run(
                cmd, shell=True, check=True, capture_output=True, text=True
            )
            metadata["chain"] = metadata["chain"] or "external"
            metadata["command"] = cmd
            metadata["command_output"] = result.stdout.strip()
            metadata["status"] = "anchored"
            # Heuristic: first line or hash of stdout as txid fallback
            stdout = result.stdout.strip().splitlines()
            if stdout:
                metadata["txid"] = stdout[0][:64]
            else:
                metadata["txid"] = blake3_hex(result.stdout.encode())[:32]
        except subprocess.CalledProcessError as exc:
            metadata["status"] = "error"
            metadata["error"] = exc.stderr or str(exc)
    return metadata


def write_anchor_files(data_dir: Path, record: dict):
    anchors_dir = data_dir / "anchors"
    anchors_dir.mkdir(parents=True, exist_ok=True)

    # Snapshot file
    ts_safe = record["ts"].replace(":", "-")
    snapshot_path = anchors_dir / f"{ts_safe}.json"
    snapshot_path.write_text(json.dumps(record, indent=2))

    # Latest pointer
    (data_dir / "ANCHOR.json").write_text(json.dumps(record, indent=2))


def broadcast_event(root: str, record: dict):
    url = os.getenv("OFFSEC_ANCHOR_BROADCAST_URL")
    if not url:
        return

    token = os.getenv("OFFSEC_ANCHOR_TOKEN")
    payload = {
        "type": "offsec.anchor.success" if record.get("status") == "anchored" else "offsec.anchor.error",
        "data": {
            "root": root,
            "ts": record.get("ts"),
            "chain": record.get("chain"),
            "txid": record.get("txid"),
            "status": record.get("status"),
            "error": record.get("error"),
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp.read()
    except Exception:
        # Best-effort; don't crash watcher
        pass


def main():
    data_dir = Path(os.getenv("OFFSEC_DATA_DIR", "./data"))
    root_path = data_dir / "ROOT.txt"
    poll_interval = int(os.getenv("OFFSEC_POLL_INTERVAL_SEC", "5"))

    data_dir.mkdir(parents=True, exist_ok=True)
    last_seen = None
    print(f"[root-watcher] Watching {root_path} (poll {poll_interval}s)")

    while True:
        current = read_root(root_path)
        if current and current != last_seen:
            print(f"[root-watcher] Detected new root: {current[:16]}...")
            record = anchor(current)
            write_anchor_files(data_dir, record)
            broadcast_event(current, record)
            last_seen = current
        time.sleep(poll_interval)


if __name__ == "__main__":
    main()
