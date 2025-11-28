// apps/ui/src/config/offsec.ts
// Single source of truth for OffSec Shield API endpoints

const httpBase =
  process.env.NEXT_PUBLIC_OFFSEC_HTTP_URL ?? "http://localhost:9115/offsec";

const wsBase =
  process.env.NEXT_PUBLIC_OFFSEC_WS_URL ?? "ws://localhost:9115/offsec/ws";

// Normalized HTTP base (no trailing slash)
export const OFFSEC_HTTP_BASE = httpBase.replace(/\/$/, "");

// Full WS URL as-is
export const OFFSEC_WS_URL = wsBase;
