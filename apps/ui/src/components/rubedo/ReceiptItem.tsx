import type { Receipt } from '@/types/receipts';

interface ReceiptItemProps {
  receipt: Receipt;
  isActive?: boolean;
  onView?: (id: string) => void;
  onDownload?: (id: string) => void;
}

export function ReceiptItem({
  receipt,
  isActive,
  onView,
  onDownload,
}: ReceiptItemProps) {
  const id = receipt.id || receipt.receipt_id || '-';
  const shortId = id.length > 20 ? id.substring(0, 20) + '...' : id;
  const time = receipt.timestamp || receipt.ts
    ? new Date(receipt.timestamp || receipt.ts!).toLocaleTimeString()
    : '-';
  const eventType = receipt.event_type || '-';

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 bg-surface-2 rounded-md cursor-pointer
        transition-colors hover:bg-surface-3
        ${isActive ? 'border-l-[3px] border-l-emerald shadow-[0_0_0_1px_rgba(0,231,158,0.2)]' : ''}
      `}
      onClick={() => onView?.(id)}
    >
      {/* Status Dot */}
      <div className="w-2 h-2 rounded-sm bg-emerald flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[0.7rem] text-platinum truncate">{shortId}</div>
        <div className="font-mono text-[0.6rem] text-platinum-dim">{eventType}</div>
      </div>

      {/* Time */}
      <span className="font-mono text-[0.55rem] text-platinum-dim flex-shrink-0">
        {time}
      </span>

      {/* Download Button */}
      {onDownload && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload(id);
          }}
          className="font-mono text-[0.55rem] px-1.5 py-0.5 border border-border rounded-sm
            bg-transparent text-platinum-dim hover:border-emerald hover:text-emerald transition-colors flex-shrink-0"
        >
          ↓
        </button>
      )}
    </div>
  );
}
