'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { connectWebSocket } from '@/lib/ws-client';
import { applyAction, getCurrentRoot, getReceipts } from '@/lib/api';
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

// Rubedo components
import {
  RubedoShell,
  Section,
  Panel,
  Grid,
  StatCard,
  StatGrid,
  ThreatItem,
  ActionItem,
  ReceiptItem,
  EmptyState,
  ActionButton,
  Guardian,
  GuardianGrid,
} from '@/components/rubedo';

// Preserved critical components
import { GuardianFilter } from '@/components/GuardianFilter';
import { MeshPanel } from '@/components/MeshPanel';
import MerkleExplorer, { MerkleProof } from '@/components/MerkleExplorer';

function buildProof(receipt: Receipt, currentRoot: string): MerkleProof {
  return {
    leaf: receipt.hash,
    path: receipt.merkle_path || [],
    root: currentRoot || receipt.merkle_root || '',
  };
}

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
  const [defenseMode, setDefenseMode] = useState<'detect' | 'prevent' | 'lockdown'>('detect');

  // Action panel state
  const [targetIp, setTargetIp] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  // Guardian tracking
  const [guardians, setGuardians] = useState<Map<string, Guardian>>(new Map());

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

  // Update guardians map when guardianIds change
  useEffect(() => {
    setGuardians((prev) => {
      const next = new Map(prev);
      guardianIds.forEach((id) => {
        if (!next.has(id)) {
          next.set(id, {
            id,
            tags: [],
            online: true,
            events: 0,
            actions: 0,
          });
        }
      });
      // Update counts
      next.forEach((g, id) => {
        const eventCount = events.filter((e) => e.guardian_id === id).length;
        const actionCount = actions.filter((a) => a.guardian_id === id).length;
        next.set(id, { ...g, events: eventCount, actions: actionCount });
      });
      return next;
    });
  }, [guardianIds, events, actions]);

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

  const proof = useMemo(() => {
    if (!selectedReceipt) return null;
    return buildProof(selectedReceipt, currentRoot);
  }, [selectedReceipt, currentRoot]);

   // WebSocket connection and initial data fetch
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
        }
        if (msg.type === 'mesh.root_announce') {
          const root = msg.data as MeshRootAnnounce;
          setMeshRoots((prev) => [root, ...prev].slice(0, 100));
        }
        if (msg.type === 'mesh.proof_received') {
          const proofMsg = msg.data as MeshProofReceived;
          setMeshProofs((prev) => [proofMsg, ...prev].slice(0, 100));
        }
      },
      () => setConnected(true),
      () => setConnected(false)
    );

    // Fetch initial data
    getCurrentRoot()
      .then((root) => setCurrentRoot(root))
      .catch((err) => console.error('Failed to fetch root:', err));

    // Fetch initial receipts
    getReceipts()
      .then((data) => setReceipts(data))
      .catch((err) => console.error('Failed to fetch receipts:', err));

    return () => connection.close();
  }, []);

  useEffect(() => {
    if (selectedGuardian !== 'all') {
      // Only refetch when filtering to a specific guardian
      getReceipts(selectedGuardian)
        .then((data) => setReceipts(data))
        .catch((err) => console.error('Failed to fetch receipts:', err));
    }
  }, [selectedGuardian]);

  // Set suggested target from latest threat
  useEffect(() => {
    const suggestedTarget = filteredEvents.find((e) => e.affected?.length)?.affected?.[0];
    if (suggestedTarget && !targetIp) {
      setTargetIp(suggestedTarget);
    }
  }, [filteredEvents, targetIp]);

  const handleBlockIp = async () => {
    if (!targetIp) return;
    setSubmitting(true);
    const actionId = `act-${Date.now()}`;
    try {
      await applyAction({
        action_id: actionId,
        action_type: 'offsec.action.block_ip',
        target: { ip: targetIp },
        reason: 'Operator block from UI',
        requested_by: 'operator-ui',
        ts: new Date().toISOString(),
        guardian_id: selectedGuardian === 'all' ? undefined : selectedGuardian,
      });
    } catch {
      // Error handling - action will show in list with status
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAction = async (id: string) => {
    // TODO: Implement action approval API
    console.log('Approve action:', id);
  };

  const handleRejectAction = async (id: string) => {
    // TODO: Implement action rejection API
    console.log('Reject action:', id);
  };

  const handleDownloadReceipt = (id: string) => {
    const receipt = receipts.find((r) => r.id === id || r.receipt_id === id);
    if (receipt) {
      const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <RubedoShell
      connected={connected}
      defenseMode={defenseMode}
      onDefenseModeChange={setDefenseMode}
      title="OFFSEC SHIELD"
      subtitle="Security Operations"
    >
      {/* Stats Overview */}
      <Section>
        <StatGrid>
          <StatCard
            label="Threats"
            value={filteredEvents.length}
            variant={filteredEvents.some((e) => e.severity === 'critical') ? 'ruby' : undefined}
          />
          <StatCard
            label="Actions"
            value={filteredActions.length}
            variant={filteredActions.some((a) => a.status === 'pending') ? 'amber' : undefined}
          />
          <StatCard label="Receipts" value={filteredReceipts.length} variant="emerald" />
          <StatCard label="Guardians" value={guardianIds.length} />
        </StatGrid>
      </Section>

      {/* Guardian Filter */}
      <Section>
        <GuardianFilter
          guardians={guardianIds}
          selected={selectedGuardian}
          onSelect={(id) => setSelectedGuardian(id)}
        />
      </Section>

      {/* Main Grid */}
      <Grid cols={3}>
        {/* Threat Stream */}
        <Panel
          title="Threat Stream"
          subtitle={`${filteredEvents.length} events`}
          maxHeight="500px"
        >
          {filteredEvents.length === 0 ? (
            <EmptyState text="Awaiting events..." />
          ) : (
            <div className="flex flex-col gap-2">
              {filteredEvents.map((event) => (
                <ThreatItem key={event.id} threat={event} />
              ))}
            </div>
          )}
        </Panel>

        {/* Action Panel */}
        <Panel
          title="Action Panel"
          subtitle={selectedGuardian === 'all' ? 'All guardians' : `Guardian: ${selectedGuardian}`}
          maxHeight="500px"
          actions={
            <div className="flex gap-2">
              <ActionButton
                label="Block"
                variant="ruby"
                onClick={handleBlockIp}
                disabled={!targetIp || submitting}
              />
            </div>
          }
        >
          <div className="mb-4">
            <label className="block font-mono text-[0.6rem] text-platinum-dim uppercase tracking-wide mb-1">
              Target IP
            </label>
            <input
              type="text"
              value={targetIp}
              onChange={(e) => setTargetIp(e.target.value)}
              placeholder="203.0.113.42"
              className="w-full px-3 py-2 bg-surface-2 border border-border rounded-md
                font-mono text-[0.8rem] text-platinum placeholder:text-platinum-faint
                focus:outline-none focus:border-emerald transition-colors"
            />
          </div>

          {filteredActions.length === 0 ? (
            <EmptyState text="No active actions" />
          ) : (
            <div className="flex flex-col gap-2">
              {filteredActions.map((action) => (
                <ActionItem
                  key={action.id}
                  action={action}
                  onApprove={handleApproveAction}
                  onReject={handleRejectAction}
                />
              ))}
            </div>
          )}
        </Panel>

        {/* Proof Ledger */}
        <Panel
          title="Proof Ledger"
          subtitle={`${filteredReceipts.length} receipts`}
          maxHeight="500px"
        >
          {filteredReceipts.length === 0 ? (
            <EmptyState text="No receipts yet" />
          ) : (
            <div className="flex flex-col gap-2">
              {filteredReceipts.map((receipt) => (
                <ReceiptItem
                  key={receipt.id || receipt.receipt_id}
                  receipt={receipt}
                  isActive={selectedReceipt?.id === receipt.id}
                  onView={(id) => {
                    const r = receipts.find((r) => r.id === id || r.receipt_id === id);
                    setSelectedReceipt(r || null);
                  }}
                  onDownload={handleDownloadReceipt}
                />
              ))}
            </div>
          )}
        </Panel>
      </Grid>

      {/* Merkle Explorer (preserved) */}
      {selectedReceipt && (
        <Section title="Merkle Proof Verification" className="mt-6">
          <Panel>
            <MerkleExplorer
              proof={proof}
              anchor={lastAnchor ?? undefined}
              receipt={selectedReceipt}
            />
          </Panel>
        </Section>
      )}

      {/* Mesh Panel (preserved) */}
      {(meshRoots.length > 0 || meshProofs.length > 0) && (
        <Section title="Mesh Federation" className="mt-6">
          <MeshPanel roots={meshRoots} proofs={meshProofs} />
        </Section>
      )}

      {/* Guardian Grid */}
      {guardians.size > 0 && (
        <Section title="Active Guardians" className="mt-6">
          <GuardianGrid guardians={guardians} />
        </Section>
      )}
    </RubedoShell>
  );
}
