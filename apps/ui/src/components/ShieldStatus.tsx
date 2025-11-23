type Props = {
  connected: boolean;
  counts: {
    events: number;
    actions: number;
    receipts: number;
  };
};

export function ShieldStatus({ connected, counts }: Props) {
  return (
    <div className="status-bar">
      <div>
        ≈ OFFSEC SHIELD ≈ <span className="cursor"></span>
      </div>
      <div className="status-metrics">
        <span className={`pill ${connected ? 'pill-good' : 'pill-bad'}`}>
          {connected ? 'LIVE' : 'OFFLINE'}
        </span>
        <span className="pill">Events: {counts.events}</span>
        <span className="pill">Actions: {counts.actions}</span>
        <span className="pill">Receipts: {counts.receipts}</span>
      </div>
    </div>
  );
}
