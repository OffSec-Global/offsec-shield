import { useState } from 'react';
import type { MeshProofReceived, MeshRootAnnounce, AnchorEvent } from '@/types/events';
import type { Receipt } from '@/types/receipts';
import MerkleExplorer, { MerkleProof } from './MerkleExplorer';
import { Panel } from './rubedo';

type Props = {
  roots: MeshRootAnnounce[];
  proofs: MeshProofReceived[];
};

const API_URL = process.env.NEXT_PUBLIC_OFFSEC_API_URL || 'http://localhost:9115';

type ProofBundle = {
  leaf: string;
  path: { sibling: string; position: 'left' | 'right' }[];
  root: string;
  anchor?: AnchorEvent | null;
  receiptId?: string;
  eventType?: string;
  ts?: string;
};

export function MeshPanel({ roots, proofs }: Props) {
  const [selectedBundle, setSelectedBundle] = useState<ProofBundle | null>(null);

  // latest root per peer
  const latestRootByPeer = roots.reduce<Record<string, MeshRootAnnounce>>((acc, r) => {
    const existing = acc[r.from];
    if (!existing || new Date(r.ts) > new Date(existing.ts)) {
      acc[r.from] = r;
    }
    return acc;
  }, {});

  const peers = Object.keys(latestRootByPeer).sort();

  async function fetchMeshProof(
    peer: string,
    receiptId: string,
    opts: { download?: boolean } = {}
  ): Promise<ProofBundle | null> {
    try {
      const res = await fetch(
        `${API_URL}/offsec/mesh/proof/${encodeURIComponent(peer)}/${encodeURIComponent(receiptId)}`
      );
      if (!res.ok) {
        console.error('Failed to fetch mesh proof bundle', res.status);
        return null;
      }
      const bundle = (await res.json()) as ProofBundle;

      if (opts.download) {
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `offsec-mesh-proof-${peer}-${receiptId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      return bundle;
    } catch (e) {
      console.error('Error fetching mesh proof bundle', e);
      return null;
    }
  }

  function toMerkleProof(bundle: ProofBundle | null): MerkleProof | null {
    if (!bundle) return null;
    return {
      leaf: bundle.leaf,
      path: bundle.path,
      root: bundle.root,
    };
  }

  function toReceiptSkeleton(bundle: ProofBundle | null): Receipt | null {
    if (!bundle) return null;
    return {
      id: bundle.receiptId || 'mesh-remote',
      hash: bundle.leaf,
      ts: bundle.ts,
      timestamp: bundle.ts,
      event_type: bundle.eventType,
    } as Receipt;
  }

  return (
    <Panel title="Mesh Federation" subtitle={`${peers.length} peers connected`}>
      {peers.length === 0 && proofs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <span className="text-2xl mb-2 opacity-30">⬡</span>
          <span className="font-mono text-[0.8rem] text-platinum-dim">
            No mesh traffic yet — start mesh-daemon on a peer node.
          </span>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Peer Roots */}
            <div>
              <h4 className="font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-platinum-muted mb-3">
                Peer Roots
              </h4>
              <ul className="space-y-2">
                {peers.map((id) => {
                  const r = latestRootByPeer[id];
                  const anchor = r.anchor;
                  const anchored = !!anchor && anchor.status === 'anchored';
                  const anchorLabel = anchor?.chain
                    ? `${anchor.chain}:${anchor.txid?.slice(0, 10) ?? '…'}`
                    : '—';
                  return (
                    <li
                      key={id}
                      className="p-3 bg-surface-2 rounded-md border-l-[3px] border-l-cyan"
                    >
                      <div className="font-mono text-[0.75rem] font-semibold text-platinum mb-1">
                        {id}
                      </div>
                      <div className="font-mono text-[0.65rem] text-platinum-muted break-all mb-2">
                        {r.root}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[0.55rem] text-platinum-dim">
                          {r.ts}
                        </span>
                        <span
                          className={`font-mono text-[0.55rem] px-1.5 py-0.5 rounded-sm ${
                            anchored
                              ? 'bg-emerald-dim text-emerald'
                              : 'bg-surface-3 text-platinum-dim'
                          }`}
                        >
                          {anchored ? 'Anchored' : 'Unanchored'} {anchorLabel}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Remote Proofs */}
            <div>
              <h4 className="font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-platinum-muted mb-3">
                Remote Proofs
              </h4>
              {proofs.length === 0 ? (
                <div className="font-mono text-[0.75rem] text-platinum-dim">
                  No remote proofs received yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {proofs.slice(0, 12).map((p, idx) => {
                    const isSelected =
                      selectedBundle &&
                      selectedBundle.receiptId === p.receiptId &&
                      selectedBundle.root === p.root;

                    return (
                      <li
                        key={`${p.from}-${p.receiptId}-${idx}`}
                        onClick={async () => {
                          const bundle = await fetchMeshProof(p.from, p.receiptId);
                          if (bundle) setSelectedBundle(bundle);
                        }}
                        className={`p-3 bg-surface-2 rounded-md cursor-pointer transition-colors hover:bg-surface-3
                          ${isSelected ? 'border-l-[3px] border-l-emerald' : 'border-l-[3px] border-l-amber'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[0.75rem] font-semibold text-platinum">
                            {p.from}
                          </span>
                          <span className="font-mono text-[0.6rem] px-1.5 py-0.5 bg-cyan-dim text-cyan rounded-sm">
                            {p.eventType}
                          </span>
                        </div>
                        <div className="font-mono text-[0.65rem] text-platinum-muted break-all mb-2">
                          {p.receiptId} · {p.root.slice(0, 18)}…
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[0.55rem] text-platinum-dim">
                            {p.ts}
                          </span>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const bundle = await fetchMeshProof(p.from, p.receiptId, {
                                download: true,
                              });
                              if (bundle) setSelectedBundle(bundle);
                            }}
                            className="font-mono text-[0.55rem] px-1.5 py-0.5 border border-border rounded-sm
                              bg-transparent text-platinum-dim hover:border-emerald hover:text-emerald transition-colors"
                          >
                            proof
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Explorer for selected remote proof */}
          {selectedBundle && (
            <div className="pt-4 border-t border-border">
              <MerkleExplorer
                proof={toMerkleProof(selectedBundle)}
                anchor={selectedBundle?.anchor ?? null}
                receipt={toReceiptSkeleton(selectedBundle)}
              />
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export default MeshPanel;
