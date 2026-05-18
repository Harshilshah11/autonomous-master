'use client';
import { useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import { Trash2, Upload, Download, ChevronUp, ChevronDown, MapPin, Plus, X } from 'lucide-react';
import { uploadMission as wsUpload } from '@/lib/hooks/useTelemetrySocket';
import type { UploadMissionMutationResponse, MissionPlan } from '@/types';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function WaypointPanel() {
  const { 
    waypoints, removeWaypoint, reorderWaypoints, addAlert, clearWaypoints,
    missions, currentMissionId, addMission, removeMission, selectMission, renameMission,
    telemetry
  } = useVehicleStore();
  const fileRef = useRef<HTMLInputElement>(null);

  async function doUpload() {
    if (waypoints.length === 0) { toast.error('No waypoints to upload'); return; }
    try {
      wsUpload(waypoints.map((w) => ({
        lat: w.lat, lng: w.lng, alt: w.alt, sequence: w.sequence,
      })));
      
      const m = `Sent ${waypoints.length} waypoints to telemetry`;
      addAlert({ type: 'MISSION', message: m, timestamp: new Date().toISOString(), severity: 'info' });
      toast.success(m);
    } catch { toast.error('Upload failed'); }
  }

  async function clearMission() {
    if (waypoints.length === 0) return;
    if (!confirm('Are you sure you want to clear all waypoints?')) return;
    
    try {
      clearWaypoints();
      wsUpload([]); // Send empty mission to clear robot memory
      toast.success('Mission cleared');
      addAlert({ type: 'MISSION', message: 'Mission cleared by user', timestamp: new Date().toISOString(), severity: 'warning' });
    } catch { toast.error('Failed to clear mission'); }
  }

  const wasNotEmpty = useRef(false);

  useEffect(() => {
    if (waypoints.length > 0) {
      wasNotEmpty.current = true;
    } else if (wasNotEmpty.current && waypoints.length === 0) {
      // Mission was cleared manually one-by-one
      wsUpload([]);
      wasNotEmpty.current = false;
      addAlert({ 
        type: 'MISSION', 
        message: 'Mission cleared (all waypoints removed)', 
        timestamp: new Date().toISOString(), 
        severity: 'warning' 
      });
    }
  }, [waypoints.length, addAlert]);

  function exportPlan() {
    const plan = {
      version: 1,
      type: 'arnobot-mission',
      created: new Date().toISOString(),
      waypoints: waypoints.map((w) => ({ ...w })),
    };
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mission-${Date.now()}.plan`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Mission plan exported');
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

  function createNewMission() {
    const name = prompt('Enter mission name:', `Mission ${missions.length + 1}`);
    if (name) addMission(name);
  }

  function handleRenameMission() {
    const currentMission = missions.find(m => m.id === currentMissionId);
    if (!currentMission) return;
    const newName = prompt('Rename mission:', currentMission.name);
    if (newName) renameMission(currentMissionId!, newName);
  }

  function handleDeleteMission() {
    if (missions.length <= 1) {
      toast.error('Cannot delete the last mission');
      return;
    }
    if (confirm('Are you sure you want to delete this mission and all its waypoints?')) {
      removeMission(currentMissionId!);
      toast.success('Mission deleted');
    }
  }

  return (
    <div className="gcs-card flex flex-col gap-3 p-4 min-h-0">
      {/* Mission Selector */}
      <div className="flex flex-col gap-2 pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">Active Mission</span>
          <div className="flex gap-1">
            <button onClick={createNewMission} className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--accent)]" title="New Mission">
              <Plus size={14} />
            </button>
            <button onClick={handleDeleteMission} className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--accent-red)]" title="Delete Mission">
              <X size={14} />
            </button>
          </div>
        </div>
        <select 
          value={currentMissionId || ''} 
          onChange={(e) => selectMission(e.target.value)}
          className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        >
          {missions.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={13} style={{ color: 'var(--accent-green)' }} />
          <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Waypoints <span style={{ color: 'var(--accent)' }}>({waypoints.length})</span>
          </span>
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
          <button onClick={clearMission}
            className="p-1.5 rounded text-xs"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--accent-red)' }}
            title="Clear Mission">
            <Trash2 size={11} />
          </button>
          <input ref={fileRef} type="file" accept=".plan,.json" className="hidden" onChange={importPlan} />
        </div>
      </div>

      {/* Waypoint list */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0" style={{ maxHeight: 260 }}>
        {waypoints.length === 0 ? (
          <div className="text-xs text-center py-8" style={{ color: 'var(--text-dim)' }}>
            Click on map to add waypoints
          </div>
        ) : (
          waypoints.map((wp, idx) => {
            let distStr = 'Start';
            if (idx > 0) {
              const prev = waypoints[idx - 1];
              const d = haversineDistance(prev.lat, prev.lng, wp.lat, wp.lng);
              distStr = d >= 1000 ? `${(d / 1000).toFixed(2)} km` : `${d.toFixed(1)} m`;
            } else if (telemetry.position.lat !== 0) {
              const d = haversineDistance(telemetry.position.lat, telemetry.position.lng, wp.lat, wp.lng);
              distStr = `Bot → ${d >= 1000 ? (d / 1000).toFixed(1) + 'km' : d.toFixed(0) + 'm'}`;
            }

            return (
              <div
                key={wp.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ background: 'var(--accent-green)', color: '#000' }}>
                  {wp.sequence + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-mono" style={{ color: 'var(--text-primary)' }}>
                    {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[9px]" style={{ color: 'var(--text-dim)' }}>Alt: {wp.alt}m</div>
                    <div className="w-1 h-1 rounded-full bg-[var(--border-subtle)]" />
                    <div className="text-[9px] font-mono text-[var(--accent-green)]">{distStr}</div>
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

      {/* Upload button */}
      <button
        onClick={doUpload}
        disabled={waypoints.length === 0}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs font-semibold transition-all disabled:opacity-40"
        style={{ background: 'rgba(0,180,255,0.12)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
      >
        <Upload size={12} />
        Upload {waypoints.length} Waypoints
      </button>
    </div>
  );
}
