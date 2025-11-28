#!/usr/bin/env python3
"""
OffSec Shield Event Ingestion Demo

This script demonstrates posting a security event to Portal-Ext with capability-based auth.

Features:
- Generates an Ed25519 keypair on-the-fly (or uses env vars if provided).
- Mints a signed capability token.
- POSTs a sample event to /api/offsec/events.
- Prints the verifying key hex for adding to trusted_issuers.json.

Usage:
  # Auto-generate keypair and post event
  python3 integration/offsec_event_demo.py

  # Use existing signing key
  export OFFSEC_SIGNING_KEY_HEX=<hex>
  python3 integration/offsec_event_demo.py

  # Use pre-minted capability token
  export OFFSEC_CAPABILITY_B64=<base64>
  python3 integration/offsec_event_demo.py

Requirements:
  pip install requests pynacl
"""

import os
import sys
import json
import time
import base64
import requests
from nacl.signing import SigningKey


def generate_keypair():
    """Generate a new Ed25519 keypair."""
    sk = SigningKey.generate()
    return sk, sk.verify_key


def load_signing_key_from_env():
    """Load signing key from OFFSEC_SIGNING_KEY_HEX env var."""
    sk_hex = os.getenv("OFFSEC_SIGNING_KEY_HEX")
    if not sk_hex:
        return None
    try:
        sk = SigningKey(bytes.fromhex(sk_hex))
        return sk, sk.verify_key
    except Exception as e:
        print(f"❌ Failed to load signing key from env: {e}", file=sys.stderr)
        sys.exit(1)


def mint_capability(signing_key, issuer_did="did:vm:node:sovereign", exp_secs=3600):
    """
    Mint a signed capability token.
    
    Returns:
        str: Base64-encoded capability token.
    """
    now = int(time.time())
    capability = {
        "iss": issuer_did,
        "sub": "did:vm:node:guardian",
        "aud": "offsec-shield",
        "exp": now + exp_secs,
        "iat": now,
        "scopes": ["infrastructure:write"]
    }
    
    # Canonical JSON (deterministic)
    canonical = json.dumps(capability, separators=(',', ':'), sort_keys=True)
    
    # Sign
    signed = signing_key.sign(canonical.encode('utf-8'))
    
    # Build token
    token = {
        "payload": capability,
        "signature": base64.b64encode(signed.signature).decode('ascii')
    }
    
    # Encode to base64
    token_b64 = base64.b64encode(json.dumps(token).encode('utf-8')).decode('ascii')
    return token_b64


def post_event(url, capability_b64, event):
    """
    POST a security event to Portal-Ext with capability auth.
    
    Args:
        url: Portal-Ext URL (e.g., http://localhost:9115)
        capability_b64: Base64-encoded capability token
        event: Event payload (dict)
    
    Returns:
        requests.Response
    """
    endpoint = f"{url}/api/offsec/events"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {capability_b64}"
    }
    
    resp = requests.post(endpoint, json=event, headers=headers)
    return resp


def main():
    print("🛡️  OffSec Shield Event Ingestion Demo\n")
    
    # Configuration
    portal_url = os.getenv("OFFSEC_SHIELD_URL", "http://localhost:9115")
    issuer_did = os.getenv("OFFSEC_ISSUER_DID", "did:vm:node:sovereign")
    
    # Step 1: Get or generate capability token
    capability_b64 = os.getenv("OFFSEC_CAPABILITY_B64")
    
    if capability_b64:
        print("✅ Using pre-minted capability token from OFFSEC_CAPABILITY_B64\n")
    else:
        print("🔑 Generating capability token...\n")
        
        # Load or generate signing key
        keypair = load_signing_key_from_env()
        if keypair:
            signing_key, verifying_key = keypair
            print(f"✅ Loaded signing key from OFFSEC_SIGNING_KEY_HEX")
        else:
            signing_key, verifying_key = generate_keypair()
            print(f"✅ Generated new Ed25519 keypair")
            print(f"   Signing Key (hex):   {signing_key.encode().hex()}")
        
        print(f"   Verifying Key (hex): {verifying_key.encode().hex()}")
        print(f"\n💡 Add this to trusted_issuers.json:")
        print(f'   {{ "{issuer_did}": "{verifying_key.encode().hex()}" }}\n')
        
        # Mint capability
        capability_b64 = mint_capability(signing_key, issuer_did=issuer_did, exp_secs=3600)
        print(f"✅ Minted capability token (expires in 3600s)\n")
    
    # Step 2: Build sample event
    incident_id = f"incident-demo-{int(time.time())}"
    event = {
        "incident_id": incident_id,
        "severity": "high",
        "source": "guardian-demo",
        "msg": "SSH brute-force detected from 203.0.113.42 (5 failed attempts in 60s)",
        "metadata": {
            "attacker_ip": "203.0.113.42",
            "target_service": "sshd",
            "failed_attempts": 5,
            "timespan_secs": 60,
            "detector": "brute_force_detector"
        }
    }
    
    print(f"📦 Event payload:")
    print(f"   Incident ID: {incident_id}")
    print(f"   Severity:    {event['severity']}")
    print(f"   Source:      {event['source']}")
    print(f"   Message:     {event['msg']}\n")
    
    # Step 3: POST event
    print(f"🚀 Posting event to {portal_url}/api/offsec/events...")
    
    try:
        resp = post_event(portal_url, capability_b64, event)
        
        if resp.status_code == 200:
            print(f"✅ Event ingested successfully!\n")
            result = resp.json()
            print(f"📋 Response:")
            print(f"   Incident ID: {result.get('incident_id', 'N/A')}")
            print(f"   Receipt:     {result.get('receipt', 'N/A')}")
            print(f"   Timestamp:   {result.get('timestamp', 'N/A')}")
            
            # Print verification command
            print(f"\n🔍 Verify receipt:")
            print(f"   curl http://localhost:9115/api/offsec/incidents/{incident_id} | jq .")
            print(f"\n💾 Check receipts on disk:")
            print(f"   ls -la $OFFSEC_DATA_DIR/receipts/infrastructure/")
            
        elif resp.status_code == 401:
            print(f"❌ Authentication failed (401 Unauthorized)")
            print(f"\n💡 Troubleshooting:")
            print(f"   1. Ensure trusted_issuers.json contains your verifying key")
            print(f"   2. Restart portal-ext after updating trusted_issuers.json")
            print(f"   3. Check token expiration (current time: {int(time.time())})")
            print(f"\nResponse: {resp.text}")
            sys.exit(1)
            
        else:
            print(f"❌ Request failed: {resp.status_code}")
            print(f"Response: {resp.text}")
            sys.exit(1)
            
    except requests.exceptions.ConnectionError:
        print(f"❌ Connection failed. Is portal-ext running on {portal_url}?")
        print(f"\n💡 Start portal-ext:")
        print(f"   cd apps/portal-ext")
        print(f"   export OFFSEC_DATA_DIR=../../data-offsec")
        print(f"   cargo run")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)
    
    print("\n✨ Demo complete!")


if __name__ == "__main__":
    main()
