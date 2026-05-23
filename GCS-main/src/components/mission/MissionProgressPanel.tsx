'use client';
import { useEffect, useState } from 'react';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import {
  CheckCircle2, Circle, Navigation, Clock, Route,
  Flag, Zap, Target, TrendingUp, Plus, Minus, Square,
} from 'lucide-react';
import { drive, stop } from '@/lib/api/commands';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function MissionProgressPanel() {
  const waypoints       = useVehicleStore((s) => s.waypoints);
  const missionStatus   = useVehicleStore((s) => s.missionStatus);
  const currentWpIdx    = useVehicleStore((s) => s.currentWaypointIndex);
  const missionStart    = useVehicleStore((s) => s.missionStartTime);
  const telemetry       = useVehicleStore((s) => s.telemetry);
  const advanceWaypoint = useVehicleStore((s) => s.advanceWaypoint);
  const cruiseSpeed     = useVehicleStore((s) => s.cruiseSpeed);
  const setCruiseSpeed  = useVehicleStore((s) => s.setCruiseSpeed);
  const liveMission     = useVehicleStore((s) => s.liveMission);

  const [elapsed, setElapsed] = useState(0);

  // Sync cruiseSpeed with actual speed when not running a mission
  useEffect(() => {
    if (missionStatus !== 'running' && telemetry.speed > 0) {
      setCruiseSpeed(Math.round(telemetry.speed));
    }
  }, [missionStatus, telemetry.speed, setCruiseSpeed]);

  // Elapsed time ticker — use server started_at when available
  const effectiveStart = liveMission?.startedAt ?? missionStart;
  useEffect(() => {
    if (missionStatus !== 'running' || !effectiveStart) return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - new Date(effectiveStart).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [missionStatus, effectiveStart]);

  const sorted = [...waypoints].sort((a, b) => a.sequence - b.sequence);

  // ── Client-side fallback calculations (used only when liveMission is absent) ──
  const totalDistance = sorted.reduce((acc, wp, i) => {
    if (i === 0) return acc;
    return acc + haversineDistance(sorted[i - 1].lat, sorted[i - 1].lng, wp.lat, wp.lng);
  }, 0);

  const coveredDistance = sorted.slice(0, currentWpIdx).reduce((acc, wp, i) => {
    if (i === 0) return acc;
    return acc + haversineDistance(sorted[i - 1].lat, sorted[i - 1].lng, wp.lat, wp.lng);
  }, 0);

  let clientDistToNext: number | null = null;
  if (currentWpIdx < sorted.length && telemetry.position.lat !== 0) {
    const target = sorted[currentWpIdx];
    clientDistToNext = haversineDistance(
      telemetry.position.lat, telemetry.position.lng,
      target.lat, target.lng,
    );
  }

  let clientRemainingDist = 0;
  if (clientDistToNext !== null) {
    clientRemainingDist = clientDistToNext;
    for (let i = currentWpIdx; i < sorted.length - 1; i++) {
      clientRemainingDist += haversineDistance(
        sorted[i].lat, sorted[i].lng,
        sorted[i + 1].lat, sorted[i + 1].lng,
      );
    }
  }

  // ── Server-authoritative values (preferred) ──
  const progressPct      = liveMission ? Math.round(liveMission.progress.percent) : (totalDistance > 0 ? Math.round((coveredDistance / totalDistance) * 100) : 0);
  const completedCount   = liveMission ? liveMission.progress.reached             : Math.min(currentWpIdx, sorted.length);
  const totalWpCount     = liveMission ? liveMission.progress.total               : sorted.length;
  const distToNext       = liveMission ? liveMission.progress.distToNextM         : clientDistToNext;
  const totalRemainingDist = liveMission ? liveMission.progress.distRemainingM    : clientRemainingDist;

  const statusColor =
    missionStatus === 'running' ? 'var(--accent-green)'
    : missionStatus === 'paused' ? 'var(--accent-yellow)'
    : 'var(--text-dim)';

  return (
    <div
      className="flex flex-col gap-3"
      style={{ width: 300, flexShrink: 0, overflowY: 'auto', maxHeight: '100%' }}
    >
      {/* ── Mission Stats Card ── */}
      <div
        className="gcs-card p-4 flex flex-col gap-3"
        style={{ border: `1px solid ${missionStatus === 'running' ? 'rgba(16,185,129,0.35)' : 'var(--border-subtle)'}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag size={13} style={{ color: 'var(--accent)' }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
              Mission Progress
            </span>
          </div>
          <span
            className="text-[9px] uppercase font-bold px-2 py-0.5 rounded"
            style={{
              background: missionStatus === 'running' ? 'rgba(16,185,129,0.15)'
                : missionStatus === 'paused' ? 'rgba(245,158,11,0.15)'
                : 'rgba(255,255,255,0.05)',
              color: statusColor,
              border: `1px solid ${statusColor}`,
            }}
          >
            {missionStatus}
          </span>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-[9px] mb-1" style={{ color: 'var(--text-dim)' }}>
            <span>Completion</span>
            <span style={{ color: 'var(--accent-green)', fontFamily: 'monospace' }}>{progressPct}%</span>
          </div>
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, var(--accent-green), var(--accent))',
              }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: CheckCircle2, label: 'Completed', value: `${completedCount} / ${totalWpCount}`, color: 'var(--accent-green)' },
            { icon: Clock,        label: 'Elapsed',   value: effectiveStart ? formatElapsed(elapsed) : '--:--',   color: 'var(--accent)' },
            { icon: Route,        label: 'Covered',   value: coveredDistance >= 1000 ? `${(coveredDistance / 1000).toFixed(2)} km` : `${coveredDistance.toFixed(0)} m`, color: 'var(--text-primary)' },
            { icon: Target,       label: 'Dist→Next', value: distToNext != null ? (distToNext >= 1000 ? `${(distToNext / 1000).toFixed(2)} km` : `${distToNext.toFixed(0)} m`) : '—', color: 'var(--accent-yellow)' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="flex flex-col gap-1 p-2 rounded"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-1">
                <Icon size={10} style={{ color: 'var(--text-dim)' }} />
                <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{label}</span>
              </div>
              <span className="text-xs font-bold font-mono" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Bot speed / heading / goal dist */}
        <div className="flex gap-2">
          {[
            { icon: Zap,       label: 'Speed',   value: `${telemetry.speed.toFixed(1)} m/s` },
            { icon: Navigation, label: 'Heading', value: `${telemetry.heading.toFixed(0)}°`  },
            { icon: TrendingUp, label: 'Goal Dist', value: totalRemainingDist >= 1000 ? `${(totalRemainingDist / 1000).toFixed(2)} km` : `${totalRemainingDist.toFixed(1)} m` },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <Icon size={10} style={{ color: 'var(--accent)' }} />
              <span className="text-[8px]" style={{ color: 'var(--text-dim)' }}>{label}</span>
              <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* ── Speed Control Card ── */}
      <div className="gcs-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={13} style={{ color: 'var(--accent-yellow)' }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
              Speed Control
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)]" style={{ color: 'var(--text-dim)' }}>
              Actual: <span className="font-mono font-bold text-[var(--text-primary)]">{telemetry.speed.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Set Speed Display */}
        <div className="flex items-center justify-center gap-4 py-1">
          <button 
            onClick={() => { 
              const currentActual = telemetry.speed || 0;
              // If target is stale (far from actual) or 0, use actual as base
              const isStale = Math.abs(cruiseSpeed - currentActual) > 10;
              const base = (isStale || cruiseSpeed === 0) ? currentActual : cruiseSpeed;
              const ns = Math.max(0, Math.round(base - 5)); 
              setCruiseSpeed(ns); 
              drive(ns, 0).catch(() => null);
            }}
            className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-red)] text-[var(--accent-red)] transition-all"
            title="Decrease -5"
          >
            <Minus size={16} />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-[8px] uppercase text-[var(--text-dim)]">Target Speed</span>
            <span className="text-2xl font-mono font-bold text-[var(--accent)]">{cruiseSpeed.toFixed(0)}</span>
            <span className="text-[9px] text-[var(--text-dim)]">m/s</span>
          </div>

          <button 
            onClick={() => { 
              const currentActual = telemetry.speed || 0;
              // If target is stale (far from actual) or 0, use actual as base
              const isStale = Math.abs(cruiseSpeed - currentActual) > 10;
              const base = (isStale || cruiseSpeed === 0) ? currentActual : cruiseSpeed;
              const ns = Math.round(base + 5); 
              setCruiseSpeed(ns); 
              drive(ns, 0).catch(() => null);
            }}
            className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-green)] text-[var(--accent-green)] transition-all"
            title="Increase +5"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Stop Button */}
        <button 
          onClick={() => { setCruiseSpeed(0); stop().catch(() => null); }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all"
          style={{ 
            background: 'rgba(239,68,68,0.15)', 
            border: '1px solid var(--accent-red)', 
            color: 'var(--accent-red)',
            boxShadow: '0 0 10px rgba(239,68,68,0.1)' 
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
        >
          <Square size={14} fill="currentColor" />
          Emergency STOP
        </button>
      </div>

      {/* ── Waypoint Timeline Card ── */}
      <div className="gcs-card p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 mb-1">
          <Navigation size={13} style={{ color: 'var(--accent-green)' }} />
          <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Waypoints <span style={{ color: 'var(--accent)' }}>({totalWpCount})</span>
          </span>
        </div>

        {sorted.length === 0 ? (
          <div className="text-xs text-center py-8" style={{ color: 'var(--text-dim)' }}>
            No waypoints loaded.<br />
            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>Go to Mission to add waypoints.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sorted.map((wp, idx) => {
              // Prefer server-authoritative reached flag; fall back to index comparison
              const liveWp   = liveMission?.waypoints.find(w => w.sequence === wp.sequence);
              const isDone   = liveWp ? liveWp.reached : idx < currentWpIdx;
              const isActive = !isDone && idx === (liveMission ? completedCount : currentWpIdx) && missionStatus === 'running';
              const isPending = !isDone && !isActive;

              const lineColor = isDone ? 'var(--accent-green)' : 'var(--border-subtle)';
              const dotColor  = isDone ? 'var(--accent-green)' : isActive ? 'var(--accent)' : 'var(--text-dim)';
              const bgColor   = isActive
                ? 'rgba(0,180,255,0.10)'
                : isDone
                ? 'rgba(16,185,129,0.08)'
                : 'var(--bg-elevated)';
              const borderColor = isActive
                ? 'rgba(0,180,255,0.4)'
                : isDone
                ? 'rgba(16,185,129,0.3)'
                : 'var(--border-subtle)';

              return (
                <div key={wp.id} className="relative flex items-start gap-2">
                  {/* Vertical connector line */}
                  <div className="flex flex-col items-center" style={{ minWidth: 20 }}>
                    {isDone ? (
                      <CheckCircle2 size={18} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                    ) : isActive ? (
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    ) : (
                      <Circle size={18} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                    )}
                    {/* Connecting line to next waypoint */}
                    {idx < sorted.length - 1 && (
                      <div
                        style={{
                          width: 2,
                          flex: 1,
                          minHeight: 16,
                          background: lineColor,
                          marginTop: 2,
                          borderRadius: 1,
                          transition: 'background 0.5s',
                        }}
                      />
                    )}
                  </div>

                  {/* WP card */}
                  <div
                    className="flex-1 mb-1 p-2 rounded transition-all duration-300"
                    style={{ background: bgColor, border: `1px solid ${borderColor}` }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: isDone ? 'var(--accent-green)' : isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
                      >
                        WP {wp.sequence + 1}
                        {isActive && (
                          <span
                            className="ml-1 text-[8px] px-1 py-0.5 rounded"
                            style={{ background: 'rgba(0,180,255,0.2)', color: 'var(--accent)', border: '1px solid rgba(0,180,255,0.3)' }}
                          >
                            ACTIVE
                          </span>
                        )}
                        {isDone && (
                          <span
                            className="ml-1 text-[8px] px-1 py-0.5 rounded"
                            style={{ background: 'rgba(16,185,129,0.2)', color: 'var(--accent-green)', border: '1px solid rgba(16,185,129,0.3)' }}
                          >
                            DONE
                          </span>
                        )}
                      </span>
                      <span className="text-[9px] font-mono" style={{ color: 'var(--text-dim)' }}>
                        Alt: {wp.alt}m
                      </span>
                    </div>
                    <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--text-dim)' }}>
                      {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
                    </div>

                    {/* Advance button (dev helper) */}
                    {isActive && missionStatus === 'running' && (
                      <button
                        onClick={advanceWaypoint}
                        className="mt-1.5 w-full text-[9px] py-0.5 rounded"
                        style={{
                          background: 'rgba(16,185,129,0.12)',
                          border: '1px solid rgba(16,185,129,0.3)',
                          color: 'var(--accent-green)',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Mark Reached
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-3 pt-1 mt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {[
            { color: 'var(--accent-green)', label: 'Completed' },
            { color: 'var(--accent)',       label: 'Active'    },
            { color: 'var(--text-dim)',     label: 'Pending'   },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
