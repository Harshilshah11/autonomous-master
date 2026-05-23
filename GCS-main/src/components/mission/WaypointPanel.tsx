'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import type { ServerMission } from '@/lib/store/vehicleStore';
import {
  Trash2, Upload, Download, ChevronUp, ChevronDown,
  MapPin, Plus, RefreshCw, CloudUpload, CheckCircle, AlertCircle,
} from 'lucide-react';
import {
  fetchMissions, fetchMissionStatus,
  createNewMission, setMissionUgv, editMissionWaypoints,
} from '@/lib/api/commands';
import type { MissionPlan } from '@/types';

type SyncState = 'idle' | 'syncing' | 'ok' | 'error';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function WaypointPanel() {
  const {
    waypoints, addAlert, clearWaypoints,
    addWaypoint, removeWaypoint, reorderWaypoints,
    telemetry, liveMission,
    serverMissions, activeMissionServerId,
    setServerMissions, setActiveMissionServerId, loadServerWaypoints,
  } = useVehicleStore();

  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');

  // ── Fetch server mission list ──────────────────────────────────────────────
  const refreshMissions = useCallback(async () => {
    setMissionsLoading(true);
    try {
      const res = await fetchMissions();
      if (res.ok && Array.isArray(res.missions)) {
        const list = res.missions as ServerMission[];
        const activeId = (res.active_mission_id as string | null) ?? null;
        setServerMissions(list, activeId);
        if (!selectedServerId && list.length > 0) {
          setSelectedServerId(activeId ?? list[0].id);
        }
      }
    } catch {
      toast.error('Could not fetch missions from server');
    } finally {
      setMissionsLoading(false);
    }
  }, [setServerMissions, selectedServerId]);

  useEffect(() => { refreshMissions(); }, []);  // on mount

  // ── Save the current waypoints to a server mission (explicit action only) ──
  const syncToServer = useCallback(async (missionId: string) => {
    setSyncState('syncing');
    try {
      const payload = waypoints.map((w) => ({
        lat: w.lat, lng: w.lng, alt: w.alt,
        sequence: w.sequence, label: w.label ?? `WP${w.sequence + 1}`,
      }));
      const res = await editMissionWaypoints(missionId, payload);
      if (!res.ok) throw new Error(res.detail ?? `status ${res.status}`);
      setSyncState('ok');
      setTimeout(() => setSyncState('idle'), 2000);
    } catch (e) {
      setSyncState('error');
      toast.error(`Sync failed: ${(e as Error).message}`);
    }
  }, [waypoints]);

  // ── Activate a mission: set on bot + load its waypoints locally ────────────
  async function activateMission(missionId: string) {
    setActivating(true);
    try {
      const setRes = await setMissionUgv(missionId);
      if (!setRes.ok) throw new Error(setRes.detail ?? 'set_mission_ugv failed');

      // Fetch its waypoints via mission_status (now the active mission)
      const statusRes = await fetchMissionStatus();
      if (statusRes.ok && statusRes.mission) {
        const m = statusRes.mission as Record<string, unknown>;
        const wps = (m.waypoints ?? []) as Array<{
          sequence: number; lat: number; lng: number; alt: number; label: string;
        }>;
        loadServerWaypoints(wps);
      }

      setActiveMissionServerId(missionId);
      await refreshMissions();
      toast.success('Mission activated');
    } catch (e) {
      toast.error(`Activate failed: ${(e as Error).message}`);
    } finally {
      setActivating(false);
    }
  }

  // ── Create new mission ─────────────────────────────────────────────────────
  async function createMission() {
    const name = prompt('Mission name:', `Mission ${serverMissions.length + 1}`);
    if (!name?.trim()) return;
    setCreating(true);
    try {
      // New missions start empty — waypoints are added on the map locally and
      // persisted to this mission later via "Modify Waypoints".
      const res = await createNewMission(name.trim(), []);
      if (!res.ok) throw new Error(res.detail ?? 'create_new_mission failed');

      const newId = res.mission_id as string;
      toast.success(`Mission "${name}" created`);
      addAlert({ type: 'MISSION', message: `Mission "${name}" created on server`, timestamp: new Date().toISOString(), severity: 'info' });

      // Activate so the bot follows it and its (empty) waypoint list loads.
      await activateMission(newId);
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  }

  // ── Load server waypoints for the selected mission ─────────────────────────
  async function loadSelectedMissionWaypoints() {
    if (!selectedServerId) return;
    await activateMission(selectedServerId);
  }

  // ── Clear all waypoints ────────────────────────────────────────────────────
  function handleClear() {
    if (waypoints.length === 0) return;
    if (!confirm('Clear all waypoints?')) return;
    clearWaypoints();  // local only — empty list persists on the next Save to DB
    toast.success('Waypoints cleared');
    addAlert({ type: 'MISSION', message: 'Waypoints cleared', timestamp: new Date().toISOString(), severity: 'warning' });
  }

  // ── Export / Import ────────────────────────────────────────────────────────
  function exportPlan() {
    const plan = { version: 1, type: 'arnobot-mission', created: new Date().toISOString(), waypoints };
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `mission-${Date.now()}.plan`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Plan exported');
  }

  function importPlan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const plan = JSON.parse(ev.target?.result as string) as MissionPlan;
        if (!plan.waypoints) throw new Error('Invalid plan format');
        reorderWaypoints(plan.waypoints);
        toast.success(`Loaded ${plan.waypoints.length} waypoints`);
      } catch { toast.error('Invalid .plan file'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...waypoints];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    reorderWaypoints(next.map((w, i) => ({ ...w, sequence: i })));
  }

  function moveDown(idx: number) {
    if (idx === waypoints.length - 1) return;
    const next = [...waypoints];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    reorderWaypoints(next.map((w, i) => ({ ...w, sequence: i })));
  }

  const activeMission = serverMissions.find((m) => m.is_active);
  const selectedMission = serverMissions.find((m) => m.id === selectedServerId);

  const syncColor: Record<SyncState, string> = {
    idle: 'var(--text-dim)',
    syncing: 'var(--accent-yellow)',
    ok: 'var(--accent-green)',
    error: 'var(--accent-red)',
  };

  return (
    <div className="gcs-card flex flex-col gap-3 p-4 min-h-0">

      {/* ── Server Missions ── */}
      <div className="flex flex-col gap-2 pb-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Server Missions
          </span>
          <button
            onClick={refreshMissions}
            disabled={missionsLoading}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-dim)' }}
            title="Refresh list"
          >
            <RefreshCw size={11} className={missionsLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Mission dropdown */}
        <div className="flex gap-1.5">
          <select
            value={selectedServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
            className="flex-1 rounded px-2 py-1.5 text-xs outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            {serverMissions.length === 0 && (
              <option value="">— No missions on server —</option>
            )}
            {serverMissions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.is_active ? '▶ ' : ''}{m.name} ({m.waypoint_count} wp)
              </option>
            ))}
          </select>
          <button
            onClick={createMission}
            disabled={creating}
            className="p-1.5 rounded transition-colors"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--accent)' }}
            title="Create new mission"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Activate + status row */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadSelectedMissionWaypoints}
            disabled={!selectedServerId || activating}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-semibold transition-all disabled:opacity-40"
            style={{
              background: 'rgba(0,180,255,0.10)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
            }}
          >
            <CloudUpload size={11} />
            {activating ? 'Activating…' : 'Activate & Load Waypoints'}
          </button>
        </div>

        {/* Active mission badge */}
        {activeMission && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-green)' }} />
            <span style={{ color: 'var(--text-dim)' }}>Bot active:</span>
            <span className="font-medium" style={{ color: 'var(--accent-green)' }}>{activeMission.name}</span>
            <span className="ml-auto capitalize" style={{ color: 'var(--text-dim)' }}>{activeMission.status}</span>
          </div>
        )}
      </div>

      {/* ── Waypoints header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={13} style={{ color: 'var(--accent-green)' }} />
          <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Waypoints <span style={{ color: 'var(--accent)' }}>({waypoints.length})</span>
          </span>
          {/* Sync indicator */}
          {activeMissionServerId && (
            <span className="text-[9px] font-mono" style={{ color: syncColor[syncState] }}>
              {syncState === 'syncing' && '⟳ syncing'}
              {syncState === 'ok' && '✓ saved'}
              {syncState === 'error' && '✗ error'}
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => fileRef.current?.click()}
            className="p-1.5 rounded text-xs"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
            title="Import .plan">
            <Download size={11} />
          </button>
          <button onClick={exportPlan}
            className="p-1.5 rounded text-xs"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
            title="Export .plan">
            <Upload size={11} />
          </button>
          <button onClick={handleClear}
            className="p-1.5 rounded text-xs"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--accent-red)' }}
            title="Clear all waypoints">
            <Trash2 size={11} />
          </button>
          <input ref={fileRef} type="file" accept=".plan,.json" className="hidden" onChange={importPlan} />
        </div>
      </div>

      {/* No active server mission warning */}
      {!activeMissionServerId && (
        <div className="text-[10px] px-2 py-1.5 rounded"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--accent-yellow)' }}>
          No server mission active — create or activate a mission to sync waypoints to DB.
        </div>
      )}

      {/* ── Waypoint list ── */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0" style={{ maxHeight: 240 }}>
        {waypoints.length === 0 ? (
          <div className="text-xs text-center py-8" style={{ color: 'var(--text-dim)' }}>
            Click on the map to add waypoints
          </div>
        ) : (
          waypoints.map((wp, idx) => {
            // Reach status from live mission
            const liveWp = liveMission?.waypoints.find((w) => w.sequence === wp.sequence);
            const isDone = liveWp?.reached ?? false;

            let distStr = 'Start';
            if (idx > 0) {
              const prev = waypoints[idx - 1];
              const d = haversineDistance(prev.lat, prev.lng, wp.lat, wp.lng);
              distStr = d >= 1000 ? `${(d / 1000).toFixed(2)} km` : `${d.toFixed(1)} m`;
            } else if (telemetry.position.lat !== 0) {
              const d = haversineDistance(telemetry.position.lat, telemetry.position.lng, wp.lat, wp.lng);
              distStr = `Bot→${d >= 1000 ? (d / 1000).toFixed(1) + 'km' : d.toFixed(0) + 'm'}`;
            }

            return (
              <div
                key={wp.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded"
                style={{
                  background: isDone ? 'rgba(16,185,129,0.08)' : 'var(--bg-elevated)',
                  border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`,
                }}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ background: isDone ? 'var(--accent-green)' : 'var(--accent)', color: '#000' }}>
                  {isDone ? '✓' : wp.sequence + 1}
                </div>
                <div className="flex-1 min-w-0">
                  {wp.label && (
                    <div className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>{wp.label}</div>
                  )}
                  <div className="text-[9px] font-mono" style={{ color: 'var(--text-primary)' }}>
                    {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[9px]" style={{ color: 'var(--text-dim)' }}>Alt: {wp.alt}m</div>
                    <div className="w-1 h-1 rounded-full bg-[var(--border-subtle)]" />
                    <div className="text-[9px] font-mono" style={{ color: 'var(--accent-green)' }}>{distStr}</div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => moveUp(idx)} className="p-0.5 rounded hover:opacity-80"
                    style={{ color: 'var(--text-dim)' }}><ChevronUp size={10} /></button>
                  <button onClick={() => moveDown(idx)} className="p-0.5 rounded hover:opacity-80"
                    style={{ color: 'var(--text-dim)' }}><ChevronDown size={10} /></button>
                  <button onClick={() => removeWaypoint(wp.id)} className="p-0.5 rounded hover:opacity-80 ml-1"
                    style={{ color: 'var(--accent-red)' }}><Trash2 size={10} /></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Save / activate footer ── */}
      <div className="flex gap-2">
        {/* Manual save to current server mission */}
        <button
          onClick={() => activeMissionServerId && syncToServer(activeMissionServerId)}
          disabled={!activeMissionServerId || waypoints.length === 0 || syncState === 'syncing'}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          {syncState === 'ok'
            ? <><CheckCircle size={12} style={{ color: 'var(--accent-green)' }} /> Saved</>
            : syncState === 'error'
            ? <><AlertCircle size={12} style={{ color: 'var(--accent-red)' }} /> Retry Save</>
            : <><CloudUpload size={12} /> Modify Waypoints</>
          }
        </button>

        {/* Create new mission from current waypoints */}
        <button
          onClick={createMission}
          disabled={creating}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
          style={{ background: 'rgba(0,180,255,0.12)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
          title="Create a new empty mission"
        >
          <Plus size={12} />
          New Mission
        </button>
      </div>
    </div>
  );
}
