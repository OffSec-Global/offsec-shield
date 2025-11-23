import { useMemo, useState } from 'react';
import { Panel } from './ui/Panel';
import { Receipt } from '@/types/receipts';
import MerkleExplorer, { MerkleProof } from './MerkleExplorer';
import { BadgeAnchor } from './ui/BadgeAnchor';
import type { AnchorEvent } from '@/types/events';

type Props = {
  receipts: Receipt[];
  lastAnchor: AnchorEvent | null;
  currentRoot: string;
};

function buildProof(receipt: Receipt, currentRoot: string): MerkleProof {
  return {
    leaf: receipt.hash,
    path: receipt.merkle_path || [],
    root: currentRoot || receipt.merkle_root || '',
  };
}

export function ProofLedger({ receipts, lastAnchor, currentRoot }: Props) {
  const [selected, setSelected] = useState<Receipt | null>(null);

  const proof = useMemo(() => {
    if (!selected) return null;
    return buildProof(selected, currentRoot);
  }, [selected, currentRoot]);

  return (
    <Panel
      title="Proof Ledger"
      rightSlot={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="panel-pill">{receipts.length} receipts</div>
          <BadgeAnchor anchor={lastAnchor} />
        </div>
      }
    >
      {receipts.length === 0 ? (
        <div style={{ color: '#888' }}>» No receipts yet</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
          <ul className="receipt-list">
            {receipts.map((receipt) => {
              const isSelected = selected?.id === receipt.id;
              const when = receipt.ts || receipt.timestamp || '–';
              const label = receipt.event_type || 'receipt';
              const guardian = receipt.guardian_id || receipt.agent_id;

              return (
                <li
                  key={receipt.id}
                  onClick={() => setSelected(receipt)}
                  className={`event-item receipt-card ${isSelected ? 'active' : ''}`}
                >
                  <div className="receipt-title">{label}</div>
                  <div className="receipt-meta">{when}</div>
                  {guardian ? (
                    <div className="receipt-meta">
                      Guardian: <span className="pill subtle">{guardian}</span>
                    </div>
                  ) : null}
                  <div className="receipt-hash mono">{receipt.hash}</div>
                </li>
              );
            })}
          </ul>
          <MerkleExplorer proof={proof} anchor={lastAnchor ?? undefined} receipt={selected} />
        </div>
      )}
    </Panel>
  );
}
