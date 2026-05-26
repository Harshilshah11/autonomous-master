'use client';
import { useVehicleStore } from '@/lib/store/vehicleStore';

const CX = 100, CY = 125, R = 88, MAX_SPEED = 10;

// Round to 3 dp: Math.cos/sin differ at the last ULP between the Node (SSR) and
// browser engines, which otherwise trips React's hydration check on SVG coords.
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function polar(angleDeg: number, r = R) {
  const rad = angleDeg * Math.PI / 180;
  return { x: r3(CX + r * Math.cos(rad)), y: r3(CY - r * Math.sin(rad)) };
}

function arcPath(from: number, to: number, r = R) {
  const s = polar(from, r);
  const e = polar(to, r);
  const sweep = ((from - to) + 360) % 360;
  const large = sweep > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

function speedAngle(v: number) {
  return 225 - (Math.min(v, MAX_SPEED) / MAX_SPEED) * 270;
}

export function SpeedGauge() {
  const speed = useVehicleStore((s) => s.telemetry.speed);
  const pct = Math.min(speed / MAX_SPEED, 1);
  const needleAngle = speedAngle(speed);
  const needlePt = polar(needleAngle, R - 10);
  const centerPt = polar(needleAngle, 12);

  const color = pct < 0.5 ? 'var(--accent-green)' : pct < 0.75 ? 'var(--accent-yellow)' : 'var(--accent-red)';
  const trackPath = arcPath(225, 225 - 270);
  const valuePath = arcPath(225, needleAngle);

  const minPt = polar(225, R + 10);
  const maxPt = polar(225 - 270, R + 10);

  return (
    <div className="gcs-card p-3 flex flex-col items-center">
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Speed</div>
      <svg viewBox="0 0 200 160" width="100%" style={{ maxWidth: 200 }}>
        {/* Track */}
        <path d={trackPath} fill="none" stroke="var(--bg-elevated)" strokeWidth="10" strokeLinecap="round" />
        {/* Value arc */}
        <path d={valuePath} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
        {/* Needle */}
        <line x1={centerPt.x} y1={centerPt.y} x2={needlePt.x} y2={needlePt.y}
          stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="5" fill="var(--bg-card)" stroke="var(--text-primary)" strokeWidth="1.5" />
        {/* Labels */}
        <text x={minPt.x - 4} y={minPt.y + 4} fontSize="9" fill="var(--text-dim)" textAnchor="middle">0</text>
        <text x={maxPt.x + 4} y={maxPt.y + 4} fontSize="9" fill="var(--text-dim)" textAnchor="middle">{MAX_SPEED}</text>
        {/* Value */}
        <text x={CX} y={CY - 18} fontSize="26" fontWeight="bold" fill="var(--text-primary)" textAnchor="middle" fontFamily="monospace">
          {speed.toFixed(1)}
        </text>
        <text x={CX} y={CY - 5} fontSize="10" fill="var(--text-secondary)" textAnchor="middle">m/s</text>
        {/* Tick marks */}
        {Array.from({ length: 11 }, (_, i) => {
          const a = speedAngle(i);
          const outer = polar(a, R - 1);
          const inner = polar(a, R - (i % 5 === 0 ? 12 : 7));
          return (
            <line key={i} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
              stroke={i % 5 === 0 ? 'var(--text-secondary)' : 'var(--border-bright)'} strokeWidth={i % 5 === 0 ? 1.5 : 1} />
          );
        })}
      </svg>
    </div>
  );
}
