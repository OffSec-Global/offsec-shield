interface LoadingProps {
  text?: string;
}

export function Loading({ text = 'Loading...' }: LoadingProps) {
  return (
    <div className="font-mono text-[0.8rem] text-platinum-dim text-center py-6 animate-loading">
      {text}
    </div>
  );
}
