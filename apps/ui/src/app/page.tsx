'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { connectWebSocket } from '@/lib/ws-client';
import { getCurrentRoot, getReceipts } from '@/lib/api';
import {
  ActionRequested,
  ActionResult,
  ActionUpdate,
  AnchorEvent,
  MeshProofReceived,
  MeshRootAnnounce,
  ThreatEvent,
} from '@/types/events';
import { Receipt } from '@/types/receipts';
import { ShieldStatus } from '@/components/ShieldStatus';
import { ThreatStream } from '@/components/ThreatStream';
import { ActionPanel } from '@/components/ActionPanel';
import { ProofLedger } from '@/components/ProofLedger';
import { GuardianFilter } from '@/components/GuardianFilter';
import { MeshPanel } from '@/components/MeshPanel';

export default function Home() {
  const [events, setEvents] = useState<ThreatEvent[]>([]);
  const [actions, setActions] = useState<ActionUpdate[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [lastAnchor, setLastAnchor] = useState<AnchorEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentRoot, setCurrentRoot] = useState<string>('');
  const [selectedGuardian, setSelectedGuardian] = useState<string | 'all'>('all');
  const [meshRoots, setMeshRoots] = useState<MeshRootAnnounce[]>([]);
  const [meshProofs, setMeshProofs] = useState<MeshProofReceived[]>([]);

  const guardianIds = useMemo(() => {
    const ids = new Set<string>();
    events.forEach((e) => {
      if (e.guardian_id) ids.add(e.guardian_id);
    });
    actions.forEach((a) => {
      if (a.guardian_id) ids.add(a.guardian_id);
    });
    receipts.forEach((r) => {
      if (r.guardian_id) ids.add(r.guardian_id);
      else if (r.agent_id) ids.add(r.agent_id);
    });
    return Array.from(ids).sort();
  }, [events, actions, receipts]);

  const matchesGuardian = useCallback(
    (gid?: string | null) => selectedGuardian === 'all' || (!!gid && gid === selectedGuardian),
    [selectedGuardian]
  );

  const eventMatchesGuardian = useCallback(
    (event: ThreatEvent) =>
      selectedGuardian === 'all' ||
      event.guardian_id === selectedGuardian ||
      (event.affected && event.affected.includes(selectedGuardian)),
    [selectedGuardian]
  );

  const filteredEvents = useMemo(
    () => (selectedGuardian === 'all' ? events : events.filter(eventMatchesGuardian)),
    [events, eventMatchesGuardian, selectedGuardian]
  );
  const filteredActions = useMemo(
    () => (selectedGuardian === 'all' ? actions : actions.filter((a) => matchesGuardian(a.guardian_id))),
    [actions, matchesGuardian, selectedGuardian]
  );
  const filteredReceipts = useMemo(
    () =>
      selectedGuardian === 'all'
        ? receipts
        : receipts.filter((r) => matchesGuardian(r.guardian_id || r.agent_id)),
    [matchesGuardian, receipts, selectedGuardian]
  );

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
        if (msg.type === 'offsec.action.requested') {
          const data = msg.data as ActionRequested;
          const update: ActionUpdate = {
            id: data.action_id,
            action: data.action_type,
            status: 'requested',
            created_at: data.ts,
            guardian_id: data.guardian_id,
            guardian_tags: data.guardian_tags,
          };
          setActions((prev) => {
            const others = prev.filter((a) => a.id !== update.id);
            return [update, ...others].slice(0, 50);
          });
        }
        if (msg.type === 'offsec.action.result') {
          const data = msg.data as ActionResult;
          const update: ActionUpdate = {
            id: data.action_id,
            action: data.action_type,
            status: data.status,
            executed_at: data.ts,
            guardian_id: data.guardian_id,
            guardian_tags: data.guardian_tags,
          };
          setActions((prev) => {
            const others = prev.filter((a) => a.id !== update.id);
            return [update, ...others].slice(0, 50);
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
        if (msg.type === 'mesh.root_announce') {
          const rootMsg = msg.data as MeshRootAnnounce;
          setMeshRoots((prev) => [rootMsg, ...prev].slice(0, 50));
        }
        if (msg.type === 'mesh.proof_received') {
          const proofMsg = msg.data as MeshProofReceived;
          setMeshProofs((prev) => [proofMsg, ...prev].slice(0, 100));
        }
      },
      () => setConnected(true),
      () => setConnected(false)
    );

    getCurrentRoot()
      .then((root) => setCurrentRoot(root))
      .catch(() => {});

    return () => connection.close();
  }, []);

  useEffect(() => {
    getReceipts(selectedGuardian === 'all' ? undefined : selectedGuardian)
      .then((data) => setReceipts(data))
      .catch(() => {});
  }, [selectedGuardian]);

  return (
    <div className="container">
      <ShieldStatus
        connected={connected}
        counts={{
          events: filteredEvents.length,
          actions: filteredActions.length,
          receipts: filteredReceipts.length,
        }}
      />
      <GuardianFilter
        guardians={guardianIds}
        selected={selectedGuardian}
        onSelect={(id) => setSelectedGuardian(id)}
      />
      <div className="grid">
        <ThreatStream events={filteredEvents} />
        <ActionPanel
          actions={filteredActions}
          guardianId={selectedGuardian === 'all' ? undefined : selectedGuardian}
          suggestedTarget={filteredEvents.find((e) => e.affected?.length)?.affected?.[0]}
        />
        <ProofLedger receipts={filteredReceipts} lastAnchor={lastAnchor} currentRoot={currentRoot} />
        <MeshPanel roots={meshRoots} proofs={meshProofs} />
      </div>
    </div>
  );
}
