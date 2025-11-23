import { useMemo } from 'react';
import blake from 'blakejs';
import type { Receipt } from '@/types/receipts';
import type { AnchorEvent } from '@/types/events';

export type PathElement = {
  sibling: string;
  position: 'left' | 'right';
};

export type MerkleProof = {
  leaf: string;
  path: PathElement[];
  root: string;
};

type ProofBundle = {
  leaf: string;
  path: PathElement[];
  root: string;
  anchor?: AnchorEvent | null;
  receiptId?: string;
  eventType?: string;
  ts?: string;
};

type Props = {
  proof: MerkleProof | null;
  anchor?: AnchorEvent | null;
  receipt?: Receipt | null;
};

export default function MerkleExplorer({ proof, anchor, receipt }: Props) {
  const computed = useMemo(() => {
    if (!proof) return null;

    const { leaf, path } = proof;
    let hash = leaf;

    for (const step of path) {
      const combined =
        step.position === 'left' ? `${step.sibling}${hash}` : `${hash}${step.sibling}`;

      hash = blake.blake2bHex(combined, undefined, 32);
    }

    return hash;
  }, [proof]);

  const asciiTree = useMemo(() => {
    if (!proof) return ['(no proof)'];
    const lines = [`root: ${proof.root || '—'}`];
    lines.push(`└─ leaf: ${proof.leaf}`);
    proof.path.forEach((p, i) => {
      const prefix = i === proof.path.length - 1 ? '   ' : '│  ';
      const side = p.position === 'left' ? 'L' : 'R';
      lines.push(`${prefix}${side} sibling: ${p.sibling}`);
    });
    return lines;
  }, [proof]);

  if (!proof) {
    return (
      <div className="merkle-explorer empty">
        <div className="muted">No receipt selected — pick one from the Proof Ledger.</div>
      </div>
    );
  }

  const { leaf, path, root } = proof;
  const ok = !!computed && computed === root;

  const handleDownload = () => {
    const bundle: ProofBundle = {
      leaf,
      path,
      root,
      anchor: anchor ?? undefined,
      receiptId: receipt?.id,
      eventType: receipt?.event_type,
      ts: receipt?.ts || receipt?.timestamp,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `offsec-proof-${leaf.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="merkle-explorer">
      <div className="merkle-header">
        <div className="merkle-title">Merkle Path Explorer</div>
        <button className="btn-download" onClick={handleDownload}>
          ⬇ Download proof
        </button>
      </div>

      <div className="merkle-field">
        <div className="muted">Leaf:</div>
        <div className="mono break-all">{leaf}</div>
      </div>

      <div className="merkle-field">
        <div className="muted">Path:</div>
        {path.length === 0 ? (
          <div className="muted">No path provided (showing leaf only)</div>
        ) : (
          <ul className="merkle-path">
            {path.map((p, i) => (
              <li key={`${p.sibling}-${i}`}>
                [{p.position}] sibling = <span className="mono break-all">{p.sibling}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="merkle-field">
        <div className="muted">Computed root:</div>
        <div className={`mono break-all ${ok ? 'ok' : 'err'}`}>{computed ?? '—'}</div>
      </div>

      <div className="merkle-field">
        <div className="muted">Expected root (ROOT.txt):</div>
        <div className="mono break-all">{root}</div>
      </div>

      <div className={`merkle-status ${ok ? 'ok' : 'err'}`}>
        {ok ? '✔ Merkle proof valid' : '✘ Proof does not match root'}
      </div>

      <div className="merkle-field">
        <div className="muted">Tree:</div>
        <pre className="mono merkle-tree">{asciiTree.join('\n')}</pre>
      </div>
    </div>
  );
}
