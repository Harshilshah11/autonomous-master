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

// Resolve the ffmpeg binary. FFMPEG_PATH wins; otherwise fall back to common
// install locations before relying on PATH — the dev server often inherits a
// stale PATH (ffmpeg installed after the launching shell/IDE started), which
// makes a bare spawn('ffmpeg') fail with ENOENT.
function resolveFfmpeg(): string {
  const fromEnv = process.env.FFMPEG_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates: string[] = [];
  const local = process.env.LOCALAPPDATA;
  if (local) {
    const wingetPkgs = path.join(local, 'Microsoft', 'WinGet', 'Packages');
    try {
      for (const entry of fs.readdirSync(wingetPkgs)) {
        if (!entry.startsWith('Gyan.FFmpeg')) continue;
        const pkgDir = path.join(wingetPkgs, entry);
        for (const sub of fs.readdirSync(pkgDir)) {
          candidates.push(path.join(pkgDir, sub, 'bin', 'ffmpeg.exe'));
        }
      }
    } catch { /* WinGet dir may not exist */ }
  }
  candidates.push(
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe',
  );
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffmpeg';   // last resort: rely on PATH
}

const ffmpegBin = resolveFfmpeg();
console.log(`[camera] ffmpeg: ${ffmpegBin}`);

function camFeedDir(camId: string): string {
  const dir = path.join(cameraDir, camId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stopCamera(camId: string): void {
  const proc = cameraProcs.get(camId);
  if (!proc) return;
  cameraProcs.delete(camId);
  // Node's SIGTERM doesn't reliably stop ffmpeg on Windows, leaving orphaned
  // transcoders that keep writing to the same HLS dir and fight over segments.
  // Force-kill the whole process tree there; use SIGKILL elsewhere.
  if (process.platform === 'win32' && proc.pid) {
    spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], { stdio: 'ignore' })
      .on('error', () => proc.kill('SIGKILL'));
  } else {
    proc.kill('SIGTERM');
  }
}

// ── RTSP → WebRTC via go2rtc sidecar ────────────────────────────────────────
// For true real-time (~100-250ms vs ~1s for the mpegts path) we hand the RTSP
// stream to a go2rtc process that republishes it as WebRTC. This server proxies
// the WHEP-style SDP exchange (browser offer → go2rtc answer) and registers
// streams via go2rtc's REST API. The media itself flows peer-to-peer between the
// browser and go2rtc — only signaling passes through here.

const GO2RTC_API = 'http://127.0.0.1:1984';

// Resolve the go2rtc binary. GO2RTC_PATH wins; otherwise check the project dir
// (convenient: drop go2rtc.exe next to the app) and a couple of common installs
// before relying on PATH.
function resolveGo2rtc(): string | null {
  const fromEnv = process.env.GO2RTC_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const candidates = [
    path.join(process.cwd(), 'go2rtc.exe'),
    path.join(process.cwd(), 'go2rtc'),
    'C:\\go2rtc\\go2rtc.exe',
    'C:\\Program Files\\go2rtc\\go2rtc.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return process.platform === 'win32' ? 'go2rtc.exe' : 'go2rtc'; // last resort: PATH
}

let go2rtcProc: ChildProcess | null = null;
let go2rtcStarting: Promise<void> | null = null;
let go2rtcFailed = false; // hard failure (binary missing) — stop retrying

async function pingGo2rtc(timeoutMs = 800): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(`${GO2RTC_API}/api/streams`, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

function startGo2rtc(): Promise<void> {
  if (go2rtcFailed) return Promise.reject(new Error('go2rtc unavailable'));
  if (go2rtcStarting) return go2rtcStarting;

  go2rtcStarting = (async () => {
    // Already running (spawned by us earlier, or an external instance)?
    if (await pingGo2rtc()) return;

    const bin = resolveGo2rtc();
    if (!bin) { go2rtcFailed = true; throw new Error('go2rtc binary not found'); }

    // Minimal config: bind the API to localhost and quiet the logs. Written to
    // tmp so we neither depend on nor clobber a go2rtc.yaml in the cwd.
    const cfgPath = path.join(os.tmpdir(), 'arnobot-go2rtc.yaml');
    fs.writeFileSync(cfgPath, 'api:\n  listen: "127.0.0.1:1984"\nlog:\n  level: warn\n');

    const proc = spawn(bin, ['-config', cfgPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stderr?.on('data', (d: Buffer) => process.stdout.write(`[go2rtc] ${d}`));
    proc.on('error', (err) => {
      console.error(`[go2rtc] spawn failed: ${err.message}`);
      go2rtcFailed = true;
      go2rtcProc = null;
    });
    proc.on('exit', (code) => {
      console.log(`[go2rtc] exited (${code})`);
      go2rtcProc = null;
      go2rtcStarting = null;
    });
    go2rtcProc = proc;

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (go2rtcFailed) throw new Error('go2rtc failed to start');
      if (await pingGo2rtc()) { console.log('[go2rtc] API ready'); return; }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error('go2rtc API did not become ready');
  })();

  // Clear the latch on failure so a later request can retry; keep it cached on
  // success so we don't re-ping for every signaling request.
  go2rtcStarting.catch(() => { go2rtcStarting = null; });
  return go2rtcStarting;
}

// Make the named stream reflect the current RTSP URL. Delete-then-create keeps
// it deterministic if the user edits the URL (same camId, new source).
async function ensureGo2rtcStream(name: string, rtspUrl: string): Promise<void> {
  await fetch(`${GO2RTC_API}/api/streams?src=${encodeURIComponent(name)}`, { method: 'DELETE' })
    .catch(() => { /* may not exist yet */ });
  const r = await fetch(
    `${GO2RTC_API}/api/streams?name=${encodeURIComponent(name)}&src=${encodeURIComponent(rtspUrl)}`,
    { method: 'PUT' },
  );
  if (!r.ok) throw new Error(`go2rtc stream register failed (${r.status})`);
}

function stopGo2rtc(): void {
  const p = go2rtcProc;
  if (!p) return;
  go2rtcProc = null;
  if (process.platform === 'win32' && p.pid) {
    spawn('taskkill', ['/pid', String(p.pid), '/t', '/f'], { stdio: 'ignore' })
      .on('error', () => p.kill('SIGKILL'));
  } else {
    p.kill('SIGTERM');
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

  // POST /api/camera/webrtc/:id?u=<rtsp url>  — real-time WebRTC (~100-250ms).
  // The browser sends its SDP offer as JSON { type, sdp }; we make sure go2rtc is
  // up, (re)register the RTSP source under :id, forward the offer to go2rtc, and
  // return its SDP answer. Media then flows browser↔go2rtc directly. On any
  // failure (go2rtc missing/unreachable) we reply non-2xx so the client falls
  // back to the mpegts path.
  if (action === 'webrtc' && camId && req.method === 'POST') {
    const rtsp = parse(req.url ?? '', true).query.u;
    const rtspUrl = (typeof rtsp === 'string' ? rtsp : '').trim();
    if (!rtspUrl) { send(res, 400, { ok: false, detail: 'missing ?u=<rtsp url>' }); return true; }

    let offer: { type?: string; sdp?: string };
    try { offer = (await readBody(req)) as { type?: string; sdp?: string }; }
    catch { send(res, 400, { ok: false, detail: 'invalid offer' }); return true; }
    if (!offer?.sdp) { send(res, 400, { ok: false, detail: 'offer.sdp required' }); return true; }

    try {
      await startGo2rtc();
      await ensureGo2rtcStream(camId, rtspUrl);
      const r = await fetch(`${GO2RTC_API}/api/webrtc?src=${encodeURIComponent(camId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'offer', sdp: offer.sdp }),
      });
      if (!r.ok) { send(res, 502, { ok: false, detail: `go2rtc webrtc ${r.status}` }); return true; }
      const answer = await r.json();
      send(res, 200, answer); // { type: 'answer', sdp }
    } catch (e) {
      send(res, 503, { ok: false, detail: (e as Error).message });
    }
    return true;
  }

  // GET /api/camera/live/:id?u=<rtsp url>  — low-latency MPEG-TS stream.
  // ffmpeg copies the RTSP H.264 straight into an MPEG-TS pipe that the browser
  // plays with mpegts.js (~1s glass-to-glass), instead of segmented HLS (~6-10s).
  // One ffmpeg per open connection; closing the connection kills it (no orphans).
  if (action === 'live' && camId && req.method === 'GET') {
    const rtsp = parse(req.url ?? '', true).query.u;
    const rtspUrl = (typeof rtsp === 'string' ? rtsp : '').trim();
    if (!rtspUrl) { send(res, 400, { ok: false, detail: 'missing ?u=<rtsp url>' }); return true; }

    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive',
    });

    const proc = spawn(ffmpegBin, [
      '-fflags', 'nobuffer', '-flags', 'low_delay',
      '-probesize', '32', '-analyzeduration', '0',
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-map', '0:v:0', '-an',          // video only (camera has no audio)
      '-c:v', 'copy',                  // no transcode
      '-f', 'mpegts',
      '-muxdelay', '0', '-muxpreload', '0',
      'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stderr?.on('data', (d: Buffer) => process.stdout.write(`[cam:${camId}] ${d}`));
    proc.on('error', (err) => {
      console.error(`[cam:${camId}] ffmpeg spawn failed: ${err.message}`);
      try { res.end(); } catch { /* already closed */ }
    });
    proc.stdout?.pipe(res);

    const kill = () => {
      if (process.platform === 'win32' && proc.pid) {
        spawn('taskkill', ['/pid', String(proc.pid), '/t', '/f'], { stdio: 'ignore' })
          .on('error', () => proc.kill('SIGKILL'));
      } else {
        proc.kill('SIGKILL');
      }
    };
    req.on('close', kill);
    proc.on('exit', () => { try { res.end(); } catch { /* already closed */ } });
    return true;
  }

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

    const proc = spawn(ffmpegBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stderr?.on('data', (d: Buffer) => process.stdout.write(`[cam:${camId}] ${d}`));
    // Without this, a failed spawn (e.g. ffmpeg not on PATH → ENOENT) emits an
    // unhandled 'error' that crashes the whole server instead of just the feed.
    proc.on('error', (err) => {
      console.error(`[cam:${camId}] ffmpeg spawn failed: ${err.message}`);
      cameraProcs.delete(camId);
    });
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

// Don't leave the go2rtc sidecar orphaned when this server stops.
process.on('exit', stopGo2rtc);
process.on('SIGINT', () => { stopGo2rtc(); process.exit(0); });
process.on('SIGTERM', () => { stopGo2rtc(); process.exit(0); });

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
