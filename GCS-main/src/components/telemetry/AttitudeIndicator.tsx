'use client';
import { useVehicleStore } from '@/lib/store/vehicleStore';

const SIZE = 120, CX = 60, CY = 60, R = 52;
const CLIP_ID = 'adi-clip';

// Round to 3 dp: Math.cos/sin differ at the last ULP between the Node (SSR) and
// browser engines, which otherwise trips React's hydration check on SVG coords.
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function AttitudeIndicator() {
  const { roll, pitch } = useVehicleStore((s) => s.telemetry.attitude);

  // Pitch: shift horizon up/down. Each degree = ~1.5px
  const pitchOffset = pitch * 1.5;

  // Horizon line: passes through center, tilted by roll
  const rollRad = (roll * Math.PI) / 180;
  const cos = Math.cos(rollRad);
  const sin = Math.sin(rollRad);
  const horizLen = R * 1.4;

  // Sky and ground boundary
  const skyPath = [
    `M ${CX - horizLen * cos} ${CY - horizLen * sin + pitchOffset}`,
    `L ${CX + horizLen * cos} ${CY + horizLen * sin + pitchOffset}`,
    `A ${R * 2} ${R * 2} 0 0 1 ${CX - horizLen * cos} ${CY - horizLen * sin + pitchOffset}`,
  ].join(' ');

  return (
    <div className="gcs-card p-3 flex flex-col items-center">
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Attitude</div>
      <svg viewBox="0 0 120 120" width="100%" style={{ maxWidth: 140 }}>
        <defs>
          <clipPath id={CLIP_ID}>
            <circle cx={CX} cy={CY} r={R} />
          </clipPath>
        </defs>

        {/* Ground (brown fill — whole circle) */}
        <circle cx={CX} cy={CY} r={R} fill="#5c3a1e" clipPath={`url(#${CLIP_ID})`} />

        {/* Sky triangle clipped to circle */}
        <g clipPath={`url(#${CLIP_ID})`}>
          <rect
            x={CX - horizLen}
            y={CY - R * 2 + pitchOffset}
            width={horizLen * 2}
            height={R * 2}
            transform={`rotate(${roll} ${CX} ${CY})`}
            fill="#1a3a6b"
          />
        </g>

        {/* Horizon line */}
        <line
          x1={CX - horizLen * cos}
          y1={CY - horizLen * sin + pitchOffset}
          x2={CX + horizLen * cos}
          y2={CY + horizLen * sin + pitchOffset}
          stroke="white" strokeWidth="1.5"
          clipPath={`url(#${CLIP_ID})`}
        />

        {/* Pitch ladder lines */}
        {[-10, -5, 5, 10].map((deg) => {
          const offset = pitchOffset - deg * 1.5;
          const w = deg % 10 === 0 ? 20 : 12;
          return (
            <g key={deg} clipPath={`url(#${CLIP_ID})`}>
              <line
                x1={CX - w * cos + (deg * 1.5) * sin}
                y1={CY - w * sin - (deg * 1.5) * cos + offset + deg * 1.5}
                x2={CX + w * cos + (deg * 1.5) * sin}
                y2={CY + w * sin - (deg * 1.5) * cos + offset + deg * 1.5}
                stroke="white" strokeWidth="0.8" opacity="0.6"
              />
            </g>
          );
        })}

        {/* Aircraft reticle */}
        <line x1={CX - 22} y1={CY} x2={CX - 8} y2={CY} stroke="var(--accent-yellow)" strokeWidth="2" />
        <line x1={CX + 8} y1={CY} x2={CX + 22} y2={CY} stroke="var(--accent-yellow)" strokeWidth="2" />
        <circle cx={CX} cy={CY} r="3" fill="none" stroke="var(--accent-yellow)" strokeWidth="1.5" />

        {/* Roll indicator arc at top */}
        {[-30, -20, -10, 10, 20, 30].map((a) => {
          const rad = (a - 90) * Math.PI / 180;
          const x1 = r3(CX + (R - 6) * Math.cos(rad));
          const y1 = r3(CY + (R - 6) * Math.sin(rad));
          const x2 = r3(CX + R * Math.cos(rad));
          const y2 = r3(CY + R * Math.sin(rad));
          return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="1" opacity="0.5" />;
        })}
        {/* Roll pointer */}
        <polygon
          points={`${CX},${CY - R + 6} ${CX - 4},${CY - R + 13} ${CX + 4},${CY - R + 13}`}
          fill="white" transform={`rotate(${roll} ${CX} ${CY})`}
        />

        {/* Border ring */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border-default)" strokeWidth="2" />

        {/* Values */}
        <text x="8" y="114" fontSize="8" fill="var(--text-secondary)">R {roll.toFixed(1)}°</text>
        <text x="112" y="114" fontSize="8" fill="var(--text-secondary)" textAnchor="end">P {pitch.toFixed(1)}°</text>
      </svg>
    </div>
  );
}
