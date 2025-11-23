import { useEffect, useState } from 'react';
import { Panel } from './ui/Panel';
import { ActionUpdate } from '@/types/events';
import { applyAction } from '@/lib/api';

type Props = {
  actions: ActionUpdate[];
  suggestedTarget?: string;
};

export function ActionPanel({ actions, suggestedTarget }: Props) {
  const [targetIp, setTargetIp] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [lastActionId, setLastActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (suggestedTarget) {
      setTargetIp(suggestedTarget);
    }
  }, [suggestedTarget]);

  const onBlockIp = async () => {
    if (!targetIp) return;
    setSubmitting(true);
    setError(null);
    const actionId = `act-${Date.now()}`;
    setLastActionId(actionId);
    try {
      await applyAction({
        action_id: actionId,
        action_type: 'offsec.action.block_ip',
        target: { ip: targetIp },
        reason: `Operator block from UI${suggestedTarget ? ' (suggested)' : ''}`,
        requested_by: 'operator-ui',
        ts: new Date().toISOString(),
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to apply action');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel
      title="Action Panel"
      rightSlot={<div className="panel-pill">{actions.length} actions</div>}
    >
      <div style={{ marginBottom: '10px' }}>
        <div className="muted" style={{ marginBottom: '4px' }}>
          Target IP
        </div>
        <input
          value={targetIp}
          onChange={(e) => setTargetIp(e.target.value)}
          placeholder="203.0.113.42"
          style={{ width: '100%', padding: '6px', fontFamily: 'Courier New, monospace' }}
        />
        <button
          style={{ marginTop: '6px' }}
          disabled={!targetIp || submitting}
          onClick={onBlockIp}
        >
          {submitting ? 'Issuing…' : 'Block IP'}
        </button>
        {lastActionId ? (
          <div className="muted" style={{ marginTop: '4px' }}>
            Last action id: <span className="mono">{lastActionId}</span>
          </div>
        ) : null}
        {error ? (
          <div style={{ color: '#ff5555', fontSize: '11px', marginTop: '4px' }}>{error}</div>
        ) : null}
      </div>

      {actions.length === 0 ? (
        <div style={{ color: '#888' }}>» No active actions</div>
      ) : (
        actions.map((action) => (
          <div key={action.id} className="event-item">
            <div className="event-row">
              <span className="pill">{action.action}</span>
              <span className="pill subtle">{action.status}</span>
            </div>
            <div className="timestamp">{action.created_at}</div>
          </div>
        ))
      )}
    </Panel>
  );
}
