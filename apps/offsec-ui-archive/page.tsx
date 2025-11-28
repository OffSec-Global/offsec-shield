'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type Severity = 'critical' | 'high' | 'medium' | 'low';
type ActionStatus = 'pending' | 'requested' | 'applied' | 'failed' | 'denied';
type AnchorStatus = 'anchored' | 'pending' | 'error';

interface ThreatEvent {
  id: string;
  timestamp: string;
  severity: Severity;
  event_type: string;
  source: string;
  source_host?: string;
  guardian_id?: string;
  guardian_tags?: string[];
  description: string;
  affected: string[];
  metadata?: Record<string, unknown>;
}

interface ActionRequest {
  id?: string;
  action_id?: string;
  event_id?: string;
  action_type: string;
  target: string | Record<string, string>;
  reason: string;
  status?: ActionStatus;
  guardian_id?: string;
  guardian_tags?: string[];
  requested_by?: string;
  ts?: string;
}

interface Receipt {
  id?: string;
  receipt_id?: string;
  action_id?: string;
  timestamp?: string;
  hash?: string;
  proof?: string;
  event_type?: string;
  eventType?: string;
  guardian_id?: string;
}

interface Guardian {
  id: string;
  tags: string[];
  lastSeen: Date;
  events: number;
  actions: number;
  online: boolean;
}

interface ProofBundle {
  leaf: string;
  path: Array<{ sibling: string; position: 'left' | 'right' }>;
  root: string;
  anchor?: {
    root: string;
    ts: string;
    chain: string;
    txid: string;
    status: AnchorStatus;
  };
  receiptId?: string;
  eventType?: string;
  ts?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const API_URL = process.env.NEXT_PUBLIC_OFFSEC_API_URL || 'http://localhost:9115';
const WS_URL = process.env.NEXT_PUBLIC_OFFSEC_WS || 'ws://localhost:9115/offsec/ws';

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════════

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 44 44" fill="none">
    <path 
      d="M22 3L6 10v10c0 11 7 21 16 24 9-3 16-13 16-24V10L22 3z" 
      stroke="currentColor" 
      strokeWidth="1.5"
      className="drop-shadow-[0_0_4px_rgba(0,231,158,0.4)]"
    />
    <circle cx="22" cy="22" r="6" fill="currentColor" className="animate-pulse" />
    <path d="M22 16v12M16 22h12" stroke="var(--bg, #050507)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5a1 1 0 112 0v3a1 1 0 11-2 0V5zm1 7a1 1 0 100-2 1 1 0 000 2z"/>
  </svg>
);

const ShieldSmallIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 1L1 4v4c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V4L8 1z"/>
  </svg>
);

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V2zm2 1v2h8V3H4zm0 4v2h8V7H4zm0 4v2h5v-2H4z"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Defense Mode Indicator
const DefenseMode = ({ active }: { active: boolean }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${
    active 
      ? 'bg-ruby-dim border-ruby/25' 
      : 'bg-emerald-dim border-emerald/25'
  }`}>
    <div className={`w-2 h-2 rounded-full ${
      active 
        ? 'bg-ruby shadow-[0_0_8px_rgba(255,0,93,0.4)] animate-pulse-critical' 
        : 'bg-emerald shadow-[0_0_8px_rgba(0,231,158,0.4)] animate-pulse-healthy'
    }`} />
    <span className={`font-mono text-[0.65rem] font-medium uppercase tracking-wide ${
      active ? 'text-ruby' : 'text-emerald'
    }`}>
      {active ? 'Active Defense' : 'Monitoring'}
    </span>
  </div>
);

// WebSocket Connection Status
const ConnectionStatus = ({ connected }: { connected: boolean }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-1.5 h-1.5 rounded-full ${
      connected 
        ? 'bg-emerald shadow-[0_0_6px_rgba(0,231,158,0.4)]' 
        : 'bg-ruby'
    }`} />
    <span className="font-mono text-[0.6rem] text-platinum-dim uppercase tracking-wide">
      {connected ? 'Connected' : 'Disconnected'}
    </span>
  </div>
);

// Stat Card
const StatCard = ({ 
  label, 
  value, 
  sub, 
  variant 
}: { 
  label: string; 
  value: number | string; 
  sub: string;
  variant?: 'emerald' | 'ruby' | 'amber';
}) => (
  <div className="flex-1 min-w-[140px] p-4 bg-surface border border-border rounded-xl flex flex-col gap-1">
    <span className="font-mono text-[0.6rem] uppercase tracking-widest text-platinum-dim">{label}</span>
    <span className={`font-mono text-[1.75rem] font-semibold ${
      variant === 'emerald' ? 'text-emerald drop-shadow-[0_0_4px_rgba(0,231,158,0.4)]' :
      variant === 'ruby' ? 'text-ruby drop-shadow-[0_0_4px_rgba(255,0,93,0.4)]' :
      variant === 'amber' ? 'text-amber' :
      'text-platinum'
    }`}>{value}</span>
    <span className="font-mono text-[0.7rem] text-platinum-muted">{sub}</span>
  </div>
);

// Card Component
const Card = ({ 
  children, 
  accent,
  className = ''
}: { 
  children: React.ReactNode; 
  accent?: 'emerald' | 'ruby' | 'amber' | 'cyan';
  className?: string;
}) => (
  <div className={`
    bg-surface border border-border rounded-xl overflow-hidden relative 
    transition-colors hover:border-border-strong flex flex-col
    before:absolute before:top-0 before:left-0 before:w-[3px] before:h-full
    ${accent === 'emerald' ? 'before:bg-emerald' : 
      accent === 'ruby' ? 'before:bg-ruby' : 
      accent === 'amber' ? 'before:bg-amber' : 
      accent === 'cyan' ? 'before:bg-cyan' : 
      'before:bg-border'}
    after:content-['⬡'] after:absolute after:bottom-2 after:right-3 
    after:text-[0.6rem] after:text-platinum-faint after:opacity-40
    ${className}
  `}>
    {children}
  </div>
);

const CardHeader = ({ 
  title, 
  icon, 
  badge 
}: { 
  title: string; 
  icon?: React.ReactNode;
  badge?: { text: string; variant?: 'live' | 'warning' | 'critical' };
}) => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2 flex-shrink-0">
    <h2 className="flex items-center gap-2 text-[0.85rem] font-semibold text-platinum">
      {icon && <span className="w-4 h-4 opacity-60">{icon}</span>}
      {title}
    </h2>
    {badge && (
      <span className={`font-mono text-[0.6rem] font-medium uppercase tracking-wide px-2 py-1 rounded-md ${
        badge.variant === 'live' ? 'bg-emerald-dim text-emerald' :
        badge.variant === 'warning' ? 'bg-amber-dim text-amber' :
        badge.variant === 'critical' ? 'bg-ruby-dim text-ruby' :
        'bg-surface-3 text-platinum-muted'
      }`}>
        {badge.text}
      </span>
    )}
  </div>
);

const CardBody = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-4 flex-1 overflow-hidden flex flex-col ${className}`}>{children}</div>
);

// Threat Item
const ThreatItem = ({ threat }: { threat: ThreatEvent }) => {
  const time = new Date(threat.timestamp).toLocaleTimeString();
  const affected = threat.affected?.join(', ') || '—';

  return (
    <div className={`
      flex gap-3 p-3 bg-surface-2 rounded-md border-l-[3px] transition-colors hover:bg-surface-3
      animate-[threat-enter_0.3s_ease-out]
      ${threat.severity === 'critical' ? 'border-l-ruby' :
        threat.severity === 'high' ? 'border-l-amber' :
        threat.severity === 'medium' ? 'border-l-cyan' :
        'border-l-platinum-dim'}
    `}>
      <div className={`
        w-2 h-2 rounded-full flex-shrink-0 mt-1.5
        ${threat.severity === 'critical' ? 'bg-ruby shadow-[0_0_8px_rgba(255,0,93,0.4)] animate-pulse-critical' :
          threat.severity === 'high' ? 'bg-amber shadow-[0_0_6px_rgba(255,201,60,0.4)]' :
          threat.severity === 'medium' ? 'bg-cyan' :
          'bg-platinum-dim'}
      `} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-mono text-[0.75rem] font-semibold text-platinum">{threat.event_type}</span>
          <span className="font-mono text-[0.6rem] text-platinum-dim">{time}</span>
        </div>
        <div className="text-[0.8rem] text-platinum-muted mb-1.5 leading-relaxed">
          {threat.description || 'No description'}
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="font-mono text-[0.6rem] px-1.5 py-0.5 bg-cyan-dim text-cyan rounded-sm">
            {threat.source || 'unknown'}
          </span>
          {threat.guardian_id && (
            <span className="font-mono text-[0.6rem] px-1.5 py-0.5 bg-emerald-dim text-emerald rounded-sm">
              {threat.guardian_id}
            </span>
          )}
          <span className="font-mono text-[0.6rem] px-1.5 py-0.5 bg-surface-3 text-platinum-dim rounded-sm">
            {affected}
          </span>
        </div>
      </div>
    </div>
  );
};

// Action Item
const ActionItem = ({ 
  action, 
  onApprove, 
  onReject 
}: { 
  action: ActionRequest; 
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) => {
  const status = action.status || 'pending';
  const time = action.ts ? new Date(action.ts).toLocaleTimeString() : '—';
  const target = typeof action.target === 'object' ? JSON.stringify(action.target) : action.target;
  const actionId = action.action_id || action.id || '';

  const getTypeClass = () => {
    if (action.action_type?.includes('block')) return 'bg-ruby-dim text-ruby';
    if (action.action_type?.includes('alert')) return 'bg-amber-dim text-amber';
    if (action.action_type?.includes('quarantine')) return 'bg-cyan-dim text-cyan';
    return 'bg-surface-3 text-platinum';
  };

  return (
    <div className={`
      p-3 bg-surface-2 rounded-md border-l-[3px]
      ${status === 'applied' ? 'border-l-emerald' :
        status === 'failed' || status === 'denied' ? 'border-l-ruby' :
        'border-l-amber'}
    `}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-mono text-[0.7rem] font-semibold px-2 py-0.5 rounded-md ${getTypeClass()}`}>
          {action.action_type?.replace('offsec.action.', '').replace(/_/g, ' ') || 'unknown'}
        </span>
        <span className={`font-mono text-[0.6rem] uppercase tracking-wide ${
          status === 'applied' ? 'text-emerald' :
          status === 'failed' || status === 'denied' ? 'text-ruby' :
          'text-amber'
        }`}>
          {status}
        </span>
      </div>
      <div className="font-mono text-[0.8rem] text-platinum mb-1">{target || '—'}</div>
      <div className="text-[0.75rem] text-platinum-muted mb-2">{action.reason || 'No reason provided'}</div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.6rem] text-platinum-dim">{time}</span>
        {(status === 'pending' || status === 'requested') && (
          <div className="flex gap-1">
            <button 
              onClick={() => onApprove(actionId)}
              className="font-mono text-[0.6rem] font-medium uppercase tracking-wide px-2.5 py-1 
                border border-border rounded-md bg-transparent text-platinum-muted
                hover:border-emerald hover:text-emerald hover:bg-emerald-dim transition-colors"
            >
              Approve
            </button>
            <button 
              onClick={() => onReject(actionId)}
              className="font-mono text-[0.6rem] font-medium uppercase tracking-wide px-2.5 py-1 
                border border-border rounded-md bg-transparent text-platinum-muted
                hover:border-ruby hover:text-ruby hover:bg-ruby-dim transition-colors"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Receipt Item
const ReceiptItem = ({ 
  receipt, 
  onView, 
  onDownload 
}: { 
  receipt: Receipt; 
  onView: (id: string) => void;
  onDownload: (id: string) => void;
}) => {
  const id = receipt.id || receipt.receipt_id || '—';
  const shortId = id.length > 20 ? id.substring(0, 20) + '...' : id;
  const time = receipt.timestamp ? new Date(receipt.timestamp).toLocaleTimeString() : '—';
  const eventType = receipt.event_type || receipt.eventType || '—';

  return (
    <div 
      className="flex items-center gap-2 px-2.5 py-2 bg-surface-2 rounded-md cursor-pointer 
        transition-colors hover:bg-surface-3"
      onClick={() => onView(id)}
    >
      <div className="w-2 h-2 rounded-sm bg-emerald flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[0.7rem] text-platinum truncate">{shortId}</div>
        <div className="font-mono text-[0.6rem] text-platinum-dim">{eventType}</div>
      </div>
      <span className="font-mono text-[0.55rem] text-platinum-dim flex-shrink-0">{time}</span>
      <button 
        onClick={(e) => { e.stopPropagation(); onDownload(id); }}
        className="font-mono text-[0.55rem] px-1.5 py-0.5 border border-border rounded-sm 
          bg-transparent text-platinum-dim hover:border-emerald hover:text-emerald transition-colors flex-shrink-0"
      >
        ↓
      </button>
    </div>
  );
};

// Guardian Card
const GuardianCard = ({ guardian }: { guardian: Guardian }) => (
  <div className={`
    p-4 bg-surface border border-border rounded-xl border-l-[3px]
    ${guardian.online ? 'border-l-emerald' : 'border-l-ruby opacity-70'}
  `}>
    <div className="flex items-center justify-between mb-2">
      <span className="font-mono text-[0.85rem] font-semibold text-platinum">{guardian.id}</span>
      <div className="flex items-center gap-1">
        <div className={`w-1.5 h-1.5 rounded-full ${
          guardian.online 
            ? 'bg-emerald shadow-[0_0_6px_rgba(0,231,158,0.4)]' 
            : 'bg-ruby shadow-[0_0_6px_rgba(255,0,93,0.4)]'
        }`} />
        <span className={`font-mono text-[0.6rem] uppercase ${
          guardian.online ? 'text-emerald' : 'text-ruby'
        }`}>
          {guardian.online ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
    <div className="flex gap-1 flex-wrap mb-2">
      {guardian.tags.length > 0 ? guardian.tags.map((tag, i) => (
        <span key={i} className="font-mono text-[0.55rem] px-1.5 py-0.5 bg-surface-3 rounded-sm text-platinum-dim">
          {tag}
        </span>
      )) : (
        <span className="font-mono text-[0.55rem] px-1.5 py-0.5 bg-surface-3 rounded-sm text-platinum-dim">
          no tags
        </span>
      )}
    </div>
    <div className="flex gap-4">
      <div className="flex flex-col">
        <span className="font-mono text-[0.5rem] uppercase tracking-wide text-platinum-dim">Events</span>
        <span className="font-mono text-base font-semibold text-platinum">{guardian.events}</span>
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-[0.5rem] uppercase tracking-wide text-platinum-dim">Actions</span>
        <span className="font-mono text-base font-semibold text-platinum">{guardian.actions}</span>
      </div>
    </div>
  </div>
);

// Empty State
const EmptyState = ({ icon, text }: { icon: string; text: string }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
    <div className="text-2xl mb-2 opacity-30">{icon}</div>
    <span className="font-mono text-[0.8rem] text-platinum-dim">{text}</span>
  </div>
);

// Loading State
const Loading = ({ text }: { text: string }) => (
  <div className="font-mono text-[0.8rem] text-platinum-dim text-center py-6 animate-pulse">
    {text}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function OffSecShieldConsole() {
  // State
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [actions, setActions] = useState<ActionRequest[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [guardians, setGuardians] = useState<Map<string, Guardian>>(new Map());
  const [merkleRoot, setMerkleRoot] = useState<string>('—');
  const [anchorStatus, setAnchorStatus] = useState<AnchorStatus>('pending');
  const [wsConnected, setWsConnected] = useState(false);
  const [defenseActive, setDefenseActive] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    threats: 0,
    actions: 0,
    blocked: 0,
    receipts: 0
  });

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setWsConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setWsConnected(false);
      attemptReconnect();
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };
  }, []);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current < 10) {
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      setTimeout(connectWebSocket, delay);
    }
  }, [connectWebSocket]);

  const handleWebSocketMessage = useCallback((message: { type: string; data: unknown }) => {
    const { type, data } = message;

    switch (type) {
      case 'threat_event':
        handleThreatEvent(data as ThreatEvent);
        break;
      case 'offsec.action.requested':
      case 'action_update':
        handleActionUpdate(data as ActionRequest);
        break;
      case 'offsec.action.result':
        handleActionResult(data as ActionRequest);
        break;
      case 'receipt':
        handleReceipt(data as Receipt);
        break;
      default:
        console.log('[WS] Unknown message type:', type);
    }
  }, []);

  // Event handlers
  const handleThreatEvent = useCallback((threat: ThreatEvent) => {
    setThreats(prev => [threat, ...prev].slice(0, 100));
    setStats(prev => ({ ...prev, threats: prev.threats + 1 }));

    if (threat.severity === 'critical') {
      setDefenseActive(true);
    }

    if (threat.guardian_id) {
      setGuardians(prev => {
        const updated = new Map(prev);
        const existing = updated.get(threat.guardian_id!) || {
          id: threat.guardian_id!,
          tags: [],
          lastSeen: new Date(),
          events: 0,
          actions: 0,
          online: true
        };
        updated.set(threat.guardian_id!, {
          ...existing,
          tags: threat.guardian_tags || existing.tags,
          lastSeen: new Date(),
          events: existing.events + 1,
          online: true
        });
        return updated;
      });
    }
  }, []);

  const handleActionUpdate = useCallback((action: ActionRequest) => {
    setActions(prev => {
      const idx = prev.findIndex(a => 
        (a.action_id || a.id) === (action.action_id || action.id)
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...action };
        return updated;
      }
      return [action, ...prev];
    });
  }, []);

  const handleActionResult = useCallback((result: ActionRequest) => {
    setActions(prev => prev.map(a => 
      (a.action_id || a.id) === result.action_id 
        ? { ...a, status: result.status }
        : a
    ));
    
    if (result.status === 'applied') {
      setStats(prev => ({
        ...prev,
        actions: prev.actions + 1,
        blocked: result.action_type?.includes('block_ip') ? prev.blocked + 1 : prev.blocked
      }));
    }
  }, []);

  const handleReceipt = useCallback((receipt: Receipt) => {
    setReceipts(prev => [receipt, ...prev].slice(0, 100));
    setStats(prev => ({ ...prev, receipts: prev.receipts + 1 }));
  }, []);

  // Action handlers
  const approveAction = async (actionId: string) => {
    console.log('Approving action:', actionId);
    // POST to /offsec/action/approve
  };

  const rejectAction = async (actionId: string) => {
    console.log('Rejecting action:', actionId);
    // POST to /offsec/action/reject
  };

  const viewProof = (id: string) => {
    console.log('Viewing proof:', id);
  };

  const downloadProof = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/offsec/proof/${id}`);
      if (!res.ok) throw new Error('Failed to fetch proof');
      const proof = await res.json();
      
      const blob = new Blob([JSON.stringify(proof, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `offsec-proof-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const quickAction = (actionType: string) => {
    const target = prompt(`Enter target for ${actionType}:`);
    if (!target) return;
    console.log('Quick action:', actionType, target);
    // POST to /offsec/action/apply
  };

  // Initial data load
  const loadInitialData = useCallback(async () => {
    try {
      // Load receipts
      const receiptsRes = await fetch(`${API_URL}/offsec/receipts?limit=20`);
      if (receiptsRes.ok) {
        const data = await receiptsRes.json();
        setReceipts(Array.isArray(data) ? data : []);
        setStats(prev => ({ ...prev, receipts: data.length || 0 }));
      }

      // Load root
      const rootRes = await fetch(`${API_URL}/offsec/root`);
      if (rootRes.ok) {
        const data = await rootRes.json();
        const root = data.root || data;
        if (root && typeof root === 'string') {
          setMerkleRoot(root.length > 16 ? root.substring(0, 16) + '...' : root);
        }
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, []);

  // Effects
  useEffect(() => {
    connectWebSocket();
    loadInitialData();

    const interval = setInterval(loadInitialData, 30000);

    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [connectWebSocket, loadInitialData]);

  // Computed
  const pendingActions = actions.filter(a => a.status === 'pending' || a.status === 'requested');
  const onlineGuardians = Array.from(guardians.values()).filter(g => g.online).length;

  return (
    <div className="min-h-screen bg-bg text-platinum font-display relative">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_20%,rgba(0,231,158,0.08)_0%,transparent_50%),radial-gradient(ellipse_60%_50%_at_80%_80%,rgba(255,0,93,0.08)_0%,transparent_40%)] opacity-50 animate-ambient" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      {/* Console */}
      <div className="relative z-10 max-w-[1600px] mx-auto p-6">
        {/* Header */}
        <header className="flex items-center justify-between pb-5 mb-6 border-b border-border relative">
          <div className="absolute bottom-[-1px] left-0 w-[200px] h-[1px] bg-gradient-to-r from-emerald to-transparent" />
          
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 text-emerald">
              <ShieldIcon />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                OffSec <span className="text-emerald">Shield</span>
              </h1>
              <span className="font-mono text-[0.7rem] text-platinum-dim uppercase tracking-widest">
                Security Operations Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <DefenseMode active={defenseActive} />
            <ConnectionStatus connected={wsConnected} />
          </div>
        </header>

        {/* Stats Bar */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <StatCard label="Threats Detected" value={stats.threats} sub="Last 24h" />
          <StatCard label="Actions Executed" value={stats.actions} sub="Autonomous + Manual" variant="emerald" />
          <StatCard label="Blocked IPs" value={stats.blocked} sub="Active blocks" variant="ruby" />
          <StatCard label="Receipts" value={stats.receipts} sub="Merkle proofs" />
          <StatCard label="Guardians" value={onlineGuardians} sub="Online" variant="emerald" />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_380px] gap-4">
          {/* Threat Stream */}
          <Card accent="ruby">
            <CardHeader 
              title="Threat Stream" 
              icon={<AlertIcon className="w-4 h-4" />}
              badge={{ text: 'Live', variant: 'live' }}
            />
            <CardBody>
              <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto flex-1 scrollbar-thin">
                {threats.length === 0 ? (
                  <Loading text="Awaiting threat events..." />
                ) : (
                  threats.slice(0, 50).map((threat, i) => (
                    <ThreatItem key={threat.id || i} threat={threat} />
                  ))
                )}
              </div>
            </CardBody>
          </Card>

          {/* Action Panel */}
          <Card accent="amber">
            <CardHeader 
              title="Action Panel" 
              icon={<ShieldSmallIcon className="w-4 h-4" />}
              badge={{ text: `${pendingActions.length} pending` }}
            />
            <CardBody>
              <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto flex-1 scrollbar-thin">
                {actions.length === 0 ? (
                  <EmptyState icon="⬡" text="No pending actions" />
                ) : (
                  actions.slice(0, 30).map((action, i) => (
                    <ActionItem 
                      key={action.action_id || action.id || i} 
                      action={action}
                      onApprove={approveAction}
                      onReject={rejectAction}
                    />
                  ))
                )}
              </div>
              <div className="flex gap-2 pt-3 border-t border-border mt-auto">
                <button 
                  onClick={() => quickAction('block_ip')}
                  className="flex-1 font-mono text-[0.65rem] font-medium uppercase tracking-wide 
                    py-2 px-3 border border-border rounded-md bg-surface-2 text-platinum-muted
                    hover:border-ruby hover:text-ruby hover:bg-ruby-dim transition-colors"
                >
                  Block IP
                </button>
                <button 
                  onClick={() => quickAction('alert_human')}
                  className="flex-1 font-mono text-[0.65rem] font-medium uppercase tracking-wide 
                    py-2 px-3 border border-border rounded-md bg-surface-2 text-platinum-muted
                    hover:border-ruby hover:text-ruby hover:bg-ruby-dim transition-colors"
                >
                  Alert SOC
                </button>
                <button 
                  onClick={() => quickAction('quarantine')}
                  className="flex-1 font-mono text-[0.65rem] font-medium uppercase tracking-wide 
                    py-2 px-3 border border-border rounded-md bg-surface-2 text-platinum-muted
                    hover:border-ruby hover:text-ruby hover:bg-ruby-dim transition-colors"
                >
                  Quarantine
                </button>
              </div>
            </CardBody>
          </Card>

          {/* Proof Ledger */}
          <Card accent="emerald" className="xl:col-span-1 lg:col-span-2">
            <CardHeader 
              title="Proof Ledger" 
              icon={<DocumentIcon className="w-4 h-4" />}
              badge={{ text: 'Merkle', variant: 'live' }}
            />
            <CardBody>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[0.55rem] uppercase tracking-widest text-platinum-dim">Current Root</span>
                  <span className="font-mono text-[0.7rem] text-emerald drop-shadow-[0_0_2px_rgba(0,231,158,0.4)]">
                    {merkleRoot}
                  </span>
                </div>
                <span className={`font-mono text-[0.55rem] uppercase tracking-wide px-2 py-0.5 rounded-md ${
                  anchorStatus === 'anchored' ? 'bg-emerald-dim text-emerald' : 'bg-amber-dim text-amber'
                }`}>
                  {anchorStatus}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto flex-1 scrollbar-thin">
                {receipts.length === 0 ? (
                  <EmptyState icon="◇" text="No receipts yet" />
                ) : (
                  receipts.slice(0, 50).map((receipt, i) => (
                    <ReceiptItem 
                      key={receipt.id || receipt.receipt_id || i} 
                      receipt={receipt}
                      onView={viewProof}
                      onDownload={downloadProof}
                    />
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Guardian Status */}
        {guardians.size > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
            {Array.from(guardians.values()).map(guardian => (
              <GuardianCard key={guardian.id} guardian={guardian} />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[0.65rem] text-platinum-dim tracking-wide">
              OffSec Shield • Defense without proof is theater
            </span>
            <span className="font-mono text-[0.6rem] px-2 py-0.5 bg-surface-2 rounded-md text-platinum-muted">
              v0.1.0
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/offsec/receipts" target="_blank" className="font-mono text-[0.6rem] text-platinum-dim hover:text-emerald transition-colors">
              API
            </a>
            <a href="#" className="font-mono text-[0.6rem] text-platinum-dim hover:text-emerald transition-colors">
              Docs
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
