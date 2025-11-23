# Task: Add `docs/EVENTS.md` entry for OffSec Shield receipts

Update `docs/EVENTS.md` to include the new receipt type `offsec.action.block_ip`. Provide:
- Name: offsec.action.block_ip
- Description: Emitted when Guardian blocks offending IP.
- JSON schema:
  {
    "receipt_id": string,
    "agent_id": string,
    "action_type": "block_ip",
    "target": {
      "ip": string
    },
    "ts": string,
    "merkle_root": string
  }
- Example:
  {
    "receipt_id":"r-12345",
    "agent_id":"guardian-001",
    "action_type":"block_ip",
    "target":{"ip":"192.168.1.100"},
    "ts":"2025-11-23T12:34:56Z",
    "merkle_root":"abcd1234..."
  }
- After schema, list fields: type, description, required/optional.
- Provide checklist: “Must be hashed with BLAKE3”, “Included in Receipts directory”, “signed by Portal key”.

Constraints:
- Format in Markdown, with headings, code blocks, bullet lists.
- Do not modify any other existing section in `EVENTS.md`.

Output:
- Provide the updated section content to append to `docs/EVENTS.md`.
