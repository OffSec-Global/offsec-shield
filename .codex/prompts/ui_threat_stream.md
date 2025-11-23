# Task: React/Next.js component for OffSec Shield ThreatStream

Create a TypeScript React functional component `ThreatStream.tsx` inside `apps/ui/src/components/`.
Requirements:
- Connects via WebSocket to URL `${process.env.NEXT_PUBLIC_OFFSEC_WS}`.
- On message (JSON event):
    {
      "agent_id": string,
      "event_type": string,
      "payload": object,
      "ts": string,
      "hash": string
    }
- Display incoming events in a scroll list with newest at top.
- Use styling: background #0c0c0c, text #00ff45, font-family monospace.
- Each list item shows: timestamp, event_type, agent_id, hash (truncated to first 10 chars + “…”).
- Include a “Pause” button to toggle real-time updates.
- Provide minimal CSS module or styled-jsx for aesthetic.

Constraints:
- Use Next.js 14 app directory (file path as given).
- Use functional React hooks (useState, useEffect).
- Do not use external UI libraries (Material-UI etc).
- Keep code under 120 lines.

Output:
- Provide file content for `ThreatStream.tsx`.
