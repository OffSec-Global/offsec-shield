type Props = {
  guardians: string[];
  selected: string | 'all';
  onSelect: (id: string | 'all') => void;
};

export function GuardianFilter({ guardians, selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 flex-wrap items-center">
      <span className="font-mono text-[0.65rem] text-platinum-dim uppercase tracking-wide mr-1">
        Guardian
      </span>
      <button
        onClick={() => onSelect('all')}
        className={`font-mono text-[0.7rem] font-semibold px-3 py-1.5 rounded-full border transition-colors
          ${
            selected === 'all'
              ? 'bg-emerald-dim border-emerald/50 text-emerald'
              : 'bg-transparent border-border text-platinum-muted hover:border-emerald/30 hover:text-emerald'
          }`}
      >
        All
      </button>
      {guardians.map((g) => (
        <button
          key={g}
          onClick={() => onSelect(g)}
          title="Scope dashboards to this guardian"
          className={`font-mono text-[0.7rem] font-semibold px-3 py-1.5 rounded-full border transition-colors
            ${
              selected === g
                ? 'bg-emerald-dim border-emerald/50 text-emerald'
                : 'bg-transparent border-border text-platinum-muted hover:border-emerald/30 hover:text-emerald'
            }`}
        >
          {g}
        </button>
      ))}
    </div>
  );
}
