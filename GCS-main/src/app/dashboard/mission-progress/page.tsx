'use client';
import dynamic from 'next/dynamic';
import { MissionProgressPanel } from '@/components/mission/MissionProgressPanel';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import { useTelemetryPoller } from '@/lib/hooks/useTelemetryPoller';

const MapView = dynamic(() => import('@/components/map/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center h-full rounded-lg"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>Loading map…</span>
    </div>
  ),
});

export default function MissionProgressPage() {
  // Odometry comes from the layout; this page additionally needs live mission state.
  useTelemetryPoller({ odometry: false, mission: true });

  const missionStatus      = useVehicleStore((s) => s.missionStatus);
  const isArmed            = useVehicleStore((s) => s.isArmed);
  const waypoints          = useVehicleStore((s) => s.waypoints);
  const currentWpIdx       = useVehicleStore((s) => s.currentWaypointIndex);

  const completedCount = Math.min(currentWpIdx, waypoints.length);

  return (
    <div className="p-4 flex flex-col gap-4 h-full min-h-0">
      {/* Status bar */}
      <div
        className="flex items-center gap-4 px-4 py-2 rounded-md shrink-0"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-dim)' }}>Vehicle:</span>
          <span
            className="font-semibold"
            style={{ color: isArmed ? 'var(--accent-green)' : 'var(--accent-red)' }}
          >
            {isArmed ? 'ARMED' : 'DISARMED'}
          </span>
        </div>
        <div className="h-3 w-px" style={{ background: 'var(--border-subtle)' }} />
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-dim)' }}>Mission:</span>
          <span
            className="font-semibold"
            style={{
              color:
                missionStatus === 'running' ? 'var(--accent-green)'
                : missionStatus === 'paused' ? 'var(--accent-yellow)'
                : 'var(--text-dim)',
            }}
          >
            {missionStatus.toUpperCase()}
          </span>
        </div>
        <div className="h-3 w-px" style={{ background: 'var(--border-subtle)' }} />
        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
          <span style={{ color: 'var(--accent-green)' }}>{completedCount}</span>
          <span style={{ color: 'var(--text-dim)' }}> / {waypoints.length} waypoints completed</span>
        </div>
        <div
          className="ml-auto text-[10px] px-2 py-0.5 rounded"
          style={{
            background: 'rgba(16,185,129,0.1)',
            color: 'var(--accent-green)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}
        >
          Read-only · Mission in progress
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Map (read-only: no clicking) */}
        <div className="flex-1 min-h-0">
          <MapView mode="progress" height="100%" />
        </div>

        {/* Progress Panel */}
        <MissionProgressPanel />
      </div>
    </div>
  );
}
