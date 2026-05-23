'use client';
// Polls the gcs_data_handler request/response API and maps responses into the
// Zustand vehicle store. The two concerns are independently toggleable so each
// page only fetches what it renders:
//
//   odometry → GET /ugv_odometry   → { ts, bot_id, data:{...} }  (telemetry + connection)
//   mission  → GET /mission_status → { ts, bot_id, mission:{...} or null } (live mission)
//
// The global layout polls odometry-only (the Header needs connection/battery on
// every page); mission pages add mission-only. Calling with no args polls both.

import { useEffect, useRef } from 'react';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import type { LiveMission, Telemetry } from '@/lib/store/vehicleStore';
import { fetchUgvOdometry, fetchMissionStatus } from '@/lib/api/commands';

const TELEM_INTERVAL_MS = 200; // 5 Hz

function gpsDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const a1 = (lat1 * Math.PI) / 180;
  const a2 = (lat2 * Math.PI) / 180;
  const da = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const x = Math.sin(da / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const WAYPOINT_REACH_RADIUS = 2.5;

export interface TelemetryPollerOptions {
  /** Poll GET /ugv_odometry → telemetry + connection status. Default true. */
  odometry?: boolean;
  /** Poll GET /mission_status → live mission + waypoint progress. Default true. */
  mission?: boolean;
}

export function useTelemetryPoller(opts: TelemetryPollerOptions = {}) {
  const { odometry = true, mission = true } = opts;

  const updateTelemetry     = useVehicleStore((s) => s.updateTelemetry);
  const setConnectionStatus = useVehicleStore((s) => s.setConnectionStatus);
  const addAlert            = useVehicleStore((s) => s.addAlert);
  const advanceWaypoint     = useVehicleStore((s) => s.advanceWaypoint);
  const setCurrentWpIndex   = useVehicleStore((s) => s.setCurrentWaypointIndex);
  const setMissionStatus    = useVehicleStore((s) => s.setMissionStatus);
  const setLiveMission      = useVehicleStore((s) => s.setLiveMission);

  const settingsKey = useVehicleStore(
    (s) => `${s.settings.transport}|${s.settings.ip}|${s.settings.port}`,
  );
  const intervalMs = useVehicleStore(
    (s) => Math.max(50, s.settings.reconnectInterval * 0 + TELEM_INTERVAL_MS),
  );
  const lastOkRef = useRef<number>(0);

  useEffect(() => {
    if (!odometry && !mission) return; // nothing to poll

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const tick = async () => {
      const t0 = performance.now();
      try {
        // Fire only the enabled requests; neither failure blocks the other.
        const [odoResult, missionResult] = await Promise.allSettled([
          odometry ? fetchUgvOdometry(controller.signal)  : Promise.resolve(null),
          mission  ? fetchMissionStatus(controller.signal) : Promise.resolve(null),
        ]);

        const dt = Math.round(performance.now() - t0);
        if (cancelled) return;

        // ── Odometry → telemetry + connection ────────────────────────────
        if (odometry) {
          const odoVal = odoResult.status === 'fulfilled' ? odoResult.value : null;
          const odoOk  = !!(odoVal && odoVal.ok && odoVal.data != null);

          if (odoOk && odoVal) {
            lastOkRef.current = Date.now();
            const d = odoVal.data as Record<string, unknown>;
            const prev = useVehicleStore.getState().telemetry;
            const batv = Number(d.batv ?? prev.battery.voltage);

            const telemetry: Telemetry = {
              position: {
                lat: Number(d.lat  ?? prev.position.lat),
                lng: Number(d.long ?? prev.position.lng), // server key is "long"
                alt: prev.position.alt,
                x:   Number(d.x   ?? prev.position.x),
                y:   Number(d.y   ?? prev.position.y),
                z:   prev.position.z,
              },
              attitude: {
                roll:  prev.attitude.roll,
                pitch: prev.attitude.pitch,
                yaw:   Number(d.yaw ?? prev.attitude.yaw),
              },
              battery: {
                voltage:    batv,
                current:    prev.battery.current,
                // Estimate % from voltage (12S LiPo ~50 V full)
                percentage: Math.min(100, Math.max(0, Math.round((batv / 50.0) * 100))),
              },
              speed:    Number(d.speed ?? d.vx ?? prev.speed),
              heading:  Number(d.yaw   ?? prev.heading),
              botMode:  prev.botMode,  // mode is GCS-driven; preserve locally
              isArmed:  prev.isArmed,
              connected: true,
              gps: {
                fix:        String(d.gps_fix ?? prev.gps.fix),
                satellites: Number(d.sat     ?? prev.gps.satellites), // server key is "sat"
              },
              sigma:      { x: Number(d.s_x ?? prev.sigma.x), y: Number(d.s_y ?? prev.sigma.y) },
              telemHz:    Number(d.hz        ?? prev.telemHz),
              uptimeMs:   Number(d.uptime_ms ?? prev.uptimeMs),
              packetNumber: prev.packetNumber + 1,
              timestamp:  String(odoVal.ts     ?? prev.timestamp),
              botId:      String(odoVal.bot_id ?? prev.botId),
            };

            updateTelemetry(telemetry);
            setConnectionStatus({ connected: true, latency: dt, lastHeartbeat: new Date().toISOString() });
          } else if (Date.now() - lastOkRef.current > 3000) {
            setConnectionStatus({ connected: false, latency: 0, lastHeartbeat: new Date().toISOString() });
          }
        }

        // ── Mission status → liveMission (or GPS-fallback advance) ────────
        if (mission) {
          const missionVal = missionResult.status === 'fulfilled' ? missionResult.value : null;

          if (missionVal && missionVal.ok && missionVal.mission) {
            const m = missionVal.mission as Record<string, unknown>;
            const progress = (m.progress ?? {}) as Record<string, number>;
            const rawWaypoints = (m.waypoints ?? []) as Record<string, unknown>[];

            const liveMission: LiveMission = {
              id:        String(m.id    ?? ''),
              name:      String(m.name  ?? ''),
              status:    String(m.status ?? ''),
              startedAt: (m.started_at as string) ?? null,
              progress: {
                reached:        Number(progress.reached         ?? 0),
                total:          Number(progress.total           ?? 0),
                percent:        Number(progress.percent         ?? 0),
                distToNextM:    Number(progress.dist_to_next_m  ?? 0),
                distRemainingM: Number(progress.dist_remaining_m ?? 0),
              },
              waypoints: rawWaypoints.map((wp) => ({
                sequence:  Number(wp.sequence  ?? 0),
                lat:       Number(wp.lat       ?? 0),
                lng:       Number(wp.lng       ?? 0),
                alt:       Number(wp.alt       ?? 0),
                label:     String(wp.label     ?? ''),
                reached:   Boolean(wp.reached),
                reachedAt: (wp.reached_at as string) ?? null,
              })),
            };

            setLiveMission(liveMission);

            const store = useVehicleStore.getState();
            const reachedCount = liveMission.progress.reached;
            if (reachedCount !== store.currentWaypointIndex) {
              setCurrentWpIndex(reachedCount);
            }

            if (liveMission.status === 'active' && store.missionStatus !== 'running') {
              setMissionStatus('running');
            } else if (liveMission.status === 'completed' && store.missionStatus === 'running') {
              setMissionStatus('idle');
              addAlert({
                type: 'MISSION',
                message: 'Mission complete — all waypoints reached',
                timestamp: new Date().toISOString(),
                severity: 'info',
              });
            }
          } else {
            // No server-side mission → GPS-based fallback waypoint advance,
            // using the latest position the odometry poll wrote to the store.
            const store = useVehicleStore.getState();
            const { waypoints, currentWaypointIndex, missionStatus, telemetry } = store;
            const sorted = [...waypoints].sort((a, b) => a.sequence - b.sequence);
            if (
              missionStatus === 'running' &&
              telemetry.position.lat !== 0 &&
              telemetry.position.lng !== 0 &&
              currentWaypointIndex < sorted.length
            ) {
              const target = sorted[currentWaypointIndex];
              const dist = gpsDistance(
                telemetry.position.lat, telemetry.position.lng,
                target.lat, target.lng,
              );
              if (dist <= WAYPOINT_REACH_RADIUS) {
                advanceWaypoint();
                addAlert({
                  type: 'MISSION',
                  message: `WP${currentWaypointIndex + 1} reached (${dist.toFixed(1)} m) → advancing`,
                  timestamp: new Date().toISOString(),
                  severity: 'info',
                });
                if (currentWaypointIndex + 1 >= sorted.length) {
                  setMissionStatus('idle');
                  addAlert({
                    type: 'MISSION',
                    message: 'Mission complete — all waypoints reached',
                    timestamp: new Date().toISOString(),
                    severity: 'info',
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        if (!cancelled && (err as Error).name !== 'AbortError') {
          if (odometry && Date.now() - lastOkRef.current > 3000) {
            setConnectionStatus({ connected: false, latency: 0, lastHeartbeat: new Date().toISOString() });
          }
        }
      } finally {
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      }
    };

    tick();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
    // settingsKey re-keys the effect when transport/IP/port changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey, intervalMs, odometry, mission]);
}
