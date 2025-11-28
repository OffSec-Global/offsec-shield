import type { ActionUpdate } from '@/types/events';

interface ActionItemProps {
  action: ActionUpdate;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

const statusBorderClass: Record<string, string> = {
  executed: 'border-l-emerald',
  accepted: 'border-l-emerald',
  failed: 'border-l-ruby',
  denied: 'border-l-ruby',
  pending: 'border-l-amber',
};

const statusTextClass: Record<string, string> = {
  executed: 'text-emerald',
  accepted: 'text-emerald',
  failed: 'text-ruby',
  denied: 'text-ruby',
  pending: 'text-amber',
};

function getActionTypeClass(actionType: string): string {
  if (actionType?.includes('block')) return 'bg-ruby-dim text-ruby';
  if (actionType?.includes('alert')) return 'bg-amber-dim text-amber';
  if (actionType?.includes('quarantine')) return 'bg-cyan-dim text-cyan';
  return 'bg-surface-3 text-platinum';
}

export function ActionItem({ action, onApprove, onReject }: ActionItemProps) {
  const status = action.status || 'pending';
  const time = action.created_at
    ? new Date(action.created_at).toLocaleTimeString()
    : '-';
  const actionLabel = action.action?.replace('offsec.action.', '').replace(/_/g, ' ') || 'unknown';
  const isPending = status === 'pending' || status === 'accepted';

  return (
    <div
      className={`p-3 bg-surface-2 rounded-md border-l-[3px] ${
        statusBorderClass[status] || 'border-l-amber'
      }`}
    >
      {/* Type Badge & Status */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`font-mono text-[0.7rem] font-semibold px-2 py-0.5 rounded-md ${getActionTypeClass(
            action.action
          )}`}
        >
          {actionLabel}
        </span>
        <span
          className={`font-mono text-[0.6rem] uppercase tracking-wide ${
            statusTextClass[status] || 'text-amber'
          }`}
        >
          {status}
        </span>
      </div>

      {/* Target */}
      <div className="font-mono text-[0.8rem] text-platinum mb-1">
        {action.id || '-'}
      </div>

      {/* Footer: Time & Approve/Reject */}
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-[0.6rem] text-platinum-dim">{time}</span>
        {isPending && (onApprove || onReject) && (
          <div className="flex gap-1">
            {onApprove && (
              <button
                onClick={() => onApprove(action.id)}
                className="font-mono text-[0.6rem] font-medium uppercase tracking-wide px-2.5 py-1
                  border border-border rounded-md bg-transparent text-platinum-muted
                  hover:border-emerald hover:text-emerald hover:bg-emerald-dim transition-colors"
              >
                Approve
              </button>
            )}
            {onReject && (
              <button
                onClick={() => onReject(action.id)}
                className="font-mono text-[0.6rem] font-medium uppercase tracking-wide px-2.5 py-1
                  border border-border rounded-md bg-transparent text-platinum-muted
                  hover:border-ruby hover:text-ruby hover:bg-ruby-dim transition-colors"
              >
                Reject
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
