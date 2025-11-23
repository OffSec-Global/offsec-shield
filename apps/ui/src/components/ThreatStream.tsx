import { Panel } from './ui/Panel';
import { Badge } from './ui/Badge';
import { ThreatEvent } from '@/types/events';

type Props = {
  events: ThreatEvent[];
};

const severityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return '#ff3333';
    case 'high':
      return '#ffaa00';
    case 'medium':
      return '#00aaff';
    default:
      return '#00d400';
  }
};

export function ThreatStream({ events }: Props) {
  return (
    <Panel
      title="Threat Stream"
      rightSlot={<div className="panel-pill">{events.length} events</div>}
    >
      {events.length === 0 ? (
        <div className="loading">» Awaiting events...</div>
      ) : (
        events.map((event) => (
          <div
            key={event.id}
            className={`event-item ${event.severity}`}
            style={{ borderLeftColor: severityColor(event.severity) }}
          >
            <div className="event-row">
              <Badge tone={event.severity}>{event.severity}</Badge>
              <span>{event.event_type}</span>
              <span className="pill">{event.source}</span>
            </div>
            <div className="event-description">{event.description}</div>
            {event.affected?.length ? (
              <div className="event-meta">Targets: {event.affected.join(', ')}</div>
            ) : null}
            <div className="timestamp">{event.timestamp}</div>
          </div>
        ))
      )}
    </Panel>
  );
}
