#!/usr/bin/env python3
"""
Make a signed capability JSON and print base64(JSON).

Usage:
  python3 tools/make_capability.py --issuer did:vm:node:sovereign \
    --sk <hex_private_key> --scopes infrastructure:write offsec:write --exp-secs 3600

Requires: pip install pynacl
"""

import argparse
import base64
import json
import time

from nacl.encoding import HexEncoder
from nacl.signing import SigningKey


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--issuer", required=True, help="Issuer DID (must be in trusted_issuers.json)")
    parser.add_argument("--sub", default="offsec-guardian", help="Subject of the capability")
    parser.add_argument("--scopes", nargs="+", required=True, help="Scopes, e.g. infrastructure:write")
    parser.add_argument("--sk", required=True, help="Ed25519 private key hex (64 hex chars)")
    parser.add_argument("--exp-secs", type=int, default=3600, help="Expiration in seconds from now")
    args = parser.parse_args()

    now = int(time.time())
    exp = now + args.exp_secs

    cap_unsigned = {
        "sub": args.sub,
        "scopes": args.scopes,
        "constraints": {},
        "issued_by": args.issuer,
        "exp": exp,
    }

    # Canonicalize unsigned body for signing
    unsigned_bytes = json.dumps(cap_unsigned, separators=(",", ":"), sort_keys=True).encode("utf-8")

    sk = SigningKey(bytes.fromhex(args.sk), encoder=HexEncoder)
    sig = sk.sign(unsigned_bytes).signature
    cap = dict(cap_unsigned)
    cap["signature"] = sig.hex()

    cap_json = json.dumps(cap, separators=(",", ":"), sort_keys=True).encode("utf-8")
    token_b64 = base64.b64encode(cap_json).decode("ascii")

    print(token_b64)
    print()
    print("=== capability JSON ===")
    print(json.dumps(cap, indent=2))
    print()
    print("Public (verifying) key hex:", sk.verify_key.encode(encoder=HexEncoder).decode("ascii"))


if __name__ == "__main__":
    main()
