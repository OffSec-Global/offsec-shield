import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode | string;
  text: string;
}

export function EmptyState({ icon = '⬡', text }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
      <div className="text-2xl mb-2 opacity-30">{icon}</div>
      <span className="font-mono text-[0.8rem] text-platinum-dim">{text}</span>
    </div>
  );
}
