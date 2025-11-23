export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type OffsecAction =
  | 'block_ip'
  | 'alert_human'
  | 'quarantine'
  | 'isolate_host'
  | string;

export interface ThreatEvent {
  id: string;
  timestamp: string;
  severity: Severity;
  event_type: string;
  source: string;
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
}
