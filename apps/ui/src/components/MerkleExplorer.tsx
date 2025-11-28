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
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <span className="text-2xl mb-2 opacity-30">⬡</span>
        <span className="font-mono text-[0.8rem] text-platinum-dim">
          No receipt selected — pick one from the Proof Ledger.
        </span>
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[0.75rem] font-semibold text-platinum uppercase tracking-wide">
          Merkle Path Explorer
        </h3>
        <button
          onClick={handleDownload}
          className="font-mono text-[0.6rem] font-medium uppercase tracking-wide px-2.5 py-1
            border border-border rounded-md bg-transparent text-platinum-muted
            hover:border-emerald hover:text-emerald hover:bg-emerald-dim transition-colors"
        >
          Download proof
        </button>
      </div>

      {/* Leaf */}
      <div>
        <div className="font-mono text-[0.6rem] text-platinum-dim uppercase tracking-wide mb-1">
          Leaf:
        </div>
        <div className="font-mono text-[0.7rem] text-platinum break-all bg-surface-2 px-3 py-2 rounded-md">
          {leaf}
        </div>
      </div>

      {/* Path */}
      <div>
        <div className="font-mono text-[0.6rem] text-platinum-dim uppercase tracking-wide mb-1">
          Path:
        </div>
        {path.length === 0 ? (
          <div className="font-mono text-[0.7rem] text-platinum-dim">
            No path provided (showing leaf only)
          </div>
        ) : (
          <ul className="space-y-1">
            {path.map((p, i) => (
              <li
                key={`${p.sibling}-${i}`}
                className="font-mono text-[0.7rem] text-platinum bg-surface-2 px-3 py-2 rounded-md"
              >
                <span className={p.position === 'left' ? 'text-cyan' : 'text-amber'}>
                  [{p.position.toUpperCase()}]
                </span>{' '}
                sibling = <span className="break-all">{p.sibling}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Computed Root */}
      <div>
        <div className="font-mono text-[0.6rem] text-platinum-dim uppercase tracking-wide mb-1">
          Computed root:
        </div>
        <div
          className={`font-mono text-[0.7rem] break-all px-3 py-2 rounded-md ${
            ok ? 'bg-emerald-dim text-emerald' : 'bg-ruby-dim text-ruby'
          }`}
        >
          {computed ?? '—'}
        </div>
      </div>

      {/* Expected Root */}
      <div>
        <div className="font-mono text-[0.6rem] text-platinum-dim uppercase tracking-wide mb-1">
          Expected root (ROOT.txt):
        </div>
        <div className="font-mono text-[0.7rem] text-platinum break-all bg-surface-2 px-3 py-2 rounded-md">
          {root}
        </div>
      </div>

      {/* Status */}
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-md ${
          ok ? 'bg-emerald-dim border border-emerald/25' : 'bg-ruby-dim border border-ruby/25'
        }`}
      >
        <span className={`text-lg ${ok ? 'text-emerald' : 'text-ruby'}`}>
          {ok ? '✔' : '✘'}
        </span>
        <span className={`font-mono text-[0.75rem] font-semibold ${ok ? 'text-emerald' : 'text-ruby'}`}>
          {ok ? 'Merkle proof valid' : 'Proof does not match root'}
        </span>
      </div>

      {/* Tree Visualization */}
      <div>
        <div className="font-mono text-[0.6rem] text-platinum-dim uppercase tracking-wide mb-1">
          Tree:
        </div>
        <pre className="font-mono text-[0.65rem] text-platinum-muted bg-surface-2 px-3 py-2 rounded-md overflow-x-auto">
          {asciiTree.join('\n')}
        </pre>
      </div>
    </div>
  );
}
