'use client';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/map/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}><span className="text-xs" style={{ color: 'var(--text-dim)' }}>Loading map…</span></div>,
});
import { CommandPanel } from '@/components/mission/CommandPanel';
import { WaypointPanel } from '@/components/mission/WaypointPanel';
import { ManualControlPanel } from '@/components/mission/ManualControlPanel';
import { useVehicleStore } from '@/lib/store/vehicleStore';

export default function MissionPage() {
  const missionStatus = useVehicleStore((s) => s.missionStatus);
  const isArmed = useVehicleStore((s) => s.isArmed);
  const waypoints = useVehicleStore((s) => s.waypoints);
  const botMode = useVehicleStore((s) => s.telemetry.botMode);
  const isManual = botMode === 'MANUAL';

  return (
    <div className="p-4 flex flex-col gap-4 h-full min-h-0">
      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-2 rounded-md shrink-0"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-dim)' }}>Vehicle:</span>
          <span className="font-semibold" style={{ color: isArmed ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {isArmed ? 'ARMED' : 'DISARMED'}
          </span>
        </div>
        <div className="h-3 w-px" style={{ background: 'var(--border-subtle)' }} />
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-dim)' }}>Mission:</span>
          <span className="font-semibold" style={{
            color: missionStatus === 'running' ? 'var(--accent-green)'
              : missionStatus === 'paused' ? 'var(--accent-yellow)' : 'var(--text-dim)',
          }}>
            {missionStatus.toUpperCase()}
          </span>
        </div>
        <div className="h-3 w-px" style={{ background: 'var(--border-subtle)' }} />
        {!isManual && (
          <>
            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
              <span style={{ color: 'var(--accent)' }}>{waypoints.length}</span> waypoints loaded
            </div>
            <div className="ml-auto text-[10px] px-2 py-0.5 rounded"
              style={{ background: 'rgba(0,180,255,0.1)', color: 'var(--accent)', border: '1px solid rgba(0,180,255,0.2)' }}>
              Click map to place waypoints
            </div>
          </>
        )}
      </div>

      {/* Main layout */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 min-h-0">
          <MapView mode="mission" height="100%" />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3 min-h-0 overflow-y-auto" style={{ width: 280, flexShrink: 0 }}>
          <CommandPanel />
          {!isManual && <WaypointPanel />}
          {isManual && <ManualControlPanel />}
        </div>
      </div>
    </div>
  );
}
