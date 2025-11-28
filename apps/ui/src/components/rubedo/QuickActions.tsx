interface QuickActionsProps {
  onBlock?: () => void;
  onAlert?: () => void;
  onQuarantine?: () => void;
  disabled?: boolean;
}

export function QuickActions({
  onBlock,
  onAlert,
  onQuarantine,
  disabled = false,
}: QuickActionsProps) {
  return (
    <div className="flex gap-2">
      {onBlock && (
        <button
          onClick={onBlock}
          disabled={disabled}
          className="font-mono text-[0.65rem] font-medium uppercase tracking-wide px-3 py-1.5
            border border-ruby rounded-md bg-ruby-dim text-ruby
            hover:bg-ruby hover:text-bg transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-ruby-dim disabled:hover:text-ruby"
        >
          Block
        </button>
      )}
      {onAlert && (
        <button
          onClick={onAlert}
          disabled={disabled}
          className="font-mono text-[0.65rem] font-medium uppercase tracking-wide px-3 py-1.5
            border border-amber rounded-md bg-amber-dim text-amber
            hover:bg-amber hover:text-bg transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-dim disabled:hover:text-amber"
        >
          Alert
        </button>
      )}
      {onQuarantine && (
        <button
          onClick={onQuarantine}
          disabled={disabled}
          className="font-mono text-[0.65rem] font-medium uppercase tracking-wide px-3 py-1.5
            border border-cyan rounded-md bg-cyan-dim text-cyan
            hover:bg-cyan hover:text-bg transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-dim disabled:hover:text-cyan"
        >
          Quarantine
        </button>
      )}
    </div>
  );
}

interface ActionButtonProps {
  label: string;
  variant?: 'emerald' | 'ruby' | 'amber' | 'cyan';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

const variantClasses: Record<string, string> = {
  emerald: 'border-emerald bg-emerald-dim text-emerald hover:bg-emerald hover:text-bg',
  ruby: 'border-ruby bg-ruby-dim text-ruby hover:bg-ruby hover:text-bg',
  amber: 'border-amber bg-amber-dim text-amber hover:bg-amber hover:text-bg',
  cyan: 'border-cyan bg-cyan-dim text-cyan hover:bg-cyan hover:text-bg',
};

export function ActionButton({
  label,
  variant = 'emerald',
  onClick,
  disabled = false,
  className = '',
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`font-mono text-[0.65rem] font-medium uppercase tracking-wide px-3 py-1.5
        border rounded-md transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${className}`}
    >
      {label}
    </button>
  );
}
