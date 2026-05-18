# UGV Ground Control Station — Frontend Web App

## Overview

A browser-based Ground Control Station (GCS) for an Unmanned Ground Vehicle (UGV) powered by a Jetson Orin. The web app communicates in real time with a Django server running on the Jetson over a local WiFi network via WebSocket and REST.

---

## Technology Stack

| Layer | Technology   | Purpose |
|---|--------------|---|
| Framework | Next js      | UI component architecture |
| Map | react-map-gl | GPS map, waypoints, live tracking |
| Charts | Recharts     | Telemetry time-series plots |
| State | Zustand      | Global WebSocket data store |
| Communication | Graphql      | Real-time telemetry and commands |
| Styling | Tailwind CSS | Utility-first responsive layout |

---

## Communication

The web app connects to the Jetson Orin at a fixed local IP (e.g. `192.168.1.100:8000`).

- **Graphql** — sends commands (arm, upload mission, RTH, emergency stop)

---

## Feature Modules

### 1. Map & Navigation

Core map interface for situational awareness and mission planning.

- **Live vehicle position** — real-time GPS marker updated via WebSocket
- **GPS trail / breadcrumb** — path drawn as the vehicle moves, with configurable history limit
- **Click-to-place waypoints** — drop, drag, reorder, and delete mission waypoints on the map
- **Geofence editor** — draw polygon boundaries to define safe operating zones
- **Offline map tiles** — pre-cached tile support for field areas without internet
- **Map layer toggle** — switch between satellite, street, and hybrid tile sources

### 2. Odometry & Telemetry Dashboard

Real-time display of vehicle state from MAVLink odometry and sensor messages.

- **Speed gauge** — linear or radial display of current velocity
- **Heading / compass** — vehicle yaw from IMU or MAVLink attitude message
- **Position XYZ display** — local frame position from `ODOMETRY` message
- **Time-series telemetry plot** — speed, heading, and position charted over time
- **Battery status** — voltage, current, and percentage with configurable low-battery alert
- **Attitude indicator** — pitch and roll from IMU / AHRS data

### 3. Mission Control

Commands sent to the vehicle via the FastAPI WebSocket bridge.

- **Mission upload** — send waypoints to the vehicle using the MAVLink mission protocol
- **Arm / disarm** — confirmation dialog before sending the arm command
- **Start / pause mission** — `MISSION_START` and `MISSION_SET_CURRENT` commands
- **Return to home (RTH)** — one-click command to navigate back to the origin point
- **Emergency stop** — kill motors / halt immediately with a prominent UI button
- **Save / load mission** — export and import mission plans as `.plan` JSON files

### 4. Alerts & Status

Keeps the operator informed of vehicle and connection state.

- **MAVLink status messages** — toast notifications from the `STATUSTEXT` stream
- **Connection indicator** — live / lost / reconnecting WebSocket state shown in the header
- **Threshold alerts** — warnings for low battery, signal loss, and geofence breach
- **Flight mode display** — current mode shown in status bar (MANUAL, AUTO, GUIDED, etc.)

### 5. Logging & Playback *(phase 2)*

Post-flight analysis and session management.

- **Telemetry log export** — download session data as CSV from the Jetson server
- **Mission replay** — scrub through a recorded GPS track on the map
- **Session history** — list of past missions with stats and replay access

### 6. Settings & Configuration *(phase 2)*

Operator-configurable preferences and connection setup.

- **Connection settings** — configure Jetson IP, port, and reconnect interval
- **Widget layout editor** — show/hide and rearrange telemetry panels on the dashboard
- **Alert thresholds** — set user-defined limits for battery, speed, and other warnings

---


## Folder Structure (suggested)

```
src/
├── components/
│   ├── map/          # Leaflet map, waypoint markers, geofence
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

---

## Key MAVLink Messages Used

| Message | Data |
|---|---|
| `GLOBAL_POSITION_INT` | GPS lat/lon/alt for map |
| `ODOMETRY` | X, Y, Z position + velocities |
| `ATTITUDE` | Roll, pitch, yaw |
| `BATTERY_STATUS` | Voltage, current, percentage |
| `STATUSTEXT` | System status messages |
| `HEARTBEAT` | Vehicle state and flight mode |
| `MISSION_ITEM_INT` | Waypoint upload/download |
| `MISSION_ACK` | Mission upload confirmation |