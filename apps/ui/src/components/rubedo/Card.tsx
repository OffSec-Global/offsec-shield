import { ReactNode } from 'react';

type CardAccent = 'emerald' | 'ruby' | 'amber' | 'cyan';

interface CardProps {
  children: ReactNode;
  accent?: CardAccent;
  className?: string;
}

const accentClasses: Record<CardAccent, string> = {
  emerald: 'before:bg-emerald',
  ruby: 'before:bg-ruby',
  amber: 'before:bg-amber',
  cyan: 'before:bg-cyan',
};

export function Card({ children, accent, className = '' }: CardProps) {
  return (
    <div
      className={`
        bg-surface border border-border rounded-xl overflow-hidden relative
        transition-colors hover:border-border-strong flex flex-col
        before:absolute before:top-0 before:left-0 before:w-[3px] before:h-full
        ${accent ? accentClasses[accent] : 'before:bg-border'}
        after:content-['⬡'] after:absolute after:bottom-2 after:right-3
        after:text-[0.6rem] after:text-platinum-faint after:opacity-40
        ${className}
      `}
    >
      {children}
    </div>
  );
}

type BadgeVariant = 'live' | 'warning' | 'critical' | 'default';

interface CardHeaderProps {
  title: string;
  icon?: ReactNode;
  badge?: { text: string; variant?: BadgeVariant };
  rightSlot?: ReactNode;
}

const badgeClasses: Record<BadgeVariant, string> = {
  live: 'bg-emerald-dim text-emerald',
  warning: 'bg-amber-dim text-amber',
  critical: 'bg-ruby-dim text-ruby',
  default: 'bg-surface-3 text-platinum-muted',
};

export function CardHeader({ title, icon, badge, rightSlot }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2 flex-shrink-0">
      <h2 className="flex items-center gap-2 text-[0.85rem] font-semibold text-platinum">
        {icon && <span className="w-4 h-4 opacity-60">{icon}</span>}
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {badge && (
          <span
            className={`font-mono text-[0.6rem] font-medium uppercase tracking-wide px-2 py-1 rounded-md ${
              badgeClasses[badge.variant || 'default']
            }`}
          >
            {badge.text}
          </span>
        )}
        {rightSlot}
      </div>
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={`p-4 flex-1 flex flex-col ${className}`}>{children}</div>;
}
