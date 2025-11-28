# OffSec Shield Portal-Ext — Operations Guide

This guide describes how to provision trusted issuers, generate capability tokens, and deploy Portal-Ext in production.

---

## Overview

Portal-Ext uses **capability-based authentication** for event ingestion. Events posted to `/api/offsec/events` must include an `Authorization: Bearer <base64-capability>` header. The capability is a signed JSON document validated against a list of trusted issuer verifying keys.

---

## 1. Key Provisioning (Production)

### Trusted Issuers

Portal-Ext reads `$OFFSEC_DATA_DIR/trusted_issuers.json` on startup. This file maps DIDs to Ed25519 verifying keys (hex-encoded).

**Example:**

```json
{
  "did:vm:node:sovereign": "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"
}
```

**Production workflow:**

1. **Generate a signing key** using a hardware security module (HSM) or secret manager:
   - AWS KMS, GCP Cloud KMS, or HashiCorp Vault with Ed25519 support.
   - Alternatively, use `nacl.signing.SigningKey.generate()` and store securely.

2. **Export the verifying key** (public key) and add to `trusted_issuers.json`:
   ```bash
   python3 - <<'PY'
   from nacl.signing import SigningKey
   sk = SigningKey.generate()
   print("Verifying Key (hex):", sk.verify_key.encode().hex())
   print("Signing Key (hex, KEEP SECRET):", sk.encode().hex())
   PY
   ```

3. **Deploy `trusted_issuers.json`** to `$OFFSEC_DATA_DIR/trusted_issuers.json` on the server:
   ```bash
   export OFFSEC_DATA_DIR=/var/lib/offsec-shield
   mkdir -p "$OFFSEC_DATA_DIR"
   cat > "$OFFSEC_DATA_DIR/trusted_issuers.json" <<EOF
   { "did:vm:node:sovereign": "<VERIFYING_KEY_HEX>" }
   EOF
   chmod 600 "$OFFSEC_DATA_DIR/trusted_issuers.json"
   ```

4. **Store the signing key securely** (do NOT commit to repo):
   - Use secret manager or encrypted vault.
   - Rotate keys periodically (e.g., every 90 days).

---

## 2. Generating Capability Tokens

### Using `tools/make_capability.py`

The repo includes a helper script to mint capability tokens for local dev and testing:

```bash
python3 tools/make_capability.py \
  --issuer did:vm:node:sovereign \
  --sk <SIGNING_KEY_HEX> \
  --scopes infrastructure:write \
  --exp-secs 3600
```

**Output:** A base64-encoded capability token printed to stdout.

### Manual (Python)

```python
import json, time, base64
from nacl.signing import SigningKey

# Load signing key (hex)
sk_hex = "YOUR_SECRET_KEY_HEX"
sk = SigningKey(bytes.fromhex(sk_hex))

# Build capability
cap = {
    "iss": "did:vm:node:sovereign",
    "sub": "did:vm:node:guardian",
    "aud": "offsec-shield",
    "exp": int(time.time()) + 3600,
    "iat": int(time.time()),
    "scopes": ["infrastructure:write"]
}

# Sign (canonical JSON)
canonical = json.dumps(cap, separators=(',', ':'), sort_keys=True)
signed = sk.sign(canonical.encode('utf-8'))

# Build token
token = {
    "payload": cap,
    "signature": base64.b64encode(signed.signature).decode('ascii')
}

# Encode to base64
token_b64 = base64.b64encode(json.dumps(token).encode('utf-8')).decode('ascii')
print("OFFSEC_CAPABILITY_B64=", token_b64)
```

---

## 3. Deployment Checklist

### Pre-deployment

- [ ] Generate production Ed25519 keypair (HSM or secure workstation).
- [ ] Add verifying key to `trusted_issuers.json`.
- [ ] Securely store signing key (secret manager, encrypted vault).
- [ ] Confirm `$OFFSEC_DATA_DIR` is provisioned on target host.
- [ ] Confirm `.gitignore` excludes `data-offsec/*` and `*.pem`, `*.key`.

### Post-deployment

- [ ] Verify `trusted_issuers.json` is readable by Portal-Ext process.
- [ ] Test capability validation:
   ```bash
   curl -X POST http://localhost:9115/api/offsec/events \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <TOKEN_B64>" \
     -d '{"incident_id": "test-001", "severity": "high", "source": "guardian", "msg": "test"}'
   ```
- [ ] Confirm receipts are written to `$OFFSEC_DATA_DIR/receipts/infrastructure/`.
- [ ] Confirm proofs are generated (if policy triggers).
- [ ] Monitor logs for capability validation errors.

---

## 4. Key Rotation

When rotating keys:

1. Generate new keypair.
2. Add new verifying key to `trusted_issuers.json` (keep old key temporarily).
3. Deploy updated `trusted_issuers.json`.
4. Restart Portal-Ext.
5. Issue new capability tokens using new signing key.
6. After grace period (e.g., 24 hours), remove old verifying key from `trusted_issuers.json`.

---

## 5. Security Notes

- **Do not commit signing keys** to the repository.
- **Use short-lived tokens** (e.g., 1-24 hours) for production workloads.
- **Audit capability usage**: Portal-Ext logs the issuer DID for each validated token.
- **Rotate keys regularly** (quarterly recommended).
- **Consider HSM/KMS** for production signing key storage.

---

## 6. Troubleshooting

### Symptom: `401 Unauthorized` on POST to `/api/offsec/events`

**Cause:** Capability validation failed.

**Checks:**
1. Confirm `Authorization: Bearer <token>` header is present.
2. Decode token (base64) and inspect `iss`, `exp`, `signature`.
3. Confirm issuer DID is in `trusted_issuers.json`.
4. Confirm token is not expired (`exp` > current time).
5. Check Portal-Ext logs for validation error details.

### Symptom: `trusted_issuers.json: No such file or directory`

**Cause:** `OFFSEC_DATA_DIR` not set or file missing.

**Fix:**
```bash
export OFFSEC_DATA_DIR=/var/lib/offsec-shield
mkdir -p "$OFFSEC_DATA_DIR"
echo '{}' > "$OFFSEC_DATA_DIR/trusted_issuers.json"
```

---

## 7. Integration with Guardian

Guardian instances should be provisioned with:
- `OFFSEC_SHIELD_URL=https://portal-ext.example.com`
- `OFFSEC_CAPABILITY_B64=<token>` (fetched from secret manager at startup)

Example (Python):
```python
import os, requests

url = os.getenv("OFFSEC_SHIELD_URL") + "/api/offsec/events"
token = os.getenv("OFFSEC_CAPABILITY_B64")

resp = requests.post(url, json={...}, headers={"Authorization": f"Bearer {token}"})
```

---

## 8. Future Enhancements

- Add capability scopes enforcement (currently validated but not enforced by endpoint).
- Add DID resolution for federated trust (did:web, did:key).
- Add capability delegation (sub-capabilities issued by trusted nodes).
- Add metrics for capability validation (success/failure rates).

---

For questions, contact: ops@vaultsovereign.dev
