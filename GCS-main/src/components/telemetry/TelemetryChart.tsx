'use client';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

const TICK_STYLE = { fontSize: 10, fill: 'var(--text-dim)', fontFamily: 'monospace' };

export function TelemetryChart() {
  const history = useVehicleStore((s) => s.telemetryHistory);

  return (
    <div className="gcs-card p-4" style={{ height: 220 }}>
      <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>
        Telemetry — Time Series
      </div>
      {history.length < 2 ? (
        <div className="flex items-center justify-center h-32 text-xs" style={{ color: 'var(--text-dim)' }}>
          Collecting data…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={155}>
          <LineChart data={history} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="time" tick={TICK_STYLE} interval="preserveStartEnd" tickLine={false} axisLine={false} />
            <YAxis yAxisId="speed" domain={[0, 'auto']} tick={TICK_STYLE} tickLine={false} axisLine={false} width={28} />
            <YAxis yAxisId="voltage" orientation="right" domain={[0, 'auto']} tick={TICK_STYLE} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 6,
                fontSize: 11,
              }}
              labelStyle={{ color: 'var(--text-secondary)' }}
              itemStyle={{ color: 'var(--text-primary)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, color: 'var(--text-secondary)', paddingTop: 4 }}
              iconSize={8}
            />
            <Line
              yAxisId="speed" type="monotone" dataKey="speed" name="Speed m/s"
              stroke="var(--accent)" strokeWidth={1.5} dot={false} isAnimationActive={false}
            />
            <Line
              yAxisId="speed" type="monotone" dataKey="alt" name="Alt m"
              stroke="var(--accent-green)" strokeWidth={1.5} dot={false} isAnimationActive={false}
            />

            <Line
              yAxisId="voltage" type="monotone" dataKey="batteryV" name="Battery V"
              stroke="var(--accent-red)" strokeWidth={1.5} dot={false} isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
