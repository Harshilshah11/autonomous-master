
'use client';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import { ShieldAlert, Power, AlertTriangle, MapPin, LocateFixed } from 'lucide-react';
import { startMission, emergencyStop, fetchHome } from '@/lib/api/commands';

export function CommandPanel() {
  const { missionStatus, setArmed, setMissionStatus, addAlert, setBotMode,
          homePlacement, setHomePlacement, setHome, focusHome } = useVehicleStore();
  const [busy, setBusy] = useState<null | 'startmission' | 'estop' | 'gethome'>(null);

  async function doStartMission() {
    setBusy('startmission');
    try {
      const res = await startMission();
      if (!res.ok) throw new Error(res.detail ?? 'Start failed');
      setMissionStatus('running');
      addAlert({ type: 'MISSION', message: res.detail ?? 'Mission started', timestamp: new Date().toISOString(), severity: 'info' });
      toast.success('Mission started');
    } catch (e) { toast.error(`Start failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  function toggleHomePlacement() {
    const next = !homePlacement;
    setHomePlacement(next);
    if (next) toast('Click on the map to set HOME');
  }

  async function doGetHome() {
    setBusy('gethome');
    try {
      const res = await fetchHome();
      if (!res.ok) throw new Error(res.detail ?? 'get_home failed');
      const hc = res.home_coordinates as { lat?: number; lng?: number } | undefined;
      if (!hc || typeof hc.lat !== 'number' || typeof hc.lng !== 'number') {
        toast.error('No home set on vehicle yet');
        return;
      }
      setHome({ lat: hc.lat, lng: hc.lng });
      focusHome();
      addAlert({ type: 'HOME', message: `Home loaded ${hc.lat.toFixed(5)}, ${hc.lng.toFixed(5)}`, timestamp: new Date().toISOString(), severity: 'info' });
      toast.success('Home loaded from vehicle');
    } catch (e) { toast.error(`Get home failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  async function doEStop() {
    if (!confirm('EMERGENCY STOP — cut all motors immediately?')) return;
    setBusy('estop');
    try {
      const res = await emergencyStop();
      if (!res.ok) throw new Error(res.detail ?? 'E-STOP failed');
      // Backend forces MANUAL, zeroes inputs and clears RTH.
      setArmed(false);
      setBotMode('MANUAL');
      setMissionStatus('idle');
      addAlert({ type: 'ESTOP', message: res.detail ?? 'Emergency stop issued', timestamp: new Date().toISOString(), severity: 'critical' });
      toast.error('Emergency stop issued');
    } catch (e) { toast.error(`E-STOP failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  return (
    <div className="gcs-card p-4 flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        Vehicle Commands
      </div>

      {/* Start mission */}
      <button
        onClick={doStartMission}
        disabled={busy === 'startmission'}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
        style={{
          background: 'rgba(16,185,129,0.15)',
          border: '1px solid var(--accent-green)',
          color: 'var(--accent-green)',
        }}
      >
        <Power size={13} />
        {busy === 'startmission' ? 'STARTING…' : 'START'}
      </button>

      {/* Home — set by clicking the map / fetch from vehicle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={toggleHomePlacement}
          className="flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-semibold transition-all"
          style={{
            background: homePlacement ? 'rgba(245,158,11,0.18)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${homePlacement ? 'var(--accent-yellow)' : 'var(--border-subtle)'}`,
            color: homePlacement ? 'var(--accent-yellow)' : 'var(--text-secondary)',
          }}
        >
          <MapPin size={13} />
          {homePlacement ? 'CLICK MAP…' : 'SET HOME'}
        </button>
        <button
          onClick={doGetHome}
          disabled={busy === 'gethome'}
          className="flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
          style={{
            background: 'rgba(0,180,255,0.10)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <LocateFixed size={13} />
          {busy === 'gethome' ? 'Loading…' : 'GET HOME'}
        </button>
      </div>

      {/* Mission status badge */}
      <div className="flex items-center gap-2 text-xs px-2 py-1.5 rounded"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <ShieldAlert size={11} style={{ color: 'var(--text-dim)' }} />
        <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
        <span className="font-semibold ml-auto" style={{
          color: missionStatus === 'running' ? 'var(--accent-green)'
            : missionStatus === 'paused' ? 'var(--accent-yellow)'
            : 'var(--text-dim)',
        }}>
          {missionStatus.toUpperCase()}
        </span>
      </div>

      {/* Emergency stop */}
      <button
        onClick={doEStop}
        disabled={busy === 'estop'}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-md font-bold text-sm transition-all"
        style={{
          background: 'rgba(239,68,68,0.2)',
          border: '2px solid var(--accent-red)',
          color: 'var(--accent-red)',
          letterSpacing: '0.1em',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.35)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
      >
        <AlertTriangle size={15} />
        {busy === 'estop' ? 'STOPPING…' : 'EMERGENCY STOP'}
      </button>
    </div>
  );
}
