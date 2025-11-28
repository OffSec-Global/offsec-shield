import {
  ActionRequested,
  ActionResult,
  ActionUpdate,
  ThreatEvent,
  MeshProofReceived,
  MeshRootAnnounce,
  AnchorEvent,
} from '@/types/events';
import { Receipt } from '@/types/receipts';
import { OFFSEC_WS_URL } from '@/config/offsec';

export type OffsecMessage =
  | { type: 'threat_event'; data: ThreatEvent }
  | { type: 'action_update'; data: ActionUpdate }
  | { type: 'receipt'; data: Receipt }
  | { type: 'offsec.action.requested'; data: ActionRequested }
  | { type: 'offsec.action.result'; data: ActionResult }
  | { type: 'offsec.anchor'; data: AnchorEvent }
  | { type: 'mesh.root_announce'; data: MeshRootAnnounce }
  | { type: 'mesh.proof_received'; data: MeshProofReceived }
  | { type: string; data: unknown };

export function connectWebSocket(
  onMessage: (msg: OffsecMessage) => void,
  onOpen?: () => void,
  onClose?: () => void
) {
  let shouldReconnect = true;
  let socket: WebSocket | null = null;

  const connect = () => {
    socket = new WebSocket(OFFSEC_WS_URL);

    socket.onopen = () => {
      console.log('[offsec] ws open', OFFSEC_WS_URL);
      onOpen?.();
    };
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
