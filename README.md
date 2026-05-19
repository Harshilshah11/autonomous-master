# ArnoBot GCS

Browser-based Ground Control Station for a UGV (Jetson Orin). Real-time telemetry, live map, and mission control over local WiFi.

## Prerequisites

- Node.js v20+
- Python 3.10+
- `pip install pyserial websockets`

## Installation

```bash
git clone <repository-url>
cd autonomous-master/GCS-main
npm install
```

## Configuration

**Serial port** — edit `telemetry_server.py`:
```python
SERIAL_PORT = "COM6"      # Windows: "COM6" | Linux: "/dev/ttyUSB0"
BAUD_RATE   = 460800
WS_PORT     = 8765
```

**GraphQL URL** — edit `GCS-main/src/Graphql/url.ts`:
```ts
export const GRAPHQL_URL = "http://192.168.1.100:8000/graphql";
```

## Running

**Terminal 1** — Python telemetry bridge:
```bash
python telemetry_server.py
```

**Terminal 2** — Frontend:
```bash
cd GCS-main
npm run dev      # development
npm run build && npm run start  # production
```

Open [http://localhost:3000](http://localhost:3000).
