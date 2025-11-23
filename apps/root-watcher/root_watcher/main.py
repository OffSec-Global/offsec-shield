import hashlib
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from typing import Dict, Optional

import requests

DEFAULT_POLL_INTERVAL = 10  # seconds


def env(name: str, default: Optional[str] = None) -> str:
    val = os.environ.get(name)
    if val is None:
        if default is None:
            raise RuntimeError(f"Missing required env var: {name}")
        return default
    return val


def load_root(path: str) -> Optional[str]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        return None


def hash_root(root: str) -> str:
    return hashlib.sha256(root.encode("utf-8")).hexdigest()


def anchor_dev(root_hex: str) -> Dict:
    ts = datetime.now(timezone.utc).isoformat()
    return {
        "root": root_hex,
        "ts": ts,
        "chain": "dev-null",
        "txid": f"demo-{hash_root(root_hex)[:16]}",
        "status": "simulated",
    }


def anchor_vm_spawn(root_hex: str, spawn_cmd: str) -> Dict:
    cmd = spawn_cmd.format(root=root_hex)
    proc = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, check=False
    )
    ts = datetime.now(timezone.utc).isoformat()

    if proc.returncode != 0:
        return {
            "root": root_hex,
            "ts": ts,
            "chain": "vm-spawn",
            "txid": "",
            "status": f"error:{proc.returncode}",
            "stderr": proc.stderr,
        }

    txid = proc.stdout.strip() or "unknown-txid"
    return {
        "root": root_hex,
        "ts": ts,
        "chain": "vm-spawn",
        "txid": txid,
        "status": "anchored",
        "stdout": proc.stdout.strip(),
    }


def write_anchor_files(data_dir: str, anchor: Dict) -> None:
    anchors_dir = os.path.join(data_dir, "anchors")
    os.makedirs(anchors_dir, exist_ok=True)

    ts_safe = anchor.get("ts", "").replace(":", "-")
    with open(os.path.join(anchors_dir, f"{ts_safe}.json"), "w", encoding="utf-8") as f:
        json.dump(anchor, f, indent=2)

    with open(os.path.join(data_dir, "ANCHOR.json"), "w", encoding="utf-8") as f:
        json.dump(anchor, f, indent=2)


def notify_portal(portal_url: str, anchor: Dict) -> None:
    url = portal_url.rstrip("/") + "/offsec/anchor"
    try:
        resp = requests.post(url, json=anchor, timeout=5)
        resp.raise_for_status()
    except Exception as exc:
        print(f"[root-watcher] Failed to notify portal-ext: {exc}")


def main() -> None:
    data_dir = env("OFFSEC_DATA_DIR", "./data")
    portal_url = env("OFFSEC_API_URL", "http://localhost:9115")
    poll_interval = int(env("OFFSEC_ROOT_POLL_INTERVAL", str(DEFAULT_POLL_INTERVAL)))
    anchor_mode = env("OFFSEC_ANCHOR_MODE", "vm-spawn")  # vm-spawn | dev-null
    spawn_cmd = env(
        "OFFSEC_ANCHOR_SPAWN_CMD",
        "vm-spawn anchor --root {root} --tag offsec-shield",
    )

    root_path = os.path.join(data_dir, "ROOT.txt")
    os.makedirs(data_dir, exist_ok=True)

    print(f"[root-watcher] OFFSEC_DATA_DIR={data_dir}")
    print(f"[root-watcher] Watching {root_path}")
    print(f"[root-watcher] Portal URL {portal_url}")
    print(f"[root-watcher] Anchor mode: {anchor_mode}")
    print(f"[root-watcher] Poll interval: {poll_interval}s")

    last_hash = None

    while True:
        root_hex = load_root(root_path)
        if root_hex:
            current_hash = hash_root(root_hex)
            if current_hash != last_hash:
                print(f"[root-watcher] New root detected: {root_hex}")
                last_hash = current_hash

                if anchor_mode == "vm-spawn":
                    anchor = anchor_vm_spawn(root_hex, spawn_cmd)
                else:
                    anchor = anchor_dev(root_hex)

                write_anchor_files(data_dir, anchor)
                notify_portal(portal_url, anchor)

        time.sleep(poll_interval)


if __name__ == "__main__":
    main()
