type BadgeProps = {
  tone?: 'critical' | 'high' | 'medium' | 'low' | 'neutral';
  children: string;
};

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`severity-badge severity-${tone}`}>{children}</span>;
}
