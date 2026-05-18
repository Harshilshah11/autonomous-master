'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import type { Telemetry, LiveMission } from '@/lib/store/vehicleStore';

/** Distance in metres between two GPS coords (Haversine formula) */
function gpsDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Metres the bot must be within the waypoint GPS to auto-mark it reached */
const WAYPOINT_REACH_RADIUS = 2.5;

const WS_URL = 'ws://localhost:8765';
const RECONNECT_INTERVAL = 3000;

/**
 * Connects to the Python telemetry_server.py WebSocket bridge.
 * Maps incoming serial telemetry data to the Zustand vehicleStore.
 */
let globalSendCommand: ((arg1: any, arg2?: number) => void) | null = null;

export const sendManualCommand = (arg1: any, arg2?: number) => {
  if (globalSendCommand) globalSendCommand(arg1, arg2);
};

export const sendSpeedCommand = (speed: number) => {
  if (globalSendCommand) (globalSendCommand as any)({ type: 'command', data: { cruiseSpeed: speed } });
};

export const stopBot = () => {
  if (globalSendCommand) (globalSendCommand as any)({ type: 'command', data: { action: 'STOP' } });
};

export const uploadMission = (waypoints: any[]) => {
  if (globalSendCommand) {
    // We use a internal trigger to send a different message type
    (globalSendCommand as any)({ type: 'mission', waypoints });
  }
};

export function useTelemetrySocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateTelemetry = useVehicleStore((s) => s.updateTelemetry);
  const setConnectionStatus = useVehicleStore((s) => s.setConnectionStatus);
  const addAlert = useVehicleStore((s) => s.addAlert);
  const advanceWaypoint = useVehicleStore((s) => s.advanceWaypoint);
  const setCurrentWpIndex = useVehicleStore((s) => s.setCurrentWaypointIndex);
  const setMissionStatus = useVehicleStore((s) => s.setMissionStatus);
  const setLiveMission = useVehicleStore((s) => s.setLiveMission);

  const connect = useCallback(() => {
    // Don't reconnect if already open
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      const watchdogTimer = { current: null as any };
      const resetWatchdog = () => {
        if (watchdogTimer.current) clearTimeout(watchdogTimer.current);
        watchdogTimer.current = setTimeout(() => {
          setConnectionStatus({
            connected: false,
            latency: 0,
            lastHeartbeat: new Date().toISOString(),
          });
        }, 5000); // 5 second timeout
      };

      ws.onopen = () => {
        console.log('[Telemetry] Connected to telemetry bridge');
        setConnectionStatus({
          connected: true,
          latency: 0,
          lastHeartbeat: new Date().toISOString(),
        });
        resetWatchdog();

        // Sync full state to telemetry on connection
        const state = useVehicleStore.getState();

        // 1. Sync bot mode
        ws.send(JSON.stringify({
          type: 'command',
          data: { botMode: state.telemetry.botMode || 'MANUAL' }
        }));

        // 2. Sync waypoints if any exist
        if (state.waypoints.length > 0) {
          ws.send(JSON.stringify({
            type: 'mission',
            waypoints: state.waypoints.map(w => ({ lat: w.lat, lng: w.lng, alt: w.alt, sequence: w.sequence }))
          }));
        }

        addAlert({
          type: 'SYSTEM',
          message: 'Telemetry synchronized',
          timestamp: new Date().toISOString(),
          severity: 'info',
        });

        // Start ping interval for accurate latency
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
          }
        }, 2000);

        (ws as any)._pingInterval = pingInterval;
      };

      ws.onmessage = (event) => {
        resetWatchdog();
        try {
          const data = JSON.parse(event.data);
          const now = Date.now();

          if (data.type === 'pong') {
            const rtt = now - data.ts;
            setConnectionStatus({
              connected: true,
              latency: rtt,
              lastHeartbeat: new Date().toISOString(),
            });
            return;
          }

          if (data.type === 'telemetry') {
            // Use current stored values as fallback so absent fields are never reset to 0
            const prev = useVehicleStore.getState().telemetry;
            const telemetry: Telemetry = {
              position: {
                lat: data.position?.lat ?? prev.position.lat,
                lng: data.position?.lng ?? prev.position.lng,
                alt: data.position?.alt ?? prev.position.alt,
                x: data.position?.x ?? prev.position.x,
                y: data.position?.y ?? prev.position.y,
                z: data.position?.z ?? prev.position.z,
              },
              attitude: {
                roll: data.attitude?.roll ?? prev.attitude.roll,
                pitch: data.attitude?.pitch ?? prev.attitude.pitch,
                yaw: data.attitude?.yaw ?? prev.attitude.yaw,
              },
              battery: {
                voltage: data.battery?.voltage ?? prev.battery.voltage,
                current: data.battery?.current ?? prev.battery.current,
                percentage: Math.round(data.battery?.percentage ?? prev.battery.percentage),
              },
              speed: data.speed ?? prev.speed,
              heading: data.heading ?? prev.heading,
              botMode: data.botMode ?? prev.botMode,
              isArmed: data.isArmed ?? prev.isArmed,
              connected: true,
              gps: {
                fix: data.gps?.fix ?? prev.gps.fix,
                satellites: data.gps?.satellites ?? prev.gps.satellites,
              },
              sigma: {
                x: data.sigma?.x ?? prev.sigma.x,
                y: data.sigma?.y ?? prev.sigma.y,
              },
              telemHz: data.telemHz ?? prev.telemHz,
              uptimeMs: data.uptimeMs ?? prev.uptimeMs,
              packetNumber: data.packetNumber ?? prev.packetNumber,
              timestamp: data.timestamp ?? prev.timestamp,
              botId: data.bot_id ?? prev.botId,
            };

            updateTelemetry(telemetry);

            // ── Mission data (server-authoritative) ──────────────────────
            if (data.mission) {
              const m = data.mission;
              const rawWaypoints: any[] = data.waypoints ?? m.waypoints ?? [];

              const liveMission: LiveMission = {
                id: m.id,
                name: m.name,
                status: m.status,
                startedAt: m.started_at ?? null,
                progress: {
                  reached: m.progress?.reached ?? 0,
                  total: m.progress?.total ?? 0,
                  percent: m.progress?.percent ?? 0,
                  distToNextM: m.progress?.dist_to_next_m ?? 0,
                  distRemainingM: m.progress?.dist_remaining_m ?? 0,
                },
                waypoints: rawWaypoints.map((wp: any) => ({
                  sequence: wp.sequence,
                  lat: wp.lat,
                  lng: wp.lng,
                  alt: wp.alt ?? 0,
                  label: wp.label ?? '',
                  reached: wp.reached ?? false,
                  reachedAt: wp.reached_at ?? null,
                })),
              };
              setLiveMission(liveMission);

              const store = useVehicleStore.getState();
              const reachedCount = m.progress?.reached ?? 0;
              if (reachedCount !== store.currentWaypointIndex) {
                setCurrentWpIndex(reachedCount);
              }

              if (m.status === 'active' && store.missionStatus !== 'running') {
                setMissionStatus('running');
              } else if (m.status === 'completed' && store.missionStatus === 'running') {
                setMissionStatus('idle');
                addAlert({ type: 'MISSION', message: 'Mission complete — all waypoints reached', timestamp: new Date().toISOString(), severity: 'info' });
              }
            } else {
              // ── GPS-based waypoint auto-advance (fallback) ───────────────
              const store = useVehicleStore.getState();
              const { waypoints, currentWaypointIndex, missionStatus } = store;

              if (typeof data.current_waypoint === 'number') {
                if (data.current_waypoint !== currentWaypointIndex) {
                  setCurrentWpIndex(data.current_waypoint);
                }
                if (data.current_waypoint >= waypoints.length && missionStatus === 'running') {
                  setMissionStatus('idle');
                  addAlert({ type: 'MISSION', message: 'Mission complete — all waypoints reached', timestamp: new Date().toISOString(), severity: 'info' });
                }
              } else {
                const botLat = telemetry.position.lat;
                const botLng = telemetry.position.lng;
                const sorted = [...waypoints].sort((a, b) => a.sequence - b.sequence);

                if (
                  missionStatus === 'running' &&
                  botLat !== 0 && botLng !== 0 &&
                  currentWaypointIndex < sorted.length
                ) {
                  const target = sorted[currentWaypointIndex];
                  const dist = gpsDistance(botLat, botLng, target.lat, target.lng);

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
                      addAlert({ type: 'MISSION', message: 'Mission complete — all waypoints reached', timestamp: new Date().toISOString(), severity: 'info' });
                    }
                  }
                }
              }
            }
            // ── End mission/waypoint logic ───────────────────────────────

            // Update connection status with timestamp
            setConnectionStatus({
              connected: true,
              latency: useVehicleStore.getState().connectionStatus.latency,
              lastHeartbeat: new Date().toISOString(),
            });
          } else if (data.type === 'heartbeat') {
            setConnectionStatus({
              connected: true,
              latency: useVehicleStore.getState().connectionStatus.latency,
              lastHeartbeat: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn('[Telemetry] Parse error:', err);
        }
      };

      ws.onclose = () => {
        if (watchdogTimer.current) clearTimeout(watchdogTimer.current);
        if ((ws as any)._pingInterval) clearInterval((ws as any)._pingInterval);
        console.log('[Telemetry] Disconnected — retrying in', RECONNECT_INTERVAL, 'ms');
        setConnectionStatus({
          connected: false,
          latency: 0,
          lastHeartbeat: new Date().toISOString(),
        });
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        console.warn('[Telemetry] WebSocket error:', err);
        ws.close();
      };

    } catch (err) {
      console.warn('[Telemetry] Connection failed:', err);
      scheduleReconnect();
    }
  }, [updateTelemetry, setConnectionStatus, addAlert, setLiveMission]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(() => {
      connect();
    }, RECONNECT_INTERVAL);
  }, [connect]);

  const sendCommand = useCallback((arg1: any, arg2?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      let msg = '';
      if (typeof arg1 === 'object') {
        msg = JSON.stringify(arg1);
        console.log('[Telemetry] Sending mission object:', arg1);
      } else {
        msg = JSON.stringify({
          type: 'command',
          data: { speed: arg1, direction: arg2 }
        });
        console.log('[Telemetry] Sending manual command:', arg1, arg2);
      }
      wsRef.current.send(msg);
    } else {
      console.warn('[Telemetry] Cannot send, WebSocket not open. State:', wsRef.current?.readyState);
    }
  }, []);

  useEffect(() => {
    globalSendCommand = sendCommand;
    return () => { globalSendCommand = null; };
  }, [sendCommand]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { sendCommand };
}
