import React, { useState } from "react";
import { Panel } from "./ui/Panel";
import type { MeshProofReceived, MeshRootAnnounce, AnchorEvent } from "@/types/events";
import type { Receipt } from "@/types/receipts";
import MerkleExplorer, { MerkleProof } from "./MerkleExplorer";

type Props = {
  roots: MeshRootAnnounce[];
  proofs: MeshProofReceived[];
};

const API_URL = process.env.NEXT_PUBLIC_OFFSEC_API_URL || "http://localhost:9115";

type ProofBundle = {
  leaf: string;
  path: { sibling: string; position: "left" | "right" }[];
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
        console.error("Failed to fetch mesh proof bundle", res.status);
        return null;
      }
      const bundle = (await res.json()) as ProofBundle;

      if (opts.download) {
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `offsec-mesh-proof-${peer}-${receiptId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      return bundle;
    } catch (e) {
      console.error("Error fetching mesh proof bundle", e);
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
      id: bundle.receiptId || "mesh-remote",
      hash: bundle.leaf,
      ts: bundle.ts,
      timestamp: bundle.ts,
      event_type: bundle.eventType,
    } as Receipt;
  }

  return (
    <Panel title="Mesh Federation">
      {peers.length === 0 && proofs.length === 0 ? (
        <div className="muted">No mesh traffic yet — start mesh-daemon on a peer node.</div>
      ) : (
        <div>
          <div className="mesh-grid">
            <div>
              <div className="mesh-section-title">Peer Roots</div>
              <ul className="mesh-list">
                {peers.map((id) => {
                  const r = latestRootByPeer[id];
                  const anchor = r.anchor;
                  const anchored = !!anchor && anchor.status === "anchored";
                  const anchorLabel = anchor?.chain
                    ? `${anchor.chain}:${anchor.txid?.slice(0, 10) ?? "…"}`
                    : "—";
                  return (
                    <li key={id} className="mesh-item">
                      <div className="mesh-peer">{id}</div>
                      <div className="mesh-root mono break-all">{r.root}</div>
                      <div className="mesh-meta">
                        <span className="mesh-ts">{r.ts}</span>
                        <span className={anchored ? "mesh-badge anchored" : "mesh-badge"}>
                          {anchored ? "Anchored" : "Unanchored"} {anchorLabel}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <div className="mesh-section-title">Remote Proofs</div>
              {proofs.length === 0 ? (
                <div className="muted">No remote proofs received yet.</div>
              ) : (
                <ul className="mesh-list">
                  {proofs.slice(0, 12).map((p, idx) => {
                    const isSelected =
                      selectedBundle &&
                      selectedBundle.receiptId === p.receiptId &&
                      selectedBundle.root === p.root;

                    return (
                      <li
                        key={`${p.from}-${p.receiptId}-${idx}`}
                        className={`mesh-item mesh-proof-row ${isSelected ? "active" : ""}`}
                        onClick={async () => {
                          const bundle = await fetchMeshProof(p.from, p.receiptId);
                          if (bundle) setSelectedBundle(bundle);
                        }}
                      >
                        <div className="mesh-peer">
                          {p.from} <span className="mesh-event">{p.eventType}</span>
                        </div>
                        <div className="mesh-root mono break-all">
                          {p.receiptId} · {p.root.slice(0, 18)}…
                        </div>
                        <div className="mesh-meta mesh-proof-meta">
                          <span className="mesh-ts">{p.ts}</span>
                          <button
                            type="button"
                            className="mesh-download-btn"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const bundle = await fetchMeshProof(p.from, p.receiptId, { download: true });
                              if (bundle) setSelectedBundle(bundle);
                            }}
                          >
                            ⬇ proof
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
          <div className="mesh-explorer-wrapper" style={{ marginTop: 8 }}>
            <MerkleExplorer
              proof={toMerkleProof(selectedBundle)}
              anchor={selectedBundle?.anchor ?? null}
              receipt={toReceiptSkeleton(selectedBundle)}
            />
          </div>
        </div>
      )}
    </Panel>
  );
}

export default MeshPanel;
