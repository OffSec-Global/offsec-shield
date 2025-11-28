import { ActionUpdate } from '@/types/events';
import { Receipt } from '@/types/receipts';
import { OFFSEC_HTTP_BASE } from '@/config/offsec';

const ACTION_TOKEN = process.env.NEXT_PUBLIC_OFFSEC_ACTION_TOKEN;

export async function submitAction(action: ActionUpdate) {
  const response = await fetch(`${OFFSEC_HTTP_BASE}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action)
  });
  if (!response.ok) throw new Error('Failed to submit action');
  return response.json();
}

export async function getReceipts(guardianId?: string): Promise<Receipt[]> {
  const url = guardianId
    ? `${OFFSEC_HTTP_BASE}/receipts?guardian_id=${encodeURIComponent(guardianId)}`
    : `${OFFSEC_HTTP_BASE}/receipts`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch receipts');
  return response.json();
}

type ActionTarget = {
  ip?: string;
};

export type ActionRequestPayload = {
  action_id: string;
  action_type: string;
  target: ActionTarget;
  reason?: string;
  requested_by?: string;
  ts: string;
  guardian_id?: string;
  guardian_tags?: string[];
};

export async function applyAction(payload: ActionRequestPayload) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ACTION_TOKEN) {
    headers.Authorization = `Bearer ${ACTION_TOKEN}`;
  }
  const res = await fetch(`${OFFSEC_HTTP_BASE}/action/apply`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to apply action: ${res.status}`);
  }
  return res.json();
}

export async function getCurrentRoot(): Promise<string> {
  const response = await fetch(`${OFFSEC_HTTP_BASE}/root`);
  if (!response.ok) throw new Error('Failed to fetch root');
  const data = await response.json();
  return data.root || '';
}
