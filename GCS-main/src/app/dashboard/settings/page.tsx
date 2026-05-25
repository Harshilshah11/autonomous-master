'use client';
import { useEffect, useState } from 'react';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import toast from 'react-hot-toast';
import { Settings, Wifi, BellRing, Map, Clock, Download, CheckCircle, XCircle, Cable, Plug, Cctv, Cpu, RefreshCw, Satellite, Usb, Radio as RadioIcon, Gauge } from 'lucide-react';
import type { Session, Transport, CameraFeed } from '@/types';
import { ping, fetchDeviceStatus } from '@/lib/api/commands';

type Tab = 'connection' | 'devices' | 'thresholds' | 'display' | 'camera' | 'sessions';

interface UsbDevice { connected: boolean; port: string | null; name: string; }
interface GpsDevice { connected: boolean; fix: string | null; satellites: number; reason?: string; }
interface ImuDevice { connected: boolean; yaw: number | null; telemetry_rate_hz?: number; reason?: string; }
interface DeviceSnapshot {
  ts: string;
  devices: {
    controller: UsbDevice;
    lidar:      UsbDevice;
    gcs_link:   UsbDevice;
    gps:        GpsDevice;
    imu:        ImuDevice;
  };
}

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

function Input({
  value, onChange, type = 'text', wide = false, placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  wide?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md px-3 py-1.5 text-sm font-mono outline-none ${wide ? 'w-full' : 'w-44'}`}
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

function TransportButton({
  active, icon: Icon, label, hint, onClick,
}: { active: boolean; icon: React.ElementType; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-1.5 p-4 rounded-md transition-all"
      style={{
        background: active ? 'var(--accent-glow)' : 'var(--bg-elevated)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
      }}
    >
      <Icon size={18} />
      <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{hint}</span>
    </button>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('connection');
  const { settings, updateSettings } = useVehicleStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [deviceSnapshot, setDeviceSnapshot] = useState<DeviceSnapshot | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);

  // Mission history is a future feature — keep a local empty list for now.
  const sessions: Session[] = [];

  // Keep local state in sync if store changes from elsewhere.
  useEffect(() => { setLocalSettings(settings); }, [settings]);

  async function refreshDeviceStatus() {
    setDeviceLoading(true);
    setDeviceError(null);
    try {
      const res = await fetchDeviceStatus();
      if (res.ok && res.ts && res.devices) {
        setDeviceSnapshot(res as unknown as DeviceSnapshot);
      } else {
        setDeviceError(res.detail ?? `Server error ${res.status}`);
        setDeviceSnapshot(null);
      }
    } catch (e) {
      setDeviceError((e as Error).message || 'Unreachable');
      setDeviceSnapshot(null);
    } finally {
      setDeviceLoading(false);
    }
  }

  // Fetch once when the Devices tab is first opened.
  useEffect(() => {
    if (tab !== 'devices') return;
    refreshDeviceStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function patch<K extends keyof typeof localSettings>(key: K, value: (typeof localSettings)[K]) {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  }

  function saveSettings() {
    updateSettings(localSettings);
    // Push UART config to the local bridge as well, so a switch from WiFi to
    // UART (or a device change) takes effect immediately on the next request.
    if (localSettings.transport === 'uart') {
      fetch('/api/uart-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: localSettings.uartDevice, baud: localSettings.uartBaud }),
      }).catch(() => { /* bridge may be down — surfaced via connection chip */ });
    }
    toast.success('Settings saved');
  }

  async function testConnection() {
    setProbing(true);
    setProbeResult(null);
    try {
      // Save first so the api client picks up the new transport/host.
      updateSettings(localSettings);
      const res = await ping();
      setProbeResult({ ok: res.ok, msg: res.ok ? (res.detail ?? 'pong') : `status ${res.status}` });
    } catch (e) {
      setProbeResult({ ok: false, msg: (e as Error).message || 'unreachable' });
    } finally {
      setProbing(false);
    }
  }

  function patchCameraFeed(id: string, key: keyof CameraFeed, value: string | boolean) {
    setLocalSettings((prev) => ({
      ...prev,
      cameraFeeds: (prev.cameraFeeds ?? []).map((f) =>
        f.id === id ? { ...f, [key]: value } : f
      ),
    }));
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'connection', label: 'Connection', icon: Wifi },
    { key: 'devices',    label: 'Devices',    icon: Cpu },
    { key: 'thresholds', label: 'Thresholds', icon: BellRing },
    { key: 'display',    label: 'Display',    icon: Map },
    { key: 'camera',     label: 'Camera',     icon: Cctv },
    { key: 'sessions',   label: 'Sessions',   icon: Clock },
  ];

  const transportLabel = settings.transport === 'wifi'
    ? `WiFi · ${settings.ip}:${settings.port}`
    : `UART · ${settings.uartDevice} @ ${settings.uartBaud}`;

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
            <Section title="Transport">
              <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                Choose how the GCS reaches the Jetson. Both transports speak the same request/response API.
              </div>
              <div className="flex gap-3">
                <TransportButton
                  active={localSettings.transport === 'wifi'}
                  icon={Wifi}
                  label="WiFi"
                  hint="HTTP to Jetson"
                  onClick={() => patch('transport', 'wifi' as Transport)}
                />
                <TransportButton
                  active={localSettings.transport === 'uart'}
                  icon={Cable}
                  label="UART"
                  hint="Serial via local bridge"
                  onClick={() => patch('transport', 'uart' as Transport)}
                />
              </div>
            </Section>

            {localSettings.transport === 'wifi' && (
              <Section title="WiFi (Jetson HTTP)">
                <Field label="IP Address" hint="Local WiFi IP of the Jetson Orin">
                  <Input value={localSettings.ip} onChange={(v) => patch('ip', v)} />
                </Field>
                <Field label="Port" hint="Flask server port (gcs_data_handler)">
                  <Input value={localSettings.port} type="number" onChange={(v) => patch('port', Number(v))} />
                </Field>
              </Section>
            )}

            {localSettings.transport === 'uart' && (
              <Section title="UART (Serial bridge)">
                <Field label="Device" hint="Serial path — e.g. COM6 (Windows), /dev/ttyUSB0 (Linux)">
                  <Input value={localSettings.uartDevice} onChange={(v) => patch('uartDevice', v)} />
                </Field>
                <Field label="Baud Rate" hint="Must match gcs_data_handler (default 460800)">
                  <Input value={localSettings.uartBaud} type="number" onChange={(v) => patch('uartBaud', Number(v))} />
                </Field>
                <div className="text-[10px] px-2 py-1.5 rounded"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--text-secondary)' }}>
                  UART requires the local Node bridge in <span className="font-mono">server.ts</span> to be running
                  (it speaks to the serial port and proxies under <span className="font-mono">/api/gcs/&lt;route&gt;</span>).
                </div>
              </Section>
            )}

            <Section title="Reliability">
              <Field label="Reconnect Interval" hint="Seconds between reconnect attempts">
                <Input value={localSettings.reconnectInterval} type="number" onChange={(v) => patch('reconnectInterval', Number(v))} />
              </Field>
            </Section>

            <div className="flex items-center gap-3">
              <button
                onClick={testConnection}
                disabled={probing}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-50"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              >
                <Plug size={12} />
                {probing ? 'Probing…' : 'Test connection'}
              </button>
              {probeResult && (
                <span className="text-xs font-mono"
                  style={{ color: probeResult.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  {probeResult.ok ? '✓' : '✗'} {probeResult.msg}
                </span>
              )}
            </div>

            <div className="px-2 py-2 rounded-md text-xs"
              style={{ background: 'rgba(0,180,255,0.06)', border: '1px solid rgba(0,180,255,0.15)', color: 'var(--text-secondary)' }}>
              Currently using: <span className="font-mono" style={{ color: 'var(--accent)' }}>{transportLabel}</span>
            </div>
          </>
        )}

        {tab === 'devices' && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Live probe of Jetson-visible hardware.
                </p>
                {deviceSnapshot && (
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    Last poll: {new Date(deviceSnapshot.ts).toLocaleTimeString('en-IN', { hour12: false })}
                  </p>
                )}
              </div>
              <button
                onClick={refreshDeviceStatus}
                disabled={deviceLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              >
                <RefreshCw size={11} className={deviceLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {/* Error banner */}
            {deviceError && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-md text-xs"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--accent-red)' }}
              >
                <XCircle size={13} />
                Cannot reach server — {deviceError}
              </div>
            )}

            {/* Device rows */}
            <div className="gcs-card overflow-hidden">
              {[
                {
                  key: 'controller',
                  label: 'Controller',
                  icon: Usb,
                  detail: deviceSnapshot
                    ? deviceSnapshot.devices.controller.connected
                      ? deviceSnapshot.devices.controller.port ?? 'connected'
                      : 'not detected'
                    : '—',
                  ok: deviceSnapshot?.devices.controller.connected ?? null,
                },
                {
                  key: 'lidar',
                  label: 'LiDAR',
                  icon: RadioIcon,
                  detail: deviceSnapshot
                    ? deviceSnapshot.devices.lidar.connected
                      ? deviceSnapshot.devices.lidar.port ?? 'connected'
                      : 'not detected'
                    : '—',
                  ok: deviceSnapshot?.devices.lidar.connected ?? null,
                },
                {
                  key: 'gcs_link',
                  label: 'GCS Link',
                  icon: Wifi,
                  detail: deviceSnapshot
                    ? deviceSnapshot.devices.gcs_link.connected
                      ? deviceSnapshot.devices.gcs_link.port ?? 'connected'
                      : 'not detected'
                    : '—',
                  ok: deviceSnapshot?.devices.gcs_link.connected ?? null,
                },
                {
                  key: 'gps',
                  label: 'GPS',
                  icon: Satellite,
                  detail: deviceSnapshot
                    ? deviceSnapshot.devices.gps.connected
                      ? `${deviceSnapshot.devices.gps.fix ?? ''} · ${deviceSnapshot.devices.gps.satellites} sats`
                      : deviceSnapshot.devices.gps.reason ?? 'no fix'
                    : '—',
                  ok: deviceSnapshot?.devices.gps.connected ?? null,
                },
                {
                  key: 'imu',
                  label: 'IMU',
                  icon: Gauge,
                  detail: deviceSnapshot
                    ? deviceSnapshot.devices.imu.connected
                      ? `yaw ${(deviceSnapshot.devices.imu.yaw ?? 0).toFixed(1)}° · ${(deviceSnapshot.devices.imu.telemetry_rate_hz ?? 0).toFixed(0)} Hz`
                      : deviceSnapshot.devices.imu.reason ?? 'inactive'
                    : '—',
                  ok: deviceSnapshot?.devices.imu.connected ?? null,
                },
              ].map(({ key, label, icon: Icon, detail, ok }, i, arr) => (
                <div
                  key={key}
                  className="flex items-center gap-4 px-4 py-3"
                  style={{
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  {/* Icon */}
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                  >
                    <Icon size={13} style={{ color: 'var(--text-secondary)' }} />
                  </div>

                  {/* Name + detail */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</div>
                    <div className="text-[10px] font-mono truncate" style={{ color: 'var(--text-dim)' }}>{detail}</div>
                  </div>

                  {/* Status badge */}
                  <div
                    className="shrink-0 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest font-mono"
                    style={{
                      background: ok === null
                        ? 'rgba(255,255,255,0.04)'
                        : ok
                        ? 'rgba(16,185,129,0.12)'
                        : 'rgba(239,68,68,0.12)',
                      border: `1px solid ${ok === null ? 'var(--border-subtle)' : ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
                      color: ok === null ? 'var(--text-dim)' : ok ? 'var(--accent-green)' : 'var(--accent-red)',
                    }}
                  >
                    {ok === null ? '···' : ok ? 'OK' : 'ERR'}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] px-1" style={{ color: 'var(--text-dim)' }}>
              Encoders, camera, and motor drivers are behind the controller firmware and are not reported here.
            </p>
          </div>
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
                  onChange={(e) => patch('mapStyle', e.target.value as typeof localSettings.mapStyle)}
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

        {tab === 'camera' && (
          <>
            <div
              className="px-3 py-2 rounded-md text-[10px]"
              style={{ background: 'rgba(167,188,227,0.06)', border: '1px solid rgba(167,188,227,0.15)', color: 'var(--text-secondary)' }}
            >
              Configure RTSP stream URLs for each camera feed. Requires <span className="font-mono">ffmpeg</span> installed and accessible in system PATH. Streams are transcoded to HLS on-the-fly by the local server.
            </div>

            {(localSettings.cameraFeeds ?? []).map((feed, idx) => (
              <Section key={feed.id} title={`Feed ${idx + 1}`}>
                <Field label="Camera Label" hint="Display name shown on the surveillance page">
                  <Input
                    value={feed.label}
                    onChange={(v) => patchCameraFeed(feed.id, 'label', v)}
                    placeholder={`Camera ${idx + 1}`}
                  />
                </Field>
                <div className="flex flex-col gap-1.5">
                  <div className="text-sm" style={{ color: 'var(--text-primary)' }}>RTSP URL</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                    e.g. rtsp://192.168.1.x:554/stream
                  </div>
                  <Input
                    value={feed.rtspUrl}
                    onChange={(v) => patchCameraFeed(feed.id, 'rtspUrl', v)}
                    placeholder="rtsp://192.168.1.x:554/stream"
                    wide
                  />
                </div>
                <Field label="Enable Feed" hint="Start streaming this camera on the Surveillance page">
                  <Toggle
                    checked={feed.enabled}
                    onChange={(v) => patchCameraFeed(feed.id, 'enabled', v)}
                  />
                </Field>
              </Section>
            ))}
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

      {/* Save button — hidden on read-only tabs */}
      {tab !== 'sessions' && tab !== 'devices' && (
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
