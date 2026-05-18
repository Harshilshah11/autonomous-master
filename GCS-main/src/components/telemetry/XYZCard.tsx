'use client';
import { useVehicleStore } from '@/lib/store/vehicleStore';

export function XYZCard() {
  const pos = useVehicleStore((s) => s.telemetry.position);

  const rows = [
    { label: 'X', value: pos.x.toFixed(1), unit: 'm', color: 'var(--accent-red)' },
    { label: 'Y', value: pos.y.toFixed(1), unit: 'm', color: 'var(--accent-green)' },
    { label: 'Z', value: pos.z.toFixed(1), unit: 'm', color: 'var(--accent)' },
    { label: 'LAT', value: pos.lat.toFixed(6), unit: '°', color: 'var(--text-secondary)' },
    { label: 'LNG', value: pos.lng.toFixed(6), unit: '°', color: 'var(--text-secondary)' },
    { label: 'ALT', value: pos.alt.toFixed(1), unit: 'm', color: 'var(--accent-yellow)' },
  ];

  return (
    <div className="gcs-card p-3">
      <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>Position</div>
      <div className="space-y-1">
        {rows.map(({ label, value, unit, color }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[10px] w-8" style={{ color: 'var(--text-dim)' }}>{label}</span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-sm font-bold" style={{ color }}>{value}</span>
              <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
