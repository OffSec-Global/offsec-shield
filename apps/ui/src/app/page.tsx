'use client';

import { useEffect, useState } from 'react';
import { connectWebSocket } from '@/lib/ws-client';
import { getCurrentRoot, getReceipts } from '@/lib/api';
import { ActionUpdate, ThreatEvent } from '@/types/events';
import { Receipt } from '@/types/receipts';
import { ShieldStatus } from '@/components/ShieldStatus';
import { ThreatStream } from '@/components/ThreatStream';
import { ActionPanel } from '@/components/ActionPanel';
import { ProofLedger } from '@/components/ProofLedger';

type AnchorEvent = {
  root: string;
  ts: string;
  chain: string;
  txid: string;
  status: string;
};

export default function Home() {
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [actions, setActions] = useState<ActionUpdate[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [lastAnchor, setLastAnchor] = useState<AnchorEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentRoot, setCurrentRoot] = useState<string>('');

  useEffect(() => {
    const connection = connectWebSocket(
      (msg) => {
        if (msg.type === 'threat_event') {
          setEvents((prev) => [msg.data as ThreatEvent, ...prev].slice(0, 50));
        }
        if (msg.type === 'capability_denied') {
          setEvents((prev) => [msg.data as ThreatEvent, ...prev].slice(0, 50));
        }
        if (msg.type === 'action_update') {
          setActions((prev) => {
            const others = prev.filter((a) => a.id !== (msg.data as ActionUpdate).id);
            return [msg.data as ActionUpdate, ...others].slice(0, 50);
          });
        }
        if (msg.type === 'receipt') {
          setReceipts((prev) => [msg.data as Receipt, ...prev].slice(0, 50));
        }
        if (msg.type === 'offsec.anchor') {
          const anchor = msg.data as AnchorEvent;
          setLastAnchor(anchor);
          if (anchor?.root) {
            setCurrentRoot(anchor.root);
          }
        }
      },
      () => setConnected(true),
      () => setConnected(false)
    );

    getReceipts()
      .then((data) => setReceipts(data))
      .catch(() => {});
    getCurrentRoot()
      .then((root) => setCurrentRoot(root))
      .catch(() => {});

    return () => connection.close();
  }, []);

  return (
    <div className="container">
      <ShieldStatus
        connected={connected}
        counts={{ events: events.length, actions: actions.length, receipts: receipts.length }}
      />
      <div className="grid">
        <ThreatStream events={events} />
        <ActionPanel actions={actions} />
        <ProofLedger receipts={receipts} lastAnchor={lastAnchor} currentRoot={currentRoot} />
      </div>
    </div>
  );
}
