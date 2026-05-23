// High-level command helpers that map UI actions to the gcs_data_handler routes.
//
// GET  /ugv_odometry                          → current bot position/telemetry
// GET  /mission_status                        → current mission progress + waypoints
// GET  /get_missions                          → list all missions
// GET  /device_status                         → Jetson-visible device probe
// GET  /ping                                  → liveness check
// POST /drive            {speed, direction}
// POST /mode             {botMode}
// POST /status           {armStatus}  ("Active" / "Inactive")
// POST /mission          {mission: [{lat,lng,alt,sequence,label?}, ...]}  (legacy, still works)
// POST /create_new_mission  {name, description?, waypoints: [...]}
// POST /set_mission_ugv     {mission_id}
// POST /edit_mission_waypoints  {mission_id, waypoints: [...]}

import { api, type GcsResponse } from './client';

export interface DriveCmd { speed: number; direction: number; }
export interface WaypointPayload {
  lat: number;
  lng: number;
  alt: number;
  sequence: number;
  label?: string;
}

// ── Motion ──────────────────────────────────────────────────────────────────
export function drive(speed: number, direction: number): Promise<GcsResponse> {
  return api.post('drive', { speed, direction });
}
export function stop(): Promise<GcsResponse> {
  return api.post('drive', { speed: 0, direction: 0 });
}

// ── Vehicle state ────────────────────────────────────────────────────────────
export function setMode(botMode: string): Promise<GcsResponse> {
  return api.post('mode', { botMode });
}
export function setArm(armed: boolean): Promise<GcsResponse> {
  return api.post('status', { armStatus: armed ? 'Active' : 'Inactive' });
}

// ── Mission (legacy single-shot upload — still registered on server) ─────────
export function uploadMission(waypoints: WaypointPayload[]): Promise<GcsResponse> {
  return api.post('mission', { mission: waypoints });
}

// ── Mission management (new routes) ─────────────────────────────────────────
export function createNewMission(
  name: string,
  waypoints: WaypointPayload[],
  description = '',
): Promise<GcsResponse> {
  return api.post('create_new_mission', { name, description, waypoints });
}

export function setMissionUgv(missionId: string): Promise<GcsResponse> {
  return api.post('set_mission_ugv', { mission_id: missionId });
}

export function editMissionWaypoints(
  missionId: string,
  waypoints: WaypointPayload[],
): Promise<GcsResponse> {
  return api.post('edit_mission_waypoints', { mission_id: missionId, waypoints });
}

// ── Telemetry ────────────────────────────────────────────────────────────────
export function fetchUgvOdometry(signal?: AbortSignal): Promise<GcsResponse> {
  return api.get('ugv_odometry', signal);
}
export function fetchMissionStatus(signal?: AbortSignal): Promise<GcsResponse> {
  return api.get('mission_status', signal);
}
export function fetchMissions(signal?: AbortSignal): Promise<GcsResponse> {
  return api.get('get_missions', signal);
}

// ── Utility ──────────────────────────────────────────────────────────────────
export function ping(signal?: AbortSignal): Promise<GcsResponse> {
  return api.get('ping', signal);
}
export function fetchDeviceStatus(signal?: AbortSignal): Promise<GcsResponse> {
  return api.get('device_status', signal);
}
