import type { ThreatEvent } from '@/types/events';

interface ThreatItemProps {
  threat: ThreatEvent;
}

const severityBorderClass: Record<string, string> = {
  critical: 'border-l-ruby',
  high: 'border-l-amber',
  medium: 'border-l-cyan',
  low: 'border-l-platinum-dim',
};

const severityDotClass: Record<string, string> = {
  critical: 'bg-ruby shadow-[0_0_8px_rgba(255,0,93,0.4)] animate-pulse-critical',
  high: 'bg-amber shadow-[0_0_6px_rgba(255,201,60,0.4)]',
  medium: 'bg-cyan',
  low: 'bg-platinum-dim',
};

export function ThreatItem({ threat }: ThreatItemProps) {
  const time = new Date(threat.timestamp).toLocaleTimeString();
  const affected = threat.affected?.join(', ') || '-';

  return (
    <div
      className={`
        flex gap-3 p-3 bg-surface-2 rounded-md border-l-[3px] transition-colors hover:bg-surface-3
        animate-threat-enter
        ${severityBorderClass[threat.severity] || 'border-l-platinum-dim'}
      `}
    >
      {/* Severity Indicator */}
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
          severityDotClass[threat.severity] || 'bg-platinum-dim'
        }`}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title & Time */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-mono text-[0.75rem] font-semibold text-platinum">
            {threat.event_type}
          </span>
          <span className="font-mono text-[0.6rem] text-platinum-dim">{time}</span>
        </div>

        {/* Description */}
        <div className="text-[0.8rem] text-platinum-muted mb-1.5 leading-relaxed">
          {threat.description || 'No description'}
        </div>

        {/* Tags/Badges */}
        <div className="flex gap-2 flex-wrap">
          <span className="font-mono text-[0.6rem] px-1.5 py-0.5 bg-cyan-dim text-cyan rounded-sm">
            {threat.source || 'unknown'}
          </span>
          {threat.guardian_id && (
            <span className="font-mono text-[0.6rem] px-1.5 py-0.5 bg-emerald-dim text-emerald rounded-sm">
              {threat.guardian_id}
            </span>
          )}
          <span className="font-mono text-[0.6rem] px-1.5 py-0.5 bg-surface-3 text-platinum-dim rounded-sm">
            {affected}
          </span>
        </div>
      </div>
    </div>
  );
}
