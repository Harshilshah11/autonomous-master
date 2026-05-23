// Next.js dev/prod server + UART bridge for gcs_data_handler.
//
// When the GCS UI selects the UART transport, the browser hits
// /api/gcs/<route> on this server. The bridge below wraps each request in the
// JSON envelope expected by gcs_data_handler/router.py, writes it over the
// serial port, and waits for the reply with the matching `id` correlation.
//
// WiFi requests bypass this bridge entirely — the browser talks straight to
// the Jetson's Flask server at http://<ip>:<port>/<route>.

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? 'localhost';
const port = Number(process.env.PORT ?? 3000);

// Default UART settings; the UI can override via /api/uart-config (POST).
let uartConfig = {
  device: process.env.SERIAL_PORT ?? 'COM6',
  baud: Number(process.env.BAUD_RATE ?? 460800),
};

interface PendingRequest {
  resolve: (msg: Record<string, unknown>) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

class UartBridge {
  private serial: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private opening = false;

  isOpen(): boolean { return this.serial?.isOpen === true; }

  async open(): Promise<void> {
    if (this.isOpen() || this.opening) return;
    this.opening = true;
    try {
      await new Promise<void>((resolve, reject) => {
        const sp = new SerialPort({ path: uartConfig.device, baudRate: uartConfig.baud },
          (err) => err ? reject(err) : resolve());
        this.serial = sp;
        this.parser = sp.pipe(new ReadlineParser({ delimiter: '\n' }));
        this.parser.on('data', (line: string) => this.onLine(line));
        sp.on('close', () => { this.serial = null; this.parser = null; });
        sp.on('error', (e) => console.error('[UART]', e.message));
      });
      console.log(`[UART] Opened ${uartConfig.device} @ ${uartConfig.baud}`);
    } finally {
      this.opening = false;
    }
  }

  async close(): Promise<void> {
    if (!this.serial) return;
    await new Promise<void>((resolve) => this.serial!.close(() => resolve()));
    this.serial = null;
    this.parser = null;
  }

  async reconfigure(device: string, baud: number): Promise<void> {
    uartConfig = { device, baud };
    await this.close();
    await this.open();
  }

  private onLine(raw: string) {
    const line = raw.trim();
    if (!line) return;
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(line); } catch { return; }
    const id = typeof obj.id === 'number' ? obj.id : null;
    if (id !== null && this.pending.has(id)) {
      const p = this.pending.get(id)!;
      this.pending.delete(id);
      clearTimeout(p.timer);
      p.resolve(obj);
    }
  }

  request(method: 'GET' | 'POST', path: string, body: unknown): Promise<Record<string, unknown>> {
    return new Promise(async (resolve, reject) => {
      try { await this.open(); } catch (e) { return reject(e as Error); }
      if (!this.serial?.isOpen) return reject(new Error('UART not open'));

      const id = this.nextId++;
      const envelope: Record<string, unknown> = { method, path, id };
      if (method === 'POST' && body && typeof body === 'object') envelope.body = body;

      const timer = setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error('UART timeout'));
      }, 3000);

      this.pending.set(id, { resolve, reject, timer });
      this.serial.write(JSON.stringify(envelope) + '\n', (err) => {
        if (err) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }
}

const bridge = new UartBridge();

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
}

// ── RTSP → HLS camera proxy ─────────────────────────────────────────────────
// Spawns an ffmpeg process per camera that transcodes an RTSP stream to HLS
// segments written under os.tmpdir()/arnobot-cameras/<camId>/.
// The /api/camera/stream/:id/* endpoint serves those files back to the browser
// so hls.js can play them as if they were a normal HLS stream.

const cameraDir = path.join(os.tmpdir(), 'arnobot-cameras');
const cameraProcs = new Map<string, ChildProcess>();

function camFeedDir(camId: string): string {
  const dir = path.join(cameraDir, camId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stopCamera(camId: string): void {
  const proc = cameraProcs.get(camId);
  if (proc) {
    proc.kill('SIGTERM');
    cameraProcs.delete(camId);
  }
}

async function handleCameraAPI(
  req: IncomingMessage, res: ServerResponse, pathname: string,
): Promise<boolean> {
  if (!pathname.startsWith('/api/camera/')) return false;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return true;
  }

  const parts = pathname.slice('/api/camera/'.length).split('/');
  const action = parts[0];
  const camId  = parts[1];

  // POST /api/camera/start/:id  { rtspUrl }
  if (action === 'start' && camId && req.method === 'POST') {
    const body = (await readBody(req)) as { rtspUrl?: string };
    const rtspUrl = body.rtspUrl?.trim();
    if (!rtspUrl) { send(res, 400, { ok: false, detail: 'rtspUrl required' }); return true; }

    stopCamera(camId);
    const dir = camFeedDir(camId);
    const m3u8 = path.join(dir, 'index.m3u8');

    // Remove stale segments from a previous session
    fs.readdirSync(dir).forEach((f) => fs.unlinkSync(path.join(dir, f)));

    const args = [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '5',
      '-hls_flags', 'delete_segments+append_list',
      '-hls_segment_filename', path.join(dir, 'seg%03d.ts'),
      m3u8,
    ];

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stderr?.on('data', (d: Buffer) => process.stdout.write(`[cam:${camId}] ${d}`));
    proc.on('exit', (code) => {
      console.log(`[cam:${camId}] ffmpeg exited (${code})`);
      cameraProcs.delete(camId);
    });
    cameraProcs.set(camId, proc);
    send(res, 200, { ok: true, camId });
    return true;
  }

  // POST /api/camera/stop/:id
  if (action === 'stop' && camId && req.method === 'POST') {
    stopCamera(camId);
    send(res, 200, { ok: true, camId });
    return true;
  }

  // GET /api/camera/status/:id
  if (action === 'status' && camId && req.method === 'GET') {
    const running = cameraProcs.has(camId);
    const m3u8    = path.join(cameraDir, camId, 'index.m3u8');
    const ready   = fs.existsSync(m3u8);
    send(res, 200, { ok: true, camId, running, ready });
    return true;
  }

  // GET /api/camera/stream/:id/:file  — serve HLS manifest + segments
  if (action === 'stream' && camId && parts[2]) {
    const file     = parts[2];
    const filePath = path.join(cameraDir, camId, file);

    if (!fs.existsSync(filePath)) { send(res, 404, { ok: false, detail: 'segment not found' }); return true; }

    const ext  = path.extname(file);
    const mime = ext === '.m3u8' ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  return false;
}

async function handleBridge(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return true;
  }

  // UART config endpoint — read or update serial settings without restarting.
  if (pathname === '/api/uart-config') {
    if (req.method === 'GET') {
      send(res, 200, { ...uartConfig, open: bridge.isOpen() });
    } else if (req.method === 'POST') {
      try {
        const body = (await readBody(req)) as { device?: string; baud?: number };
        await bridge.reconfigure(body.device ?? uartConfig.device, body.baud ?? uartConfig.baud);
        send(res, 200, { ok: true, ...uartConfig, open: bridge.isOpen() });
      } catch (e) {
        send(res, 500, { ok: false, detail: (e as Error).message });
      }
    } else {
      send(res, 405, { ok: false, detail: 'method not allowed' });
    }
    return true;
  }

  // /api/gcs/<route> → wrap into JSON envelope and forward over UART.
  if (pathname.startsWith('/api/gcs/')) {
    const route = pathname.slice('/api/gcs/'.length);
    try {
      const body = req.method === 'POST' ? await readBody(req) : undefined;
      const reply = await bridge.request(req.method === 'POST' ? 'POST' : 'GET', route, body);
      const status = typeof reply.status === 'number' ? reply.status : 200;
      send(res, status, reply);
    } catch (e) {
      send(res, 502, { ok: false, status: 502, path: route, detail: (e as Error).message });
    }
    return true;
  }

  return false;
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const url = parse(req.url!, true);
      const pathname = url.pathname ?? '/';
      if (await handleCameraAPI(req, res, pathname)) return;
      if (await handleBridge(req, res, pathname)) return;
      await handle(req, res, url);
    } catch (err) {
      console.error('Request error:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, () => {
    console.log(`> Next.js ready on http://${hostname}:${port} [${dev ? 'dev' : 'production'}]`);
    console.log(`  UART bridge: /api/gcs/<route>  (device=${uartConfig.device} @ ${uartConfig.baud})`);
  });
});
