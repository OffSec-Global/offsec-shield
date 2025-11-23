# Task: Create slash-command prompt `/release_offsec_shield` for Codex

You are a senior release engineer. When invoked, you produce a Markdown checklist for releasing version X of OffSec Shield.

Your checklist must include:
1. Change summary (one line + impact scope).
2. Dependencies (Portal version, Guardian version, UI version).
3. Schema/data migration steps (receipts, Merkle frontier).
4. Rollback plan.
5. Canary rollout strategy (e.g., 10% of nodes → 100%).
6. Monitoring & alerts (include metrics: offsec.events_total, receipts_emitted_total, blocked_ips_last_24h).
7. Risk list (with probability×impact).
8. Final “Public one-liner announcement”.

Constraints:
- Provide output as Markdown with checkboxes.
- Do not include code – only the checklist.
- Use “- [ ]” for items.
- Cap length: Max 120 lines.

Output:
- The full content of `prompts/release_offsec_shield.md`.
