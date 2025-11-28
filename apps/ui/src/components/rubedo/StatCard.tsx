type StatVariant = 'emerald' | 'ruby' | 'amber' | 'default';

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  variant?: StatVariant;
}

const variantClasses: Record<StatVariant, string> = {
  emerald: 'text-emerald drop-shadow-[0_0_4px_rgba(0,231,158,0.4)]',
  ruby: 'text-ruby drop-shadow-[0_0_4px_rgba(255,0,93,0.4)]',
  amber: 'text-amber drop-shadow-[0_0_4px_rgba(255,201,60,0.4)]',
  default: 'text-platinum',
};

export function StatCard({ label, value, sub, variant = 'default' }: StatCardProps) {
  return (
    <div className="flex-1 min-w-[140px] p-4 bg-surface border border-border rounded-xl flex flex-col gap-1">
      <span className="font-mono text-[0.6rem] uppercase tracking-widest text-platinum-dim">
        {label}
      </span>
      <span className={`font-mono text-[1.75rem] font-semibold ${variantClasses[variant]}`}>
        {value}
      </span>
      {sub && (
        <span className="font-mono text-[0.7rem] text-platinum-muted">{sub}</span>
      )}
    </div>
  );
}

interface StatGridProps {
  children: React.ReactNode;
}

export function StatGrid({ children }: StatGridProps) {
  return <div className="flex gap-4 mb-6 flex-wrap">{children}</div>;
}
