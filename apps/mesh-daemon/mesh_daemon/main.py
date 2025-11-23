import base64
import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import blake3
import requests
from nacl.signing import SigningKey


@dataclass
class MeshPeer:
    id: str
    url: str
    pubkey: str  # base64-encoded Ed25519 public key (for visibility; not used by daemon)


@dataclass
class MeshConfig:
    node_id: str
    privkey_file: str
    peers: List[MeshPeer]
    api_url: str
    data_dir: str
    interval_seconds: int = 60
    receipts_limit: int = 10


def _env(name: str, default: Optional[str] = None) -> str:
    val = os.environ.get(name, default)
    if val is None:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


def load_config() -> MeshConfig:
    """
    Mesh daemon config is env-driven for v0.1.

    Required:
      OFFSEC_MESH_NODE_ID
      OFFSEC_MESH_PRIVKEY_FILE
      OFFSEC_MESH_PEERS   # JSON array of {id,url,pubkey}

    Optional:
      OFFSEC_API_URL               (default: http://localhost:9115)
      OFFSEC_DATA_DIR              (default: ./data)
      OFFSEC_MESH_INTERVAL_SECONDS (default: 60)
      OFFSEC_MESH_RECEIPTS_LIMIT   (default: 10)
    """
    node_id = _env("OFFSEC_MESH_NODE_ID")
    privkey_file = _env("OFFSEC_MESH_PRIVKEY_FILE")
    peers_json = _env("OFFSEC_MESH_PEERS", "[]")

    try:
        raw_peers = json.loads(peers_json)
    except Exception as e:
        raise RuntimeError(f"OFFSEC_MESH_PEERS is not valid JSON: {e}") from e

    peers: List[MeshPeer] = []
    for p in raw_peers:
        peers.append(
            MeshPeer(
                id=p["id"],
                url=p["url"].rstrip("/"),
                pubkey=p.get("pubkey", ""),
            )
        )

    api_url = os.environ.get("OFFSEC_API_URL", "http://localhost:9115").rstrip("/")
    data_dir = os.environ.get("OFFSEC_DATA_DIR", "./data")
    interval = int(os.environ.get("OFFSEC_MESH_INTERVAL_SECONDS", "60"))
    receipts_limit = int(os.environ.get("OFFSEC_MESH_RECEIPTS_LIMIT", "10"))

    return MeshConfig(
        node_id=node_id,
        privkey_file=privkey_file,
        peers=peers,
        api_url=api_url,
        data_dir=data_dir,
        interval_seconds=interval,
        receipts_limit=receipts_limit,
    )


def load_signing_key(path: str) -> SigningKey:
    with open(path, "rb") as f:
        sk_bytes = f.read()
    # Expect raw 32-byte Ed25519 seed/private key
    if len(sk_bytes) != 32:
        raise RuntimeError(f"Expected 32-byte Ed25519 key in {path}, got {len(sk_bytes)} bytes")
    return SigningKey(sk_bytes)


def canonical_json(value: Any) -> bytes:
    """Canonical JSON encoding that matches the Rust side: sorted keys, no extra spaces."""
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sign_payload(sk: SigningKey, payload: Dict[str, Any]) -> str:
    """
    Compute BLAKE3(canonical_json(payload)) and sign with Ed25519, returning base64 signature.
    """
    payload_bytes = canonical_json(payload)
    h = blake3.blake3(payload_bytes).digest()
    sig = sk.sign(h).signature
    return base64.b64encode(sig).decode("ascii")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_root_and_anchor(cfg: MeshConfig) -> Optional[Dict[str, Any]]:
    root_path = os.path.join(cfg.data_dir, "ROOT.txt")
    try:
        with open(root_path, "r", encoding="utf-8") as f:
            root = f.read().strip()
    except FileNotFoundError:
        return None

    anchor_path = os.path.join(cfg.data_dir, "ANCHOR.json")
    anchor = None
    if os.path.exists(anchor_path):
        try:
            with open(anchor_path, "r", encoding="utf-8") as f:
                anchor = json.load(f)
        except Exception:
            anchor = None

    return {"root": root, "anchor": anchor}


def build_root_announce_payload(root: str, anchor: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "root": root,
        "ts": now_iso(),
        "anchor": anchor,
    }


def envelope(kind: str, node_id: str, payload: Dict[str, Any], sig_b64: str) -> Dict[str, Any]:
    return {
        "node_id": node_id,
        "ts": now_iso(),
        "kind": kind,
        "payload": payload,
        "sig": sig_b64,
    }


def post_json(url: str, body: Dict[str, Any]) -> None:
    try:
        resp = requests.post(url, json=body, timeout=5)
        if resp.status_code >= 400:
            print(f"[mesh] POST {url} failed: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"[mesh] POST {url} error: {e}")


def announce_root(cfg: MeshConfig, sk: SigningKey) -> None:
    info = read_root_and_anchor(cfg)
    if not info:
        print("[mesh] ROOT.txt not found yet; skipping root_announce")
        return

    payload = build_root_announce_payload(info["root"], info["anchor"])
    sig = sign_payload(sk, payload)
    env = envelope("root_announce", cfg.node_id, payload, sig)

    for peer in cfg.peers:
        url = f"{peer.url}/offsec/mesh/root"
        print(f"[mesh] announcing root to {peer.id} at {url}")
        post_json(url, env)


def fetch_recent_receipts(cfg: MeshConfig) -> List[Dict[str, Any]]:
    try:
        resp = requests.get(
            f"{cfg.api_url}/offsec/receipts",
            params={"limit": cfg.receipts_limit},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            return data
        return []
    except Exception as e:
        print(f"[mesh] failed to fetch receipts: {e}")
        return []


def fetch_proof_bundle(cfg: MeshConfig, receipt_id: str) -> Optional[Dict[str, Any]]:
    try:
        resp = requests.get(f"{cfg.api_url}/offsec/proof/{receipt_id}", timeout=5)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[mesh] failed to fetch proof bundle for {receipt_id}: {e}")
        return None


def push_recent_proofs(cfg: MeshConfig, sk: SigningKey) -> None:
    receipts = fetch_recent_receipts(cfg)
    if not receipts:
        print("[mesh] no receipts to push")
        return

    for r in receipts:
        receipt_id = r.get("id") or r.get("receipt_id")
        if not receipt_id:
            continue

        bundle = fetch_proof_bundle(cfg, receipt_id)
        if not bundle:
            continue

        # Add mesh metadata
        bundle.setdefault("source_node", cfg.node_id)
        bundle.setdefault("realm", "default")

        sig = sign_payload(sk, bundle)
        env = envelope("proof_bundle", cfg.node_id, bundle, sig)

        for peer in cfg.peers:
            url = f"{peer.url}/offsec/mesh/proof"
            print(f"[mesh] pushing proof {receipt_id} to {peer.id} at {url}")
            post_json(url, env)


def main_loop(cfg: MeshConfig, sk: SigningKey) -> None:
    print(
        f"[mesh] starting mesh-daemon for node {cfg.node_id} "
        f"→ peers: {[p.id for p in cfg.peers]}, interval={cfg.interval_seconds}s"
    )
    while True:
        try:
            announce_root(cfg, sk)
            push_recent_proofs(cfg, sk)
        except Exception as e:
            print(f"[mesh] error in loop: {e}")
        time.sleep(cfg.interval_seconds)


def main() -> None:
    cfg = load_config()
    sk = load_signing_key(cfg.privkey_file)
    main_loop(cfg, sk)


if __name__ == "__main__":
    main()
