import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { WebSocketServer, WebSocket } from 'ws';

// ── Next.js ────────────────────────────────────────────────────────────────────
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? 'localhost';
const port = Number(process.env.PORT ?? 3000);

// ── Telemetry config ───────────────────────────────────────────────────────────
const SERIAL_PORT = process.env.SERIAL_PORT ?? 'COM6';
const BAUD_RATE = Number(process.env.BAUD_RATE ?? 460800);
const WS_PORT = Number(process.env.WS_PORT ?? 8765);

// ── Shared state ───────────────────────────────────────────────────────────────
let latestTelemetry: Record<string, unknown> = {};
let currentBotMode = 'MANUAL';
let currentArmStatus = false;
let packetCount = 0;
let serial: SerialPort | null = null;
const stats = { total: 0, dataPkts: 0, heartbeats: 0, parseErrors: 0, startTime: Date.now() };

// ── Serial + WebSocket bridge ──────────────────────────────────────────────────
function startTelemetryServer() {
  console.log('='.repeat(52));
  console.log('  UGV Telemetry Bridge');
  console.log(`  Serial : ${SERIAL_PORT} @ ${BAUD_RATE}`);
  console.log(`  WS     : ws://0.0.0.0:${WS_PORT}`);
  console.log('='.repeat(52));

  try {
    serial = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
    const parser = serial.pipe(new ReadlineParser({ delimiter: '\n' }));

    serial.on('open', () => console.log('  Serial opened successfully\n'));
    serial.on('error', (err) =>
      console.error(`  [SERIAL ERROR] ${err.message}\n  Check: is ${SERIAL_PORT} correct? Is device connected?`)
    );

    parser.on('data', (line: string) => {
      line = line.trim();
      if (!line) return;

      stats.total++;
      packetCount++;

      let packet: Record<string, unknown>;
      try {
        packet = JSON.parse(line) as Record<string, unknown>;
      } catch {
        stats.parseErrors++;
        return;
      }

      const data = packet.data as Record<string, unknown> | undefined;
      const mission = (packet.mission ?? {}) as Record<string, unknown>;
      const waypoints = (mission.waypoints ?? []) as Record<string, unknown>[];

      if (data !== undefined) {
        stats.dataPkts++;
        const batv = Number(data.batv ?? 0);
        const speed = Number(data.vx ?? data.v ?? data.speed ?? 0);

        const mapped: Record<string, unknown> = {
          type: 'telemetry',
          timestamp: packet.ts ?? new Date().toISOString(),
          bot_id: packet.bot_id ?? 'unknown',
          position: { lat: Number(data.lat ?? 0), lng: Number(data.long ?? 0), alt: 0.0, x: Number(data.x ?? 0), y: Number(data.y ?? 0), z: 0.0 },
          attitude: { roll: 0.0, pitch: 0.0, yaw: Number(data.yaw ?? 0) },
          battery: { voltage: batv, current: 0.0, percentage: Math.min(100, Math.max(0, (batv / 50.0) * 100)) },
          speed,
          heading: Number(data.yaw ?? 0),
          botMode: currentBotMode,
          isArmed: currentArmStatus,
          connected: true,
          gps: { fix: data.gps_fix ?? '', satellites: Number(data.sat ?? 0) },
          sigma: { x: Number(data.s_x ?? 0), y: Number(data.s_y ?? 0) },
          telemHz: Number(data.hz ?? 0),
          uptimeMs: Number(data.uptime_ms ?? 0),
          packetNumber: packetCount,
        };

        const alreadyMapped = new Set(['lat','long','x','y','yaw','batv','vx','v','speed','gps_fix','sat','s_x','s_y','hz','uptime_ms']);
        for (const [k, v] of Object.entries(data)) {
          if (!alreadyMapped.has(k) && !(k in mapped)) mapped[k] = v;
        }

        if (Object.keys(mission).length > 0) {
          mapped.mission = { id: mission.id, name: mission.name, status: mission.status, progress: mission.progress ?? {}, started_at: mission.started_at };
        }
        if (waypoints.length > 0) {
          mapped.waypoints = waypoints.map((wp) => ({
            sequence: wp.sequence, lat: wp.lat, lng: wp.lng, alt: wp.alt,
            label: wp.label ?? '', reached: wp.reached ?? false, reached_at: wp.reached_at,
          }));
        }

        latestTelemetry = mapped;
        console.log(`  <<< [RECV] #${packetCount} | X:${data.x} Y:${data.y} Yaw:${data.yaw}° Spd:${speed} Bat:${batv}V`);
      } else {
        stats.heartbeats++;
        latestTelemetry = { ...latestTelemetry, type: 'heartbeat', timestamp: packet.ts ?? new Date().toISOString(), bot_id: packet.bot_id ?? 'unknown', packetNumber: packetCount };
      }

      if (stats.total % 20 === 0) {
        const elapsed = (Date.now() - stats.startTime) / 1000;
        const rate = elapsed > 0 ? stats.total / elapsed : 0;
        console.log(`  [STATS] ${stats.total} total | ${stats.dataPkts} data | ${stats.heartbeats} HB | ${stats.parseErrors} err | ${rate.toFixed(1)} pkt/s`);
      }
    });
  } catch (err) {
    console.error(`  [SERIAL ERROR] ${err}\n  Check: is ${SERIAL_PORT} correct? Is device connected?`);
  }

  const wss = new WebSocketServer({ port: WS_PORT });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`  [WS] Client connected: ${clientIp} (${wss.clients.size} total)`);

    const interval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN || Object.keys(latestTelemetry).length === 0) return;
      ws.send(JSON.stringify({ ...latestTelemetry, botMode: currentBotMode, isArmed: currentArmStatus }));
    }, 50);

    ws.on('message', (raw) => {
      try {
        const command = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (command.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: command.ts }));
        } else if (command.type === 'command') {
          const cmdData = (command.data ?? {}) as Record<string, unknown>;
          if ('botMode' in cmdData) currentBotMode = String(cmdData.botMode);
          if ('armStatus' in cmdData) currentArmStatus = cmdData.armStatus === 'Active';
          if (serial?.isOpen) {
            serial.write(JSON.stringify(cmdData) + '\n');
            const header = 'speed' in cmdData ? 'Speed/Direction' : 'cruiseSpeed' in cmdData ? 'Cruise Speed' : 'Mode';
            console.log(`  >>> [SEND] : ${header} data = ${JSON.stringify(cmdData)}`);
          }
        } else if (command.type === 'mission') {
          const missionData = (command.waypoints ?? []) as Record<string, unknown>[];
          if (serial?.isOpen) {
            serial.write(JSON.stringify({ mission: missionData }) + '\n');
            if (missionData.length === 0) {
              console.log('  >>> [MISSION] : Mission Cleared (0 waypoints)');
            } else {
              console.log(`  >>> [MISSION] : Sent ${missionData.length} waypoints`);
              for (const wp of missionData) console.log(`      WP${wp.sequence} | Lat:${wp.lat} Lng:${wp.lng}`);
            }
          }
        }
      } catch {
        console.error(`  [WS ERROR] Invalid JSON: ${raw}`);
      }
    });

    ws.on('close', () => {
      clearInterval(interval);
      console.log(`  [WS] Client disconnected: ${clientIp} (${wss.clients.size} total)`);
    });
  });

  console.log(`  [WS] Server started on ws://0.0.0.0:${WS_PORT}`);
}

// ── Boot ───────────────────────────────────────────────────────────────────────
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      await handle(req, res, parse(req.url!, true));
    } catch (err) {
      console.error('Request error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, () => {
    console.log(`> Next.js ready on http://${hostname}:${port} [${dev ? 'dev' : 'production'}]`);
  });

  startTelemetryServer();
});