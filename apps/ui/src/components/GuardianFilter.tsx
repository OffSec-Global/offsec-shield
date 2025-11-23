import React from 'react';

type Props = {
  guardians: string[];
  selected: string | 'all';
  onSelect: (id: string | 'all') => void;
};

export function GuardianFilter({ guardians, selected, onSelect }: Props) {
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 10px',
    borderRadius: '12px',
    border: '1px solid rgba(0, 255, 145, 0.5)',
    background: active ? 'rgba(0, 255, 145, 0.16)' : 'transparent',
    color: active ? '#0cf' : '#0f8',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  });

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
      <span className="muted" style={{ marginRight: '4px' }}>Guardian</span>
      <button style={pillStyle(selected === 'all')} onClick={() => onSelect('all')}>
        All
      </button>
      {guardians.map((g) => (
        <button
          key={g}
          style={pillStyle(selected === g)}
          onClick={() => onSelect(g)}
          title="Scope dashboards to this guardian"
        >
          {g}
        </button>
      ))}
    </div>
  );
}
