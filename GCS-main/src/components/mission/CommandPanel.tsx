'use client';
import { useMutation } from '@apollo/client/react';
import toast from 'react-hot-toast';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import {
  MUTATION_EMERGENCY_STOP,
  MUTATION_RTH, MUTATION_START_MISSION, MUTATION_PAUSE_MISSION,
} from '@/lib/graphql/queries';
import { ShieldAlert, Play, Pause, Home, Power, PowerOff, AlertTriangle } from 'lucide-react';
import { sendManualCommand } from '@/lib/hooks/useTelemetrySocket';
import type {
  EmergencyStopMutationResponse,
  RthMutationResponse,
  StartMissionMutationResponse,
  PauseMissionMutationResponse,
  GqlCommandResult,
} from '@/types';

function msg(result: GqlCommandResult | null | undefined): string {
  return result?.message ?? 'OK';
}

export function CommandPanel() {
  const { isArmed, missionStatus, setArmed, setMissionStatus, addAlert } = useVehicleStore();

  const [estopMut, { loading: estopping }] = useMutation<EmergencyStopMutationResponse>(MUTATION_EMERGENCY_STOP);
  const [rthMut,   { loading: rthing }]    = useMutation<RthMutationResponse>(MUTATION_RTH);
  const [startMut, { loading: starting }]  = useMutation<StartMissionMutationResponse>(MUTATION_START_MISSION);
  const [pauseMut, { loading: pausing }]   = useMutation<PauseMissionMutationResponse>(MUTATION_PAUSE_MISSION);

  async function doArm() {
    if (!confirm('Arm vehicle? Motors will become active.')) return;
    try {
      setArmed(true);
      sendManualCommand({ type: 'command', data: { armStatus: 'Active' } });
      addAlert({ type: 'ARM', message: 'ARM Active command sent', timestamp: new Date().toISOString(), severity: 'warning' });
      toast.success('ARM Active command sent');
    } catch { toast.error('ARM command failed'); }
  }

  async function doDisarm() {
    try {
      setArmed(false);
      setMissionStatus('idle');
      sendManualCommand({ type: 'command', data: { armStatus: 'Inactive' } });
      addAlert({ type: 'DISARM', message: 'ARM Inactive command sent', timestamp: new Date().toISOString(), severity: 'info' });
      toast.success('ARM Inactive command sent');
    } catch { toast.error('DISARM command failed'); }
  }

  async function doEStop() {
    if (!confirm('EMERGENCY STOP — cut all motors immediately?')) return;
    try {
      const { data } = await estopMut();
      setArmed(false);
      setMissionStatus('idle');
      const m = msg(data?.emergencyStop);
      addAlert({ type: 'ESTOP', message: m, timestamp: new Date().toISOString(), severity: 'critical' });
      toast.error(m);
    } catch { toast.error('E-STOP command failed'); }
  }

  async function doRTH() {
    if (!confirm('Return to home?')) return;
    try {
      const { data } = await rthMut();
      const m = msg(data?.returnToHome);
      addAlert({ type: 'RTH', message: m, timestamp: new Date().toISOString(), severity: 'info' });
      toast.success(m);
    } catch { toast.error('RTH command failed'); }
  }

  async function doStart() {
    try {
      const { data } = await startMut();
      setMissionStatus('running');
      const m = msg(data?.startMission);
      addAlert({ type: 'MISSION', message: m, timestamp: new Date().toISOString(), severity: 'info' });
      toast.success(m);
    } catch { toast.error('Start mission failed'); }
  }

  async function doPause() {
    try {
      const { data } = await pauseMut();
      setMissionStatus('paused');
      const m = msg(data?.pauseMission);
      addAlert({ type: 'MISSION', message: m, timestamp: new Date().toISOString(), severity: 'info' });
      toast.success(m);
    } catch { toast.error('Pause mission failed'); }
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
          disabled={isArmed}
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
          disabled={!isArmed}
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
          disabled={!isArmed || starting || pausing}
          className="flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
          style={{
            background: 'rgba(0,180,255,0.12)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
          }}
        >
          {missionStatus === 'running'
            ? <><Pause size={13} />{pausing ? 'Pausing…' : 'PAUSE'}</>
            : <><Play size={13} />{starting ? 'Starting…' : 'START'}</>
          }
        </button>
        <button
          onClick={doRTH}
          disabled={!isArmed || rthing}
          className="flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
          style={{
            background: 'rgba(245,158,11,0.12)',
            border: '1px solid var(--accent-yellow)',
            color: 'var(--accent-yellow)',
          }}
        >
          <Home size={13} />
          {rthing ? 'Returning…' : 'RTH'}
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
        disabled={estopping}
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
        {estopping ? 'STOPPING…' : 'EMERGENCY STOP'}
      </button>
    </div>
  );
}
