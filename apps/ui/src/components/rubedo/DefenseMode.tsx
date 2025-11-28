type DefenseModeType = 'detect' | 'prevent' | 'lockdown';

interface DefenseModeProps {
  mode: DefenseModeType;
  onChange?: (mode: DefenseModeType) => void;
}

const modeConfig: Record<DefenseModeType, { label: string; color: string; bgClass: string; borderClass: string; textClass: string; dotClass: string }> = {
  detect: {
    label: 'Detect',
    color: 'emerald',
    bgClass: 'bg-emerald-dim',
    borderClass: 'border-emerald/25',
    textClass: 'text-emerald',
    dotClass: 'bg-emerald shadow-[0_0_8px_rgba(0,231,158,0.4)] animate-pulse-healthy',
  },
  prevent: {
    label: 'Prevent',
    color: 'amber',
    bgClass: 'bg-amber-dim',
    borderClass: 'border-amber/25',
    textClass: 'text-amber',
    dotClass: 'bg-amber shadow-[0_0_8px_rgba(255,201,60,0.4)]',
  },
  lockdown: {
    label: 'Lockdown',
    color: 'ruby',
    bgClass: 'bg-ruby-dim',
    borderClass: 'border-ruby/25',
    textClass: 'text-ruby',
    dotClass: 'bg-ruby shadow-[0_0_8px_rgba(255,0,93,0.4)] animate-pulse-critical',
  },
};

export function DefenseMode({ mode, onChange }: DefenseModeProps) {
  const config = modeConfig[mode];
  const modes: DefenseModeType[] = ['detect', 'prevent', 'lockdown'];

  const cycleMode = () => {
    if (!onChange) return;
    const currentIndex = modes.indexOf(mode);
    const nextIndex = (currentIndex + 1) % modes.length;
    onChange(modes[nextIndex]);
  };

  return (
    <button
      onClick={cycleMode}
      disabled={!onChange}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors
        ${config.bgClass} ${config.borderClass}
        ${onChange ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
        disabled:opacity-70`}
    >
      <div className={`w-2 h-2 rounded-full ${config.dotClass}`} />
      <span className={`font-mono text-[0.65rem] font-medium uppercase tracking-wide ${config.textClass}`}>
        {config.label}
      </span>
    </button>
  );
}
