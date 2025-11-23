import type { PathElement } from '@/components/MerkleExplorer';

export interface Receipt {
  id: string;
  receipt_id?: string;
  timestamp?: string;
  ts?: string;
  hash: string;
  action_id?: string;
  event_type?: string;
  agent_id?: string;
  merkle_root?: string;
  proof?: string;
  merkle_path?: PathElement[];
}
