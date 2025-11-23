# Task: Python detector module for OffSec Guardian

Create a Python file `detectors/brute_force.py` implementing the following:
- Watches authentication log (e.g., `/var/log/auth.log`) for more than 10 failed login attempts by the same IP within 60 seconds.
- On detection, constructs an event object:
    {
      "agent_id": "<AGENT_ID>",
      "event_type": "guardian.block_ip",
      "payload": {
        "ip": "<offending_ip>",
        "fail_count": <int>,
        "window_seconds": 60
      },
      "ts": <ISO8601 timestamp>
    }
- Signs the event with the guardian’s capability token (you may assume `cap_client.sign_event(event)` exists).
- Sends the event via `client.post("/offsec/ingest", event_json)`.
- Use `watchdog` or `inotify_simple` for file monitoring.
- Include minimal logging and error handling.
- Write a unit test in `tests/test_brute_force.py` simulating 11 failed attempts and verifying `client.post` was called with correct payload.

Constraints:
- Use PEP8 style.
- Do not import modules outside standard library + `watchdog` + `requests`.
- The module must be idempotent and safe to run continuously (no memory leaks, no global state).

Output:
- Provide full file content for `detectors/brute_force.py`.
- Provide test file `tests/test_brute_force.py`.
