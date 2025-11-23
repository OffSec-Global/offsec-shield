import { Panel } from './ui/Panel';
import { ActionUpdate } from '@/types/events';

type Props = {
  actions: ActionUpdate[];
};

export function ActionPanel({ actions }: Props) {
  return (
    <Panel
      title="Action Panel"
      rightSlot={<div className="panel-pill">{actions.length} actions</div>}
    >
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
