'use client';
import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import { GET_SESSIONS } from '@/lib/graphql/queries';
import toast from 'react-hot-toast';
import { Settings, Wifi, BellRing, Map, Clock, Download, CheckCircle, XCircle } from 'lucide-react';
import type { Session, GetSessionsResponse } from '@/types';

type Tab = 'connection' | 'thresholds' | 'display' | 'sessions';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="gcs-card p-5 space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</div>
        {hint && <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Input({ value, onChange, type = 'text' }: { value: string | number; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md px-3 py-1.5 text-sm font-mono outline-none w-36"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-primary)',
      }}
      onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
      onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
    />
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-all"
      style={{ background: checked ? 'var(--accent)' : 'var(--bg-elevated)', border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-default)'}` }}
    >
      <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
        style={{ background: 'white', left: checked ? '20px' : '2px' }} />
    </button>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('connection');
  const { settings, updateSettings } = useVehicleStore();
  const [localSettings, setLocalSettings] = useState(settings);

  const { data: sessionsData } = useQuery<GetSessionsResponse>(GET_SESSIONS);
  const sessions: Session[] = sessionsData?.sessions ?? [];

  function patch(key: keyof typeof localSettings, value: string | number | boolean) {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  }

  function saveSettings() {
    updateSettings(localSettings);
    toast.success('Settings saved');
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'connection', label: 'Connection', icon: Wifi },
    { key: 'thresholds', label: 'Thresholds', icon: BellRing },
    { key: 'display', label: 'Display', icon: Map },
    { key: 'sessions', label: 'Sessions', icon: Clock },
  ];

  return (
    <div className="p-4 flex flex-col gap-4 h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <Settings size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Settings &amp; Configuration</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 shrink-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-all"
            style={{
              background: tab === key ? 'var(--accent-glow)' : 'var(--bg-card)',
              border: `1px solid ${tab === key ? 'var(--accent)' : 'var(--border-subtle)'}`,
              color: tab === key ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
        {tab === 'connection' && (
          <>
            <Section title="Jetson Connection">
              <Field label="IP Address" hint="Local WiFi IP of the Jetson Orin">
                <Input value={localSettings.ip} onChange={(v) => patch('ip', v)} />
              </Field>
              <Field label="Port" hint="FastAPI server port">
                <Input value={localSettings.port} type="number" onChange={(v) => patch('port', Number(v))} />
              </Field>
              <Field label="Reconnect Interval" hint="Seconds between reconnect attempts">
                <Input value={localSettings.reconnectInterval} type="number" onChange={(v) => patch('reconnectInterval', Number(v))} />
              </Field>
            </Section>
            <div className="px-1 py-2 rounded-md text-xs"
              style={{ background: 'rgba(0,180,255,0.06)', border: '1px solid rgba(0,180,255,0.15)', color: 'var(--text-secondary)' }}>
              Currently connecting to: <span className="font-mono" style={{ color: 'var(--accent)' }}>
                {settings.ip}:{settings.port}
              </span>
            </div>
          </>
        )}

        {tab === 'thresholds' && (
          <Section title="Alert Thresholds">
            <Field label="Battery Warning" hint="Alert when battery drops below this %">
              <div className="flex items-center gap-2">
                <Input value={localSettings.batteryThreshold} type="number" onChange={(v) => patch('batteryThreshold', Number(v))} />
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>%</span>
              </div>
            </Field>
            <Field label="Speed Warning" hint="Alert when speed exceeds this value">
              <div className="flex items-center gap-2">
                <Input value={localSettings.speedThreshold} type="number" onChange={(v) => patch('speedThreshold', Number(v))} />
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>m/s</span>
              </div>
            </Field>
          </Section>
        )}

        {tab === 'display' && (
          <>
            <Section title="Map">
              <Field label="Map Style">
                <select
                  value={localSettings.mapStyle}
                  onChange={(e) => patch('mapStyle', e.target.value)}
                  className="rounded-md px-3 py-1.5 text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                >
                  <option value="dark">Dark Matter</option>
                  <option value="street">Street</option>
                </select>
              </Field>
              <Field label="Show Breadcrumb Trail">
                <Toggle checked={localSettings.showBreadcrumb} onChange={(v) => patch('showBreadcrumb', v)} />
              </Field>
              <Field label="Show Geofence">
                <Toggle checked={localSettings.showGeofence} onChange={(v) => patch('showGeofence', v)} />
              </Field>
            </Section>
            <Section title="Chart">
              <Field label="Refresh Rate" hint="Telemetry chart update interval">
                <div className="flex items-center gap-2">
                  <Input value={localSettings.chartRefreshMs} type="number" onChange={(v) => patch('chartRefreshMs', Number(v))} />
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>ms</span>
                </div>
              </Field>
            </Section>
          </>
        )}

        {tab === 'sessions' && (
          <div className="gcs-card overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Mission History
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{sessions.length} sessions</span>
            </div>
            {sessions.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: 'var(--text-dim)' }}>No sessions recorded</div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {sessions.map((s: Session) => (
                  <div key={s.id} className="px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                      <div className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
                        {new Date(s.date).toLocaleDateString('en-IN')} · {s.duration} · {s.waypoints} WP · {s.distance}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.status === 'completed'
                        ? <CheckCircle size={13} style={{ color: 'var(--accent-green)' }} />
                        : <XCircle size={13} style={{ color: 'var(--accent-red)' }} />
                      }
                      <span className="text-[10px] capitalize"
                        style={{ color: s.status === 'completed' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {s.status}
                      </span>
                    </div>
                    <button className="p-1.5 rounded" title="Download log"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}
                      onClick={() => toast.success(`Downloading ${s.name} log…`)}>
                      <Download size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save button (not on sessions tab) */}
      {tab !== 'sessions' && (
        <div className="shrink-0">
          <button
            onClick={saveSettings}
            className="px-6 py-2 rounded-md text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            Save Settings
          </button>
        </div>
      )}
    </div>
  );
}
