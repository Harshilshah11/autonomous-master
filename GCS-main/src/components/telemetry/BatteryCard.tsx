'use client';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import { Zap } from 'lucide-react';

export function BatteryCard() {
  const battery = useVehicleStore((s) => s.telemetry.battery);
  const { voltage, current, percentage } = battery;

  const color =
    percentage > 50 ? 'var(--accent-green)' :
    percentage > 25 ? 'var(--accent-yellow)' :
    'var(--accent-red)';

  const segments = 10;
  const filled = Math.round((percentage / 100) * segments);

  return (
    <div className="gcs-card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Battery</span>
        <Zap size={12} style={{ color }} />
      </div>

      {/* Segmented bar */}
      <div className="flex items-center gap-1 mb-2">
        <div className="flex gap-0.5 flex-1">
          {Array.from({ length: segments }, (_, i) => (
            <div
              key={i}
              className="h-4 flex-1 rounded-sm transition-all"
              style={{
                background: i < filled ? color : 'var(--bg-elevated)',
                border: `1px solid ${i < filled ? color : 'var(--border-subtle)'}`,
                opacity: i < filled ? (0.4 + (i / segments) * 0.6) : 0.3,
              }}
            />
          ))}
        </div>
        <div className="w-1.5 h-2.5 rounded-sm" style={{ background: 'var(--border-default)' }} />
      </div>

      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold font-mono" style={{ color }}>
          {voltage.toFixed(1)}<span className="text-sm">V</span>
        </span>
        <div className="text-right space-y-0.5">
          <div className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
            {percentage}%
          </div>
          <div className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
            {current.toFixed(1)} A
          </div>
        </div>
      </div>

      {percentage <= 20 && (
        <div className="mt-2 text-[10px] text-center py-1 rounded"
          style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.3)' }}>
          LOW BATTERY
        </div>
      )}
    </div>
  );
}
