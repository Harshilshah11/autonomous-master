'use client';
import dynamic from 'next/dynamic';
import { useVehicleStore } from '@/lib/store/vehicleStore';

const MapView = dynamic(() => import('@/components/map/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}><span className="text-xs" style={{ color: 'var(--text-dim)' }}>Loading map…</span></div>,
});
import { SpeedGauge } from '@/components/telemetry/SpeedGauge';
import { Compass } from '@/components/telemetry/Compass';
import { BatteryCard } from '@/components/telemetry/BatteryCard';
import { XYZCard } from '@/components/telemetry/XYZCard';
import { Activity, Navigation, Gauge, Radio, Satellite, Signal } from 'lucide-react';

function StatChip({ label, value, unit, color, icon: Icon }: {
  label: string; value: string; unit: string; color: string; icon: React.ElementType;
}) {
  return (
    <div className="gcs-card px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{label}</div>
        <div className="font-mono text-base font-bold leading-tight" style={{ color }}>
          {value}<span className="text-[10px] font-normal ml-0.5" style={{ color: 'var(--text-dim)' }}>{unit}</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const telemetry = useVehicleStore((s) => s.telemetry);
  const connStatus = useVehicleStore((s) => s.connectionStatus);

  return (
    <div className="p-4 flex flex-col gap-4 h-full min-h-0">
      {/* Stat chips */}
      <div className="grid grid-cols-5 gap-3 shrink-0">
        <StatChip label="Speed" value={telemetry.speed.toFixed(1)} unit="m/s" color="var(--accent)" icon={Gauge} />
        <StatChip label="Heading" value={Math.round(telemetry.heading).toString().padStart(3, '0')} unit="°" color="var(--accent-green)" icon={Navigation} />
        <StatChip label="GPS" value={`${telemetry.position.lat.toFixed(4)}, ${telemetry.position.lng.toFixed(4)}`} unit="" color="var(--accent-yellow)" icon={Activity} />
        <StatChip label="Satellites" value={String(telemetry.gps.satellites)} unit={telemetry.gps.fix ? `· ${telemetry.gps.fix}` : ''} color={telemetry.gps.satellites >= 6 ? 'var(--accent-green)' : telemetry.gps.satellites >= 4 ? 'var(--accent-yellow)' : 'var(--accent-red)'} icon={Satellite} />
        <StatChip label="Latency" value={String(connStatus.latency)} unit="ms" color={connStatus.connected ? 'var(--accent-green)' : 'var(--accent-red)'} icon={Radio} />
      </div>

      {/* Main grid: map + telemetry column */}
      <div className="flex gap-4 flex-1 min-h-0" style={{ minHeight: 0 }}>
        {/* Map */}
        <div className="flex-1 min-h-0" style={{ minHeight: 380 }}>
          <MapView mode="view" height="100%" />
        </div>

        {/* Telemetry column */}
        <div className="flex flex-col gap-3 overflow-y-auto" style={{ width: 200, flexShrink: 0 }}>
          <SpeedGauge />
          <Compass />
          <BatteryCard />
          <XYZCard />
        </div>
      </div>
    </div>
  );
}
