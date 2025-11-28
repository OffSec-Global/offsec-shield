export interface Guardian {
  id: string;
  tags: string[];
  online: boolean;
  events: number;
  actions: number;
  lastSeen?: Date;
}

interface GuardianCardProps {
  guardian: Guardian;
}

export function GuardianCard({ guardian }: GuardianCardProps) {
  return (
    <div
      className={`p-4 bg-surface border border-border rounded-xl border-l-[3px] ${
        guardian.online ? 'border-l-emerald' : 'border-l-ruby opacity-70'
      }`}
    >
      {/* Header with ID & Online Status */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[0.85rem] font-semibold text-platinum">
          {guardian.id}
        </span>
        <div className="flex items-center gap-1">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              guardian.online
                ? 'bg-emerald shadow-[0_0_6px_rgba(0,231,158,0.4)]'
                : 'bg-ruby shadow-[0_0_6px_rgba(255,0,93,0.4)]'
            }`}
          />
          <span
            className={`font-mono text-[0.6rem] uppercase ${
              guardian.online ? 'text-emerald' : 'text-ruby'
            }`}
          >
            {guardian.online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex gap-1 flex-wrap mb-2">
        {guardian.tags.length > 0 ? (
          guardian.tags.map((tag, i) => (
            <span
              key={i}
              className="font-mono text-[0.55rem] px-1.5 py-0.5 bg-surface-3 rounded-sm text-platinum-dim"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="font-mono text-[0.55rem] px-1.5 py-0.5 bg-surface-3 rounded-sm text-platinum-dim">
            no tags
          </span>
        )}
      </div>

      {/* Stats: Events & Actions */}
      <div className="flex gap-4">
        <div className="flex flex-col">
          <span className="font-mono text-[0.5rem] uppercase tracking-wide text-platinum-dim">
            Events
          </span>
          <span className="font-mono text-base font-semibold text-platinum">
            {guardian.events}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-[0.5rem] uppercase tracking-wide text-platinum-dim">
            Actions
          </span>
          <span className="font-mono text-base font-semibold text-platinum">
            {guardian.actions}
          </span>
        </div>
      </div>
    </div>
  );
}

interface GuardianGridProps {
  guardians: Map<string, Guardian> | Guardian[];
}

export function GuardianGrid({ guardians }: GuardianGridProps) {
  const guardianList = Array.isArray(guardians)
    ? guardians
    : Array.from(guardians.values());

  if (guardianList.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
      {guardianList.map((guardian) => (
        <GuardianCard key={guardian.id} guardian={guardian} />
      ))}
    </div>
  );
}
