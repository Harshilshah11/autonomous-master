# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Build:** `npm run build` — compiles TypeScript via `tsc`, output goes to `dist/`
- No test or lint scripts are configured yet.

## Architecture

ArnobotGCS is a React + TypeScript frontend for controlling a UGV (Unmanned Ground Vehicle) running on a Jetson Orin. The web app communicates with a FastAPI server on the Jetson over a local WiFi network.

- **Framework:** Next.js
- **Map:** react-map-gl (GPS tracking, waypoints, geofence)
- **Charts:** Recharts (telemetry time-series)
- **State:** Zustand (`src/store/vehicleStore.ts`)
- **Communication:** GraphQL (real-time telemetry and commands)
- **Styling:** Tailwind CSS

## Communication Layer

The app connects to the Jetson at a fixed local IP (e.g. `192.168.1.100:8000`). GraphQL handles both real-time telemetry (subscriptions) and commands (arm, RTH, mission upload, emergency stop). Auto-reconnect is required for field reliability.

## Key MAVLink Messages

| Message | Purpose |
|---|---|
| `GLOBAL_POSITION_INT` | GPS position for map |
| `ODOMETRY` | XYZ position + velocities |
| `ATTITUDE` | Roll, pitch, yaw |
| `BATTERY_STATUS` | Voltage, current, % |
| `STATUSTEXT` | System alerts |
| `HEARTBEAT` | Vehicle state and flight mode |
| `MISSION_ITEM_INT` / `MISSION_ACK` | Waypoint upload/confirmation |

## Planned Source Layout

```
src/
├── components/
│   ├── map/          # Map, waypoint markers, geofence
│   ├── telemetry/    # Speed gauge, compass, XYZ, battery
│   ├── mission/      # Upload panel, mission list, commands
│   ├── alerts/       # Toast notifications, status bar
│   └── settings/     # Connection config, thresholds
├── store/
│   └── vehicleStore.ts   # Zustand store for all telemetry state
├── hooks/
│   └── useWebSocket.ts   # WebSocket connection + auto-reconnect
├── api/
│   └── commands.ts       # REST calls: arm, RTH, upload mission
└── App.tsx
```

## Phase Roadmap

- **Phase 1 (current):** Map + telemetry dashboard + mission control + alerts
- **Phase 2:** Logging/playback, settings/configuration UI
