'use client';

import { ReactNode } from 'react';
import { ConnectionStatus } from './ConnectionStatus';
import { DefenseMode } from './DefenseMode';

interface RubedoShellProps {
  children: ReactNode;
  connected?: boolean;
  defenseMode?: 'detect' | 'prevent' | 'lockdown';
  onDefenseModeChange?: (mode: 'detect' | 'prevent' | 'lockdown') => void;
  title?: string;
  subtitle?: string;
}

export function RubedoShell({
  children,
  connected = false,
  defenseMode = 'detect',
  onDefenseModeChange,
  title = 'RUBEDO',
  subtitle = 'Security Operations',
}: RubedoShellProps) {
  return (
    <div className="min-h-screen bg-bg text-platinum font-mono">
      {/* Ambient Background Effect */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_center,rgba(0,231,158,0.03)_0%,transparent_50%)] animate-[ambient_20s_ease-in-out_infinite]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-emerald text-lg">⬡</span>
                <h1 className="font-display text-xl font-bold tracking-tight text-platinum">
                  {title}
                </h1>
              </div>
              <span className="font-mono text-[0.65rem] text-platinum-dim uppercase tracking-wider">
                {subtitle}
              </span>
            </div>

            {/* Status & Controls */}
            <div className="flex items-center gap-6">
              <ConnectionStatus connected={connected} />
              <DefenseMode mode={defenseMode} onChange={onDefenseModeChange} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-[1800px] mx-auto px-6 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border bg-surface/50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[0.6rem] text-platinum-dim">
                OFFSEC SHIELD
              </span>
              <span className="font-mono text-[0.55rem] text-platinum-faint">
                Cryptographic Proof Ledger
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-[0.55rem] text-platinum-faint">
                ⬡ Civilization Ledger Engine
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface SectionProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Section({ children, title, className = '' }: SectionProps) {
  return (
    <section className={`mb-8 ${className}`}>
      {title && (
        <h2 className="font-mono text-[0.7rem] font-semibold uppercase tracking-wider text-platinum-muted mb-4">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

interface GridProps {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}

const colClasses: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 lg:grid-cols-2',
  3: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
};

export function Grid({ children, cols = 3, className = '' }: GridProps) {
  return (
    <div className={`grid gap-4 ${colClasses[cols]} ${className}`}>
      {children}
    </div>
  );
}

interface PanelProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  maxHeight?: string;
}

export function Panel({
  children,
  title,
  subtitle,
  actions,
  className = '',
  maxHeight,
}: PanelProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-xl overflow-hidden flex flex-col ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2">
          <div>
            {title && (
              <h3 className="font-mono text-[0.75rem] font-semibold text-platinum">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="font-mono text-[0.6rem] text-platinum-dim mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div
        className={`flex-1 p-4 ${maxHeight ? 'overflow-y-auto' : ''}`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
