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
};

// Shared GraphQL command result (arm, disarm, estop, rth, etc.)
export interface GqlCommandResult {
  success: boolean;
  message: string;
}

// Query response shapes
export interface GetTelemetryResponse        { telemetry: Telemetry; }
export interface GetConnectionStatusResponse { connectionStatus: ConnectionStatus; }
export interface GetAlertsResponse           { alerts: Alert[]; }
export interface GetWaypointsResponse        { waypoints: Waypoint[]; }
export interface GetSessionsResponse         { sessions: Session[]; }

// Mutation response shapes
export interface ArmMutationResponse           { arm: GqlCommandResult; }
export interface DisarmMutationResponse        { disarm: GqlCommandResult; }
export interface EmergencyStopMutationResponse { emergencyStop: GqlCommandResult; }
export interface RthMutationResponse           { returnToHome: GqlCommandResult; }
export interface StartMissionMutationResponse  { startMission: GqlCommandResult; }
export interface PauseMissionMutationResponse  { pauseMission: GqlCommandResult; }
export interface UploadMissionMutationResponse { uploadMission: GqlCommandResult; }

export interface WaypointInput {
  lat: number;
  lng: number;
  alt: number;
  sequence: number;
}

// Session (from GET_SESSIONS)
export interface Session {
  id: string;
  name: string;
  date: string;
  duration: string;
  waypoints: number;
  distance: string;
  status: string;
}

// Login GraphQL mutation response types
export interface VerifyTokenResponse {
  VerifyToken: { success: boolean };
}

export interface LoginMutationResponse {
  Login: { Response: string; token: string | null };
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
