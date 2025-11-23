import { ActionUpdate } from '@/types/events';
import { Receipt } from '@/types/receipts';

const API_URL = process.env.NEXT_PUBLIC_OFFSEC_API_URL || 'http://localhost:9115';

export async function submitAction(action: ActionUpdate) {
  const response = await fetch(`${API_URL}/offsec/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action)
  });
  if (!response.ok) throw new Error('Failed to submit action');
  return response.json();
}

export async function getReceipts(): Promise<Receipt[]> {
  const response = await fetch(`${API_URL}/offsec/receipts`);
  if (!response.ok) throw new Error('Failed to fetch receipts');
  return response.json();
}

export async function getCurrentRoot(): Promise<string> {
  const response = await fetch(`${API_URL}/offsec/root`);
  if (!response.ok) throw new Error('Failed to fetch root');
  const data = await response.json();
  return data.root || '';
}
