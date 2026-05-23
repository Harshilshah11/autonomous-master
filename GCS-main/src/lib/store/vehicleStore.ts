import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Position { lat: number; lng: number; alt: number; x: number; y: number; z: number; }
export interface Attitude { roll: number; pitch: number; yaw: number; }
export interface Battery { voltage: number; current: number; percentage: number; }
export interface Gps { fix: string; satellites: number; }
export interface Sigma { x: number; y: number; }
export interface Telemetry {
  position: Position;
  attitude: Attitude;
  battery: Battery;
  speed: number;
  heading: number;
  botMode: string;
  isArmed: boolean;
  connected: boolean;
  gps: Gps;
  sigma: Sigma;
  telemHz: number;
  uptimeMs: number;
  packetNumber: number;
  timestamp: string;
  botId: string;
}
export interface Waypoint { id: string; lat: number; lng: number; alt: number; sequence: number; label?: string; }

export interface ServerMission {
  id: string;
  name: string;
  description: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  modified_at: string | null;
  waypoint_count: number;
  is_active: boolean;
}
export type AlertSeverity = 'info' | 'warning' | 'critical';
export interface Alert { id: string; type: string; message: string; timestamp: string; severity: AlertSeverity; }
export interface TelemetryPoint { time: string; speed: number; heading: number; alt: number; battery: number; batteryV: number; }
export type MissionStatus = 'idle' | 'running' | 'paused';
export type WaypointStatus = 'pending' | 'active' | 'completed';
export type MapStyle = 'dark' | 'satellite' | 'street';
export type BreadcrumbPoint = { lat: number; lng: number };
export interface Mission { id: string; name: string; waypoints: Waypoint[]; }

export interface CameraFeed {
  id: string;
  label: string;
  rtspUrl: string;
  enabled: boolean;
}

export interface MissionProgress {
  reached: number;
  total: number;
  percent: number;
  distToNextM: number;
  distRemainingM: number;
}

export interface LiveWaypoint {
  sequence: number;
  lat: number;
  lng: number;
  alt: number;
  label: string;
  reached: boolean;
  reachedAt: string | null;
}

export interface LiveMission {
  id: string;
  name: string;
  status: string;
  startedAt: string | null;
  progress: MissionProgress;
  waypoints: LiveWaypoint[];
}

export interface ConnectionStatus {
  connected: boolean;
  latency: number;
  lastHeartbeat: string;
}

export type Transport = 'wifi' | 'uart';

export interface GCSSettings {
  transport: Transport;        // selected link between GCS and Jetson
  ip: string;                  // WiFi: Jetson IP
  port: number;                // WiFi: Jetson HTTP port
  uartDevice: string;          // UART: serial device path (e.g. COM6, /dev/ttyUSB0)
  uartBaud: number;            // UART: baud rate
  reconnectInterval: number;
  batteryThreshold: number;
  speedThreshold: number;
  mapStyle: MapStyle;
  showBreadcrumb: boolean;
  showGeofence: boolean;
  chartRefreshMs: number;
  cameraFeeds: CameraFeed[];
}

interface VehicleStore {
  telemetry: Telemetry;
  breadcrumb: BreadcrumbPoint[];
  telemetryHistory: TelemetryPoint[];
  waypoints: Waypoint[];
  alerts: Alert[];
  isArmed: boolean;
  missionStatus: MissionStatus;
  connectionStatus: ConnectionStatus;
  geofence: BreadcrumbPoint[];
  settings: GCSSettings;
  currentWaypointIndex: number;  // index of waypoint bot is currently heading to
  missionStartTime: string | null; // ISO timestamp when mission started
  missions: Mission[];
  currentMissionId: string | null;
  cruiseSpeed: number;
  liveMission: LiveMission | null;
  serverMissions: ServerMission[];
  activeMissionServerId: string | null;

  updateTelemetry: (t: Telemetry) => void;
  addWaypoint: (wp: Omit<Waypoint, 'id'>) => void;
  removeWaypoint: (id: string) => void;
  reorderWaypoints: (waypoints: Waypoint[]) => void;
  setArmed: (armed: boolean) => void;
  setMissionStatus: (status: MissionStatus) => void;
  setCurrentWaypointIndex: (index: number) => void;
  advanceWaypoint: () => void;
  addAlert: (alert: Omit<Alert, 'id'>) => void;
  clearAlerts: () => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  updateSettings: (patch: Partial<GCSSettings>) => void;
  setGeofence: (points: BreadcrumbPoint[]) => void;
  setBotMode: (mode: string) => void;
  clearWaypoints: () => void;
  addMission: (name: string) => void;
  removeMission: (id: string) => void;
  selectMission: (id: string) => void;
  renameMission: (id: string, name: string) => void;
  setCruiseSpeed: (speed: number) => void;
  setLiveMission: (mission: LiveMission | null) => void;
  setServerMissions: (missions: ServerMission[], activeId: string | null) => void;
  setActiveMissionServerId: (id: string | null) => void;
  loadServerWaypoints: (wps: Array<{ sequence: number; lat: number; lng: number; alt: number; label: string }>) => void;
}

const DEFAULT_TELEMETRY: Telemetry = {
  position: { lat: 0, lng: 0, alt: 0, x: 0, y: 0, z: 0 },
  attitude: { roll: 0, pitch: 0, yaw: 0 },
  battery: { voltage: 0, current: 0, percentage: 0 },
  speed: 0,
  heading: 0,
  botMode: 'MANUAL',
  isArmed: false,
  connected: false,
  gps: { fix: '', satellites: 0 },
  sigma: { x: 0, y: 0 },
  telemHz: 0,
  uptimeMs: 0,
  packetNumber: 0,
  timestamp: '',
  botId: '',
};

const DEFAULT_SETTINGS: GCSSettings = {
  transport: 'wifi',
  ip: '192.168.1.100',
  port: 8000,
  uartDevice: 'COM6',
  uartBaud: 460800,
  reconnectInterval: 3,
  batteryThreshold: 20,
  speedThreshold: 8,
  mapStyle: 'dark',
  showBreadcrumb: true,
  showGeofence: true,
  chartRefreshMs: 1000,
  cameraFeeds: [
    { id: 'cam1', label: 'Camera 1 – Front', rtspUrl: '', enabled: false },
    { id: 'cam2', label: 'Camera 2 – Rear',  rtspUrl: '', enabled: false },
    { id: 'cam3', label: 'Camera 3 – Left',  rtspUrl: '', enabled: false },
    { id: 'cam4', label: 'Camera 4 – Right', rtspUrl: '', enabled: false },
  ],
};

function fmtTime() {
  return new Date().toLocaleTimeString('en-IN', { hour12: false });
}

export const useVehicleStore = create<VehicleStore>()(
  persist(
    (set) => ({
      telemetry: DEFAULT_TELEMETRY,
      breadcrumb: [],
      telemetryHistory: [],
      waypoints: [],
      alerts: [],
      isArmed: false,
      missionStatus: 'idle',
      connectionStatus: { connected: false, latency: 0, lastHeartbeat: new Date().toISOString() },
      geofence: [],
      settings: DEFAULT_SETTINGS,
      currentWaypointIndex: 0,
      missionStartTime: null,
      missions: [{ id: 'default', name: 'Mission 1', waypoints: [] }],
      currentMissionId: 'default',
      cruiseSpeed: 5.0,
      liveMission: null,
      serverMissions: [],
      activeMissionServerId: null,

      updateTelemetry: (t) => set((state) => {
        const point: TelemetryPoint = {
          time: fmtTime(),
          speed: t.speed,
          heading: t.heading,
          alt: t.position.alt,
          battery: t.battery.percentage,
          batteryV: t.battery.voltage,
        };
        return {
          telemetry: t,
          isArmed: t.isArmed,
          breadcrumb: (t.position.lat !== 0 && t.position.lng !== 0) 
            ? [...state.breadcrumb.slice(-199), { lat: t.position.lat, lng: t.position.lng }]
            : state.breadcrumb,
          telemetryHistory: [...state.telemetryHistory.slice(-59), point],
        };
      }),

      addWaypoint: (wp) => set((state) => ({
        waypoints: [...state.waypoints, { ...wp, id: crypto.randomUUID() }],
      })),
      removeWaypoint: (id) => set((state) => ({
        waypoints: state.waypoints
          .filter((w) => w.id !== id)
          .map((w, i) => ({ ...w, sequence: i })),
      })),
      reorderWaypoints: (waypoints) => set({ waypoints }),
      setArmed: (armed) => set({ isArmed: armed }),
      setMissionStatus: (status) => set((state) => ({
        missionStatus: status,
        // Reset progress when mission starts fresh
        currentWaypointIndex: status === 'running' && state.missionStatus === 'idle' ? 0 : state.currentWaypointIndex,
        missionStartTime: status === 'running' && state.missionStatus === 'idle' ? new Date().toISOString() : state.missionStartTime,
      })),
      setCurrentWaypointIndex: (index) => set({ currentWaypointIndex: index }),
      advanceWaypoint: () => set((state) => ({
        currentWaypointIndex: Math.min(state.currentWaypointIndex + 1, state.waypoints.length),
      })),

      addAlert: (alert) => set((state) => ({
        alerts: [{ ...alert, id: crypto.randomUUID() }, ...state.alerts].slice(0, 200),
      })),
      clearAlerts: () => set({ alerts: [] }),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      updateSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
      setGeofence: (points) => set({ geofence: points }),
      setBotMode: (mode) => set((state) => ({ 
        telemetry: { ...state.telemetry, botMode: mode } 
      })),
      clearWaypoints: () => set({ waypoints: [], currentWaypointIndex: 0, missionStartTime: null }),

      addMission: (name) => set((state) => {
        const newMission = { id: crypto.randomUUID(), name, waypoints: [] };
        return {
          missions: [...state.missions, newMission],
          currentMissionId: newMission.id,
          waypoints: [],
          currentWaypointIndex: 0,
          missionStartTime: null,
          missionStatus: 'idle'
        };
      }),
      removeMission: (id) => set((state) => {
        if (state.missions.length <= 1) return state;
        const newMissions = state.missions.filter(m => m.id !== id);
        const newSelectedId = state.currentMissionId === id ? newMissions[0].id : state.currentMissionId;
        const newSelectedMission = newMissions.find(m => m.id === newSelectedId)!;
        return {
          missions: newMissions,
          currentMissionId: newSelectedId,
          waypoints: newSelectedMission.waypoints,
          currentWaypointIndex: 0,
          missionStartTime: null,
          missionStatus: 'idle'
        };
      }),
      selectMission: (id) => set((state) => {
        const mission = state.missions.find(m => m.id === id);
        if (!mission) return state;
        return {
          currentMissionId: id,
          waypoints: mission.waypoints,
          currentWaypointIndex: 0,
          missionStartTime: null,
          missionStatus: 'idle'
        };
      }),
      renameMission: (id, name) => set((state) => ({
        missions: state.missions.map(m => m.id === id ? { ...m, name } : m)
      })),
      setCruiseSpeed: (speed) => set({ cruiseSpeed: Math.max(0, speed) }),
      setLiveMission: (mission) => set({ liveMission: mission }),

      setServerMissions: (missions, activeId) => set({
        serverMissions: missions,
        activeMissionServerId: activeId ?? null,
      }),
      setActiveMissionServerId: (id) => set({ activeMissionServerId: id }),
      loadServerWaypoints: (wps) => set({
        waypoints: wps.map((wp) => ({
          id: crypto.randomUUID(),
          lat: wp.lat,
          lng: wp.lng,
          alt: wp.alt,
          sequence: wp.sequence,
          label: wp.label,
        })),
        currentWaypointIndex: 0,
        missionStartTime: null,
      }),
    }),
    {
      name: 'arnobot-gcs-storage',
      version: 4,                                // bumped after server-backed missions
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        waypoints: state.waypoints,
        settings: state.settings,
        botMode: state.telemetry.botMode,
        missions: state.missions,
        currentMissionId: state.currentMissionId,
        cruiseSpeed: state.cruiseSpeed
      }),
      // Backfill defaults onto persisted state from earlier versions so newly
      // added settings fields aren't `undefined` on first render (otherwise
      // <input value={...}> flips from uncontrolled to controlled).
      migrate: (persisted: any) => {
        if (persisted && persisted.settings) {
          persisted.settings = { ...DEFAULT_SETTINGS, ...persisted.settings };
        }
        return persisted;
      },
      merge: (persisted: any, current) => {
        const next = { ...current, ...(persisted ?? {}) };
        next.settings = { ...DEFAULT_SETTINGS, ...(persisted?.settings ?? {}) };
        return next;
      },
      onRehydrateStorage: () => {
        return (rehydratedState) => {
          if (rehydratedState && (rehydratedState as any).botMode) {
            rehydratedState.telemetry.botMode = (rehydratedState as any).botMode;
          }
        };
      },
    }
  )
);
