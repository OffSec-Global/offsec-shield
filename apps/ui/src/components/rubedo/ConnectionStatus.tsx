interface ConnectionStatusProps {
  connected: boolean;
}

export function ConnectionStatus({ connected }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-1.5 h-1.5 rounded-full ${
          connected
            ? 'bg-emerald shadow-[0_0_6px_rgba(0,231,158,0.4)]'
            : 'bg-ruby'
        }`}
      />
      <span className="font-mono text-[0.6rem] text-platinum-dim uppercase tracking-wide">
        {connected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
}
