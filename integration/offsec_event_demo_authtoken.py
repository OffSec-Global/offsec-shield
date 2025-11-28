#!/usr/bin/env python3
"""
Demo: mint a capability, base64 it, and POST an InfrastructureEvent
to Portal-Ext's /api/offsec/events with Authorization: Bearer <token>.

Usage:
  # generate a fresh key, mint and send demo event
  python3 integration/offsec_event_demo_authtoken.py

  # or provide an existing SK hex:
  OFFSEC_SK_HEX=<hex_private_key> python3 integration/offsec_event_demo_authtoken.py

Requires:
  pip install requests pynacl
"""
# NOTE:
# Run this script with the project virtualenv to ensure pynacl is available:
#     .venv/bin/python integration/offsec_event_demo_authtoken.py
#
# Running with system Python may produce ModuleNotFoundError: nacl
# during key generation. This is harmless but noisy.

import os
import sys
import json
import base64
from datetime import datetime, timezone, timedelta

import requests
from nacl.signing import SigningKey
from nacl.encoding import HexEncoder

OFFSEC_API = os.environ.get("OFFSEC_API", "http://localhost:9115/api/offsec/events")
SK_HEX = os.environ.get("OFFSEC_SK_HEX")  # optional: provide your own private key hex
ISSUER = os.environ.get("OFFSEC_ISSUER", "did:vm:node:sovereign")
SUB = os.environ.get("OFFSEC_SUB", "sovereign")
SCOPES = os.environ.get("OFFSEC_SCOPES", "infrastructure:write").split(",")
EXP_SECS = int(os.environ.get("OFFSEC_EXP_SECS", "3600"))


def make_keypair(sk_hex: str = None):
    if sk_hex:
        try:
            sk = SigningKey(bytes.fromhex(sk_hex))
            vk = sk.verify_key
            return sk, vk
        except Exception as e:
            print("Failed to import SK_HEX:", e)
            sys.exit(1)
    sk = SigningKey.generate()
    vk = sk.verify_key
    return sk, vk


def make_capability(sk: SigningKey, vk, issuer: str, sub: str, scopes, exp_secs: int):
    # expiration as RFC3339 / ISO8601 with Z (Chrono serializes UTC to Z)
    exp_dt = datetime.now(timezone.utc) + timedelta(seconds=exp_secs)
    exp_iso = exp_dt.isoformat().replace("+00:00", "Z")

    # Build canonical unsigned object in the exact key order:
    unsigned_obj = {
        "sub": sub,
        "scopes": scopes,
        "constraints": {},           # empty by default; can be extended
        "issued_by": issuer,
        "exp": exp_iso
    }

    # Canonical bytes: separators=(",", ":") and no extra whitespace
    unsigned_bytes = json.dumps(
        unsigned_obj, separators=(",", ":"), ensure_ascii=False, sort_keys=True
    ).encode("utf-8")

    # Sign
    sig = sk.sign(unsigned_bytes).signature  # bytes
    sig_hex = sig.hex()

    # Final capability JSON (includes signature)
    cap = {
        "sub": unsigned_obj["sub"],
        "scopes": unsigned_obj["scopes"],
        "constraints": unsigned_obj["constraints"],
        "issued_by": unsigned_obj["issued_by"],
        "exp": unsigned_obj["exp"],
        "signature": sig_hex
    }

    # base64-encode the capability JSON bytes (canonical formatting)
    cap_bytes = json.dumps(
        cap, separators=(",", ":"), ensure_ascii=False, sort_keys=True
    ).encode("utf-8")
    cap_b64 = base64.b64encode(cap_bytes).decode("ascii")

    # Verifying key hex for provisioning to trusted_issuers.json
    vk_hex = vk.encode(encoder=HexEncoder).decode("ascii")
    return cap_b64, cap, vk_hex


def create_ssh_event():
    # This shape matches the infra schema the portal expects.
    event = {
        "event_type": "security.threat.detected",
        "severity": "critical",
        "ref_id": None,
        "data": {
            "threat_type": "ssh.bruteforce",
            "ssh_failures": 42,
            "host": "bastion-01.prod",
            "source_ip": "203.0.113.42",
            "target_user": "root",
            "duration_minutes": 15,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "indicators": [
                "failed_logins:42",
                "source_ip:203.0.113.42",
                "target_user:root",
                "duration:15m"
            ]
        }
    }
    return event


def send_event_with_token(event: dict, token_b64: str):
    headers = {
        "Authorization": f"Bearer {token_b64}",
        "Content-Type": "application/json"
    }
    try:
        resp = requests.post(OFFSEC_API, headers=headers, json=event, timeout=10)
    except Exception as e:
        print("HTTP error:", e)
        sys.exit(1)

    print("POST", OFFSEC_API)
    print("Status:", resp.status_code)
    try:
        print(json.dumps(resp.json(), indent=2))
    except Exception:
        print(resp.text)


def main():
    sk, vk = make_keypair(SK_HEX)
    cap_b64, cap_json, vk_hex = make_capability(sk, vk, ISSUER, SUB, SCOPES, EXP_SECS)
    print("==== Capability Token (base64) ====")
    print(cap_b64)
    print()
    print("==== Capability JSON ====")
    print(json.dumps(cap_json, indent=2))
    print()
    print("==== Verifying key hex (provision to OFFSEC_DATA_DIR/trusted_issuers.json) ====")
    print(f'"{ISSUER}": "{vk_hex}"')
    print()

    # convenience: if OFFSEC_TRUSTED_ISSUERS is not set, warn operator
    offsec_data_dir = os.environ.get("OFFSEC_DATA_DIR", "./data-offsec")
    trusted_path = os.path.join(offsec_data_dir, "trusted_issuers.json")
    if not os.path.exists(trusted_path):
        print(f"Note: {trusted_path} does not exist. Create it and add the line above to trust this issuer.")
        print()

    # send the demo event
    event = create_ssh_event()
    send_event_with_token(event, cap_b64)


if __name__ == "__main__":
    main()
