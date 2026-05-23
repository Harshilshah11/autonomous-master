'use client';
import { useState } from 'react';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import { Bell, BellOff, AlertTriangle, Info, AlertCircle, X } from 'lucide-react';
import type { Alert, AlertSeverity } from '@/types';

type SeverityFilter = AlertSeverity | 'all';

const SEVERITY_CONFIG = {
  info: { color: 'var(--accent)', bg: 'rgba(0,180,255,0.1)', icon: Info },
  warning: { color: 'var(--accent-yellow)', bg: 'rgba(245,158,11,0.1)', icon: AlertTriangle },
  critical: { color: 'var(--accent-red)', bg: 'rgba(239,68,68,0.1)', icon: AlertCircle },
};

function AlertRow({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-md transition-all"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}20` }}>
      <Icon size={13} style={{ color: cfg.color, marginTop: 2, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
            style={{ background: `${cfg.color}20`, color: cfg.color }}>
            {alert.type}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
            {new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour12: false })}
          </span>
        </div>
        <div className="text-xs" style={{ color: 'var(--text-primary)' }}>{alert.message}</div>
      </div>
      <button onClick={onDismiss} className="shrink-0 opacity-40 hover:opacity-80 transition-opacity">
        <X size={12} style={{ color: 'var(--text-secondary)' }} />
      </button>
    </div>
  );
}

export default function AlertsPage() {
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const { alerts, clearAlerts } = useVehicleStore();

  const counts = {
    all: alerts.length,
    info: alerts.filter((a) => a.severity === 'info').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
  };

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter);

  const dismissById = (id: string) => {
    useVehicleStore.setState((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
  };

  const TABS: { key: SeverityFilter; label: string; color?: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'info', label: 'Info', color: 'var(--accent)' },
    { key: 'warning', label: 'Warning', color: 'var(--accent-yellow)' },
    { key: 'critical', label: 'Critical', color: 'var(--accent-red)' },
  ];

  return (
    <div className="p-4 flex flex-col gap-4 h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Bell size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Alerts &amp; Status Messages</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
            {counts.all} total
          </span>
        </div>
        <button
          onClick={clearAlerts}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all"
          style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-red)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <BellOff size={11} />
          Clear all
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 shrink-0">
        {TABS.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: filter === key ? (color ? `${color}18` : 'var(--accent-glow)') : 'var(--bg-card)',
              border: `1px solid ${filter === key ? (color ?? 'var(--accent)') : 'var(--border-subtle)'}`,
              color: filter === key ? (color ?? 'var(--accent)') : 'var(--text-secondary)',
            }}
          >
            {label}
            <span className="text-[9px] px-1 rounded" style={{ background: 'var(--bg-elevated)' }}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <BellOff size={28} style={{ color: 'var(--text-dim)' }} />
            <span className="text-sm" style={{ color: 'var(--text-dim)' }}>No {filter === 'all' ? '' : filter} alerts</span>
          </div>
        ) : (
          filtered.map((a) => (
            <AlertRow key={a.id} alert={a} onDismiss={() => dismissById(a.id)} />
          ))
        )}
      </div>
    </div>
  );
}
