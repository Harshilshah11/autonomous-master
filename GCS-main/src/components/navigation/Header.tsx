'use client';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import { useEffect, useState } from 'react';
import { Wifi, WifiOff, BatteryCharging, Clock } from 'lucide-react';
import { setMode } from '@/lib/api/commands';
import { ThemeToggle } from '@/components/navigation/ThemeToggle';
import toast from 'react-hot-toast';

interface HeaderProps { title: string; }

export function Header({ title }: HeaderProps) {
  const setBotMode = useVehicleStore((s) => s.setBotMode);
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const telemetry  = useVehicleStore((s) => s.telemetry);
  const connStatus = useVehicleStore((s) => s.connectionStatus);
  const isArmed    = useVehicleStore((s) => s.isArmed);

  const batt      = telemetry?.battery?.percentage ?? 0;
  const battV     = telemetry?.battery?.voltage ?? 0;
  const battColor = batt > 50 ? 'var(--accent-green)' : batt > 20 ? 'var(--accent-yellow)' : 'var(--accent-red)';

  async function switchMode(mode: 'MANUAL' | 'AUTO') {
    setBotMode(mode);
    try {
      const res = await setMode(mode);
      if (!res.ok) toast.error(`Mode change failed: ${res.detail ?? res.status}`);
    } catch (e) {
      toast.error(`Mode change failed: ${(e as Error).message}`);
    }
  }

  return (
    <header
      className="flex items-center justify-between px-5 shrink-0"
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        height: '52px',
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
    >
      <h1
        className="text-sm font-semibold tracking-widest uppercase"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-syne)' }}
      >
        {title}
      </h1>

      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {/* Flight mode */}
        <div className="flex items-center gap-1.5">
          <span className="eyebrow">Mode</span>
          <div className="flex gap-1">
            <button
              onClick={() => switchMode('MANUAL')}
              className="px-2 py-0.5 rounded text-[10px] font-bold transition-all"
              style={{
                background: (telemetry?.botMode === 'MANUAL' || !telemetry?.botMode) ? 'var(--accent)' : 'var(--bg-elevated)',
                color: (telemetry?.botMode === 'MANUAL' || !telemetry?.botMode) ? '#000' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-syne)',
                letterSpacing: '0.05em',
              }}
            >
              MANUAL
            </button>
            <button
              onClick={() => switchMode('AUTO')}
              className="px-2 py-0.5 rounded text-[10px] font-bold transition-all"
              style={{
                background: telemetry?.botMode === 'AUTO' ? 'var(--accent)' : 'var(--bg-elevated)',
                color: telemetry?.botMode === 'AUTO' ? '#000' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-syne)',
                letterSpacing: '0.05em',
              }}
            >
              AUTO
            </button>
          </div>
        </div>

        {/* Armed status */}
        <div className="flex items-center gap-1.5">
          <div
            className="status-dot"
            style={{
              background: isArmed ? 'var(--accent-green)' : 'var(--accent-red)',
              boxShadow: isArmed ? '0 0 6px var(--accent-green)' : 'none',
            }}
          />
          <span style={{ fontFamily: 'var(--font-syne)', fontWeight: 500, letterSpacing: '0.08em' }}>
            {isArmed ? 'ARMED' : 'DISARMED'}
          </span>
        </div>

        {/* Battery Voltage only */}
        <div className="flex items-center gap-1" style={{ color: battColor }}>
          <BatteryCharging size={14} />
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', fontWeight: 600 }}>{battV.toFixed(1)}V</span>
        </div>

        {/* Connection */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded"
          style={{
            background: connStatus.connected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${connStatus.connected ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
          }}>
          {connStatus.connected
            ? <Wifi    size={13} style={{ color: 'var(--accent-green)' }} />
            : <WifiOff size={13} style={{ color: 'var(--accent-red)'   }} />
          }
          <span
            style={{
              color: connStatus.connected ? 'var(--accent-green)' : 'var(--accent-red)',
              fontFamily: 'var(--font-syne)',
              fontWeight: 700,
              fontSize: '10px',
              letterSpacing: '0.05em'
            }}
          >
            {connStatus.connected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
          {connStatus.connected && (
            <span
              className="ml-1 font-mono text-[9px] font-bold"
              style={{
                color: connStatus.latency > 1000 ? 'var(--accent-red)' : 'var(--accent-green)',
              }}
            >
              {connStatus.latency > 1000 && 'LAG '}
              {connStatus.latency}ms
            </span>
          )}
        </div>

        {/* Clock */}
        <div className="flex items-center gap-1" style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-geist-mono)' }}>
          <Clock size={12} />
          <span>{time}</span>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
