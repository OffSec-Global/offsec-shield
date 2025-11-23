import { ActionUpdate, ThreatEvent } from '@/types/events';
import { Receipt } from '@/types/receipts';

export type OffsecMessage =
  | { type: 'threat_event'; data: ThreatEvent }
  | { type: 'action_update'; data: ActionUpdate }
  | { type: 'receipt'; data: Receipt }
  | { type: string; data: unknown };

const API_URL = process.env.NEXT_PUBLIC_OFFSEC_API_URL || 'http://localhost:9115';
const WS_URL =
  process.env.NEXT_PUBLIC_OFFSEC_WS ||
  `${API_URL.replace(/^http/i, 'ws')}/offsec/ws`;

export function connectWebSocket(
  onMessage: (msg: OffsecMessage) => void,
  onOpen?: () => void,
  onClose?: () => void
) {
  let shouldReconnect = true;
  let socket: WebSocket | null = null;

  const connect = () => {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => onOpen?.();
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as OffsecMessage;
        onMessage(payload);
      } catch (err) {
        console.error('WS parse error', err);
      }
    };
    socket.onclose = () => {
      onClose?.();
      if (shouldReconnect) {
        setTimeout(connect, 1500);
      }
    };
    socket.onerror = (event) => {
      console.error('WS error:', event);
      socket?.close();
    };
  };

  connect();

  return {
    close() {
      shouldReconnect = false;
      socket?.close();
    }
  };
}
