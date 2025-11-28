import { useEffect, useState } from 'react';
import { Panel } from './ui/Panel';
import { ActionUpdate } from '@/types/events';
import { applyAction } from '@/lib/api';

type Props = {
  actions: ActionUpdate[];
  suggestedTarget?: string;
  guardianId?: string;
};

export function ActionPanel({ actions, suggestedTarget, guardianId }: Props) {
  const [targetIp, setTargetIp] = useState<string>('');
  const [actionType, setActionType] = useState<string>('block_ip');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [lastActionId, setLastActionId] = useState<string | null>(null);
  const [lastActionStatus, setLastActionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (suggestedTarget && !targetIp) {
      setTargetIp(suggestedTarget);
    }
  }, [suggestedTarget, targetIp]);

  const onSubmitAction = async () => {
    if (!targetIp) return;
    setSubmitting(true);
    setError(null);
    setLastActionStatus('pending');
    const actionId = `act-${Date.now()}`;
    setLastActionId(actionId);
    try {
      await applyAction({
        action_id: actionId,
        action_type: `offsec.action.${actionType}`,
        target: { ip: targetIp },
        reason: reason || `Operator ${actionType} from UI${suggestedTarget ? ' (suggested)' : ''}`,
        requested_by: 'operator-ui',
        ts: new Date().toISOString(),
        guardian_id: guardianId,
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to apply action');
      setLastActionStatus('failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Panel
      title="Action Panel"
      rightSlot={<div className="panel-pill">{actions.length} tracked</div>}
    >
      {guardianId ? (
        <div className="muted" style={{ marginBottom: '8px' }}>
          Guardian: <span className="pill">{guardianId}</span>
        </div>
      ) : (
        <div className="muted" style={{ marginBottom: '8px' }}>
          No guardian selected
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        <div className="muted" style={{ marginBottom: '4px' }}>
          Action Type
        </div>
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          style={{ width: '100%', padding: '6px', fontFamily: 'monospace', marginBottom: '8px' }}
        >
          <option value="block_ip">Block IP</option>
          <option value="alert_human">Alert Human</option>
          <option value="quarantine">Quarantine</option>
          <option value="isolate_host">Isolate Host</option>
        </select>

        <div className="muted" style={{ marginBottom: '4px' }}>
          Target IP
        </div>
        <input
          value={targetIp}
          onChange={(e) => setTargetIp(e.target.value)}
          placeholder="203.0.113.42"
          style={{ width: '100%', padding: '6px', fontFamily: 'monospace', marginBottom: '8px' }}
        />

        <div className="muted" style={{ marginBottom: '4px' }}>
          Reason (optional)
        </div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Operator reason"
          style={{ width: '100%', padding: '6px', fontFamily: 'monospace', marginBottom: '8px' }}
        />

        <button
          disabled={!targetIp || submitting}
          onClick={onSubmitAction}
          style={{ width: '100%', padding: '6px' }}
        >
          {submitting ? 'Submitting…' : `Submit ${actionType}`}
        </button>

        {lastActionId ? (
          <div className="muted" style={{ marginTop: '6px', fontSize: '11px' }}>
            Last ID: <span className="mono">{lastActionId}</span>
            {lastActionStatus && ` (${lastActionStatus})`}
          </div>
        ) : null}
        {error ? (
          <div style={{ color: '#ff5555', fontSize: '11px', marginTop: '4px' }}>✗ {error}</div>
        ) : null}
      </div>

      <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
        {actions.length === 0 ? (
          <div style={{ color: '#666', fontSize: '12px' }}>No active actions</div>
        ) : (
          <div>
            <div className="muted" style={{ marginBottom: '6px' }}>
              Recent Actions
            </div>
            {actions.slice(0, 5).map((action) => {
              const when = action.executed_at || action.created_at || '–';
              const statusColor = 
                action.status === 'failed' ? '#ff5555' :
                action.status === 'executed' ? '#00e79e' :
                '#ffaa00';
              return (
                <div key={action.id} className="event-item" style={{ marginBottom: '6px' }}>
                  <div style={{ fontSize: '12px', marginBottom: '2px' }}>
                    <span style={{ color: statusColor }}>●</span> {action.action.replace('offsec.action.', '')}
                  </div>
                  <div className="timestamp" style={{ fontSize: '10px' }}>
                    {action.status} • {when.split('T')[1]?.substring(0, 5) || '–'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
