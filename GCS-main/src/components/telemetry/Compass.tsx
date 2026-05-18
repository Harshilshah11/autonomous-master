'use client';
import { useVehicleStore } from '@/lib/store/vehicleStore';

const CX = 60, CY = 60, R = 52;

function polar(bearingDeg: number, r = R) {
  const rad = (bearingDeg - 90) * Math.PI / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function Compass() {
  const heading = useVehicleStore((s) => s.telemetry.heading);

  const arrowTip = polar(0, R - 8);
  const arrowLeft = polar(-18, R - 28);
  const arrowRight = polar(18, R - 28);
  const arrowBack = polar(180, R - 26);

  return (
    <div className="gcs-card p-3 flex flex-col items-center">
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Heading</div>
      <svg viewBox="0 0 120 120" width="100%" style={{ maxWidth: 140 }}>
        {/* Outer ring */}
        <circle cx={CX} cy={CY} r={R} fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="1" />
        {/* Tick marks */}
        {Array.from({ length: 36 }, (_, i) => {
          const angle = i * 10;
          const isCard = i % 9 === 0;
          const isMajor = i % 3 === 0;
          const outer = polar(angle, R - 1);
          const inner = polar(angle, R - (isCard ? 12 : isMajor ? 7 : 4));
          return (
            <line key={i} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
              stroke={isCard ? 'var(--accent)' : isMajor ? 'var(--text-secondary)' : 'var(--border-bright)'}
              strokeWidth={isCard ? 1.5 : 1} />
          );
        })}
        {/* Cardinal labels — these are fixed to compass, so they rotate with heading */}
        <g transform={`rotate(${-heading} ${CX} ${CY})`}>
          {DIRS.map((d, i) => {
            const a = i * 45;
            const pt = polar(a, R - 18);
            const isN = d === 'N';
            return (
              <text key={d} x={pt.x} y={pt.y + 3.5} fontSize={isN ? 9 : 7}
                fontWeight={isN ? 'bold' : 'normal'}
                fill={isN ? 'var(--accent-red)' : 'var(--text-secondary)'}
                textAnchor="middle">{d}</text>
            );
          })}
        </g>
        {/* Aircraft arrow (fixed, points up) */}
        <polygon
          points={`${arrowTip.x},${arrowTip.y} ${arrowLeft.x},${arrowLeft.y} ${arrowBack.x},${arrowBack.y} ${arrowRight.x},${arrowRight.y}`}
          fill="var(--accent)" opacity="0.9"
        />
        {/* Center dot */}
        <circle cx={CX} cy={CY} r="4" fill="var(--bg-card)" stroke="var(--accent)" strokeWidth="1.5" />
        {/* Heading value */}
        <text x={CX} y={CY + 3} fontSize="9" fontWeight="bold" fill="var(--text-primary)" textAnchor="middle" fontFamily="monospace">
          {Math.round(heading).toString().padStart(3, '0')}°
        </text>
      </svg>
    </div>
  );
}
