import type {
  Telemetry,
  Waypoint,
  Alert,
  AlertSeverity,
  GCSSettings,
  Position,
  Attitude,
  Battery,
  TelemetryPoint,
  ConnectionStatus,
  MissionStatus,
  BreadcrumbPoint,
  Transport,
  CameraFeed,
  ServerMission,
} from '@/lib/store/vehicleStore';

export type {
  Telemetry,
  Waypoint,
  Alert,
  AlertSeverity,
  GCSSettings,
  Position,
  Attitude,
  Battery,
  TelemetryPoint,
  ConnectionStatus,
  MissionStatus,
  BreadcrumbPoint,
  Transport,
  CameraFeed,
  ServerMission,
};

// Mission session entry (historical mission log row).
export interface Session {
  id: string;
  name: string;
  date: string;
  duration: string;
  waypoints: number;
  distance: string;
  status: string;
}

// Login form
export interface LoginFormValues {
  email: string;
  password: string;
}

// Mission plan file format used for import/export
export interface MissionPlan {
  version: number;
  type: string;
  created: string;
  waypoints: Waypoint[];
}
