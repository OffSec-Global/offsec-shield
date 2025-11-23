import { ReactNode } from 'react';

type PanelProps = {
  title: string;
  rightSlot?: ReactNode;
  children: ReactNode;
};

export function Panel({ title, rightSlot, children }: PanelProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">{title}</div>
        {rightSlot ? <div className="panel-meta">{rightSlot}</div> : null}
      </div>
      {children}
    </div>
  );
}
