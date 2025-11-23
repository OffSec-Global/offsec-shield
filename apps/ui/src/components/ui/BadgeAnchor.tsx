type AnchorEvent = {
  root: string;
  ts: string;
  chain: string;
  txid: string;
  status: string;
};

export function BadgeAnchor({ anchor }: { anchor: AnchorEvent | null }) {
  if (!anchor) {
    return (
      <div className="panel-pill" style={{ borderColor: '#555', color: '#888' }}>
        ⛓️ Not anchored
      </div>
    );
  }

  const shortRoot = anchor.root ? `${anchor.root.slice(0, 10)}…` : '–';
  const shortTx = anchor.txid ? `${anchor.txid.slice(0, 12)}…` : 'pending';

  return (
    <div className="panel-pill">
      ⛓️ Anchored · {anchor.chain} · root {shortRoot} · tx {shortTx}
    </div>
  );
}
