export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type OffsecAction =
  | 'block_ip'
  | 'alert_human'
  | 'quarantine'
  | 'isolate_host'
  | string;

export interface AnchorEvent {
  root: string;
  ts: string;
  chain?: string | null;
  txid?: string | null;
  status?: string | null;
}

export interface MeshRootAnnounce {
  from: string;
  root: string;
  ts: string;
  anchor?: AnchorEvent | null;
}

export interface MeshProofReceived {
  from: string;
  receiptId: string;
  eventType: string;
  root: string;
  ts: string;
}

export interface ThreatEvent {
  id: string;
  timestamp: string;
  severity: Severity;
  event_type: string;
  source: string;
  source_host?: string | null;
  source_role?: string | null;
  guardian_id?: string | null;
  guardian_tags?: string[];
  description: string;
  affected: string[];
  metadata?: Record<string, unknown>;
}

export interface ActionUpdate {
  id: string;
  action: OffsecAction;
  status: 'pending' | 'accepted' | 'executed' | 'failed' | string;
  created_at?: string;
  executed_at?: string;
  guardian_id?: string | null;
  guardian_tags?: string[];
}

export interface ActionRequested {
  action_id: string;
  action_type: string;
  target?: Record<string, unknown>;
  reason?: string;
  requested_by?: string;
  ts?: string;
  receipt_id?: string;
  guardian_id?: string | null;
  guardian_tags?: string[];
}

export type OffsecWsType =
  | 'threat_event'
  | 'action_update'
  | 'receipt'
  | 'offsec.action.requested'
  | 'offsec.action.result'
  | 'offsec.anchor'
  | 'mesh.root_announce'
  | 'mesh.proof_received';

export interface ActionResult {
  action_id: string;
  action_type: string;
  status: string;
  details?: Record<string, unknown>;
  ts?: string;
  receipt_id?: string;
  guardian_id?: string | null;
  guardian_tags?: string[];
}
