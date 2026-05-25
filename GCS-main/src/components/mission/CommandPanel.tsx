
'use client';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import { ShieldAlert, Play, Pause, Home, Power, PowerOff, AlertTriangle } from 'lucide-react';
import { setArm, stop, uploadMission, setMissionUgv, returnToHome } from '@/lib/api/commands';

export function CommandPanel() {
  const { isArmed, missionStatus, setArmed, setMissionStatus, addAlert, waypoints } = useVehicleStore();
  const [busy, setBusy] = useState<null | 'arm' | 'disarm' | 'estop' | 'rth' | 'start' | 'pause'>(null);

  async function doArm() {
    if (!confirm('Arm vehicle? Motors will become active.')) return;
    setBusy('arm');
    try {
      const res = await setArm(true);
      if (!res.ok) throw new Error(res.detail ?? 'ARM failed');
      setArmed(true);
      addAlert({ type: 'ARM', message: 'ARM Active command sent', timestamp: new Date().toISOString(), severity: 'warning' });
      toast.success('ARM Active command sent');
    } catch (e) { toast.error(`ARM failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  async function doDisarm() {
    setBusy('disarm');
    try {
      const res = await setArm(false);
      if (!res.ok) throw new Error(res.detail ?? 'DISARM failed');
      setArmed(false);
      setMissionStatus('idle');
      addAlert({ type: 'DISARM', message: 'ARM Inactive command sent', timestamp: new Date().toISOString(), severity: 'info' });
      toast.success('ARM Inactive command sent');
    } catch (e) { toast.error(`DISARM failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  async function doEStop() {
    if (!confirm('EMERGENCY STOP — cut all motors immediately?')) return;
    setBusy('estop');
    try {
      // Stop motion, then disarm.
      await stop().catch(() => null);
      await setArm(false).catch(() => null);
      setArmed(false);
      setMissionStatus('idle');
      addAlert({ type: 'ESTOP', message: 'Emergency stop issued', timestamp: new Date().toISOString(), severity: 'critical' });
      toast.error('Emergency stop issued');
    } catch (e) { toast.error(`E-STOP failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  async function doRTH() {
    if (!confirm('Return to home?')) return;
    setBusy('rth');
    try {
      const res = await returnToHome();
      if (!res.ok) throw new Error(res.detail ?? 'RTH failed');
      setMissionStatus('idle');
      addAlert({ type: 'RTH', message: 'Return to home command sent', timestamp: new Date().toISOString(), severity: 'info' });
      toast.success('RTH requested');
    } catch (e) { toast.error(`RTH failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  async function doStart() {
    setBusy('start');
    try {
      // Re-upload the current waypoints to (re)activate the mission on the bot.
      if (waypoints.length === 0) {
        toast.error('No waypoints to start');
        return;
      }
      const payload = waypoints.map((w) => ({ lat: w.lat, lng: w.lng, alt: w.alt, sequence: w.sequence }));
      const res = await uploadMission(payload);
      if (!res.ok) throw new Error(res.detail ?? 'start failed');
      // create_new_mission only plans the mission — activate it so the bot runs it.
      const activate = await setMissionUgv(String(res.mission_id));
      if (!activate.ok) throw new Error(activate.detail ?? 'activate failed');
      setMissionStatus('running');
      addAlert({ type: 'MISSION', message: `Mission started (${waypoints.length} WP)`, timestamp: new Date().toISOString(), severity: 'info' });
      toast.success('Mission started');
    } catch (e) { toast.error(`Start failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  async function doPause() {
    setBusy('pause');
    try {
      await stop();
      setMissionStatus('paused');
      addAlert({ type: 'MISSION', message: 'Mission paused', timestamp: new Date().toISOString(), severity: 'info' });
      toast.success('Mission paused');
    } catch (e) { toast.error(`Pause failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  return (
    <div className="gcs-card p-4 flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        Vehicle Commands
      </div>

      {/* Arm / Disarm */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={doArm}
          disabled={isArmed || busy === 'arm'}
          className="flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
          style={{
            background: isArmed ? 'var(--bg-elevated)' : 'rgba(16,185,129,0.15)',
            border: `1px solid ${isArmed ? 'var(--border-subtle)' : 'var(--accent-green)'}`,
            color: isArmed ? 'var(--text-dim)' : 'var(--accent-green)',
          }}
        >
          <Power size={13} />
          ARM
        </button>
        <button
          onClick={doDisarm}
          disabled={!isArmed || busy === 'disarm'}
          className="flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
          style={{
            background: !isArmed ? 'var(--bg-elevated)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${!isArmed ? 'var(--border-subtle)' : 'var(--accent-red)'}`,
            color: !isArmed ? 'var(--text-dim)' : 'var(--accent-red)',
          }}
        >
          <PowerOff size={13} />
          DISARM
        </button>
      </div>

      {/* Mission controls */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={missionStatus === 'running' ? doPause : doStart}
          disabled={!isArmed || busy === 'start' || busy === 'pause'}
          className="flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
          style={{
            background: 'rgba(0,180,255,0.12)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
          }}
        >
          {missionStatus === 'running'
            ? <><Pause size={13} />{busy === 'pause' ? 'Pausing…' : 'PAUSE'}</>
            : <><Play size={13} />{busy === 'start' ? 'Starting…' : 'START'}</>
          }
        </button>
        <button
          onClick={doRTH}
          disabled={!isArmed || busy === 'rth'}
          className="flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
          style={{
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid var(--accent-yellow)',
            color: 'var(--accent-yellow)',
          }}
        >
          <Home size={13} />
          {busy === 'rth' ? 'Returning…' : 'RTH'}
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
