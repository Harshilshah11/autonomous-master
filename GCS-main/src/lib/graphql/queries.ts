import { gql } from '@apollo/client';

export const GET_TELEMETRY = gql`
  query GetTelemetry {
    telemetry {
      position { lat lng alt x y z }
      attitude { roll pitch yaw }
      battery { voltage current percentage }
      speed
      heading
      flightMode
      isArmed
      connected
    }
  }
`;

export const GET_WAYPOINTS = gql`
  query GetWaypoints {
    waypoints { id lat lng alt sequence }
  }
`;

export const GET_ALERTS = gql`
  query GetAlerts {
    alerts { id type message timestamp severity }
  }
`;

export const GET_CONNECTION_STATUS = gql`
  query GetConnectionStatus {
    connectionStatus { connected latency lastHeartbeat }
  }
`;

export const GET_SESSIONS = gql`
  query GetSessions {
    sessions { id name date duration waypoints distance status }
  }
`;

export const MUTATION_ARM = gql`
  mutation Arm { arm { success message } }
`;

export const MUTATION_DISARM = gql`
  mutation Disarm { disarm { success message } }
`;

export const MUTATION_EMERGENCY_STOP = gql`
  mutation EmergencyStop { emergencyStop { success message } }
`;

export const MUTATION_RTH = gql`
  mutation ReturnToHome { returnToHome { success message } }
`;

export const MUTATION_START_MISSION = gql`
  mutation StartMission { startMission { success message } }
`;

export const MUTATION_PAUSE_MISSION = gql`
  mutation PauseMission { pauseMission { success message } }
`;

export const MUTATION_UPLOAD_MISSION = gql`
  mutation UploadMission($waypoints: [WaypointInput!]!) {
    uploadMission(waypoints: $waypoints) { success message }
  }
`;
