// Client for the gcs_data_handler request/response API (router.py).
// Two transport modes:
//   * 'wifi' — browser calls the Jetson's Flask server directly at http://<ip>:<port>/<path>
//   * 'uart' — browser calls the local Node bridge (see server.ts) which forwards
//              JSON lines over the configured serial port and returns the reply.
//
// Both transports speak the same JSON envelope, so consumers only see one API.

import { useVehicleStore } from '@/lib/store/vehicleStore';

export type TransportKind = 'wifi' | 'uart';

export interface GcsResponse {
  ok: boolean;
  status: number;
  path: string;
  id?: number | string;
  detail?: string;
  // Telemetry payload (only present on GET /telemetry)
  ts?: string;
  bot_id?: string | null;
  data?: Record<string, unknown> | null;
  mission?: Record<string, unknown> | null;
  [key: string]: unknown;
}

function getBaseUrl(): string {
  const { settings } = useVehicleStore.getState();
  if (settings.transport === 'uart') {
    // Local Node bridge proxies UART under /api/gcs/<path>.
    return '/api/gcs';
  }
  // WiFi: hit the Jetson's Flask server directly.
  const host = settings.ip.trim() || '192.168.1.100';
  const port = settings.port || 8000;
  return `http://${host}:${port}`;
}

async function request(method: 'GET' | 'POST', path: string, body?: unknown,
                      signal?: AbortSignal): Promise<GcsResponse> {
  const url = `${getBaseUrl()}/${path.replace(/^\//, '')}`;
  const init: RequestInit = {
    method,
    signal,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    cache: 'no-store',
  };
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as GcsResponse;
  if (!json.status) json.status = res.status;
  if (typeof json.ok !== 'boolean') json.ok = res.ok;
  return json;
}

export const api = {
  get:  (path: string, signal?: AbortSignal) => request('GET',  path, undefined, signal),
  post: (path: string, body: unknown, signal?: AbortSignal) =>
          request('POST', path, body, signal),
};
