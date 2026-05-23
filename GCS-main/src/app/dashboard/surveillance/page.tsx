'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Cctv, Maximize2, Minimize2, AlertCircle, Loader2, VideoOff,
} from 'lucide-react';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import type { CameraFeed } from '@/lib/store/vehicleStore';

type FeedStatus = 'idle' | 'starting' | 'live' | 'error';

interface FeedState {
  status: FeedStatus;
  error?: string;
}

// ── Single camera panel ─────────────────────────────────────────────────────

function CameraPanel({
  feed,
  feedState,
  isFullscreen,
  onToggleFullscreen,
}: {
  feed: CameraFeed;
  feedState: FeedState;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef   = useRef<any>(null);

  useEffect(() => {
    if (feedState.status !== 'live' || !videoRef.current) return;

    const streamUrl = `/api/camera/stream/${feed.id}/index.m3u8`;

    import('hls.js').then(({ default: Hls }) => {
      if (!videoRef.current) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: true, backBufferLength: 5 });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(() => {});
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari / iOS)
        videoRef.current.src = streamUrl;
        videoRef.current.play().catch(() => {});
      }
    });

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [feedState.status, feed.id]);

  const statusColor: Record<FeedStatus, string> = {
    idle:     'var(--text-dim)',
    starting: 'var(--accent-yellow)',
    live:     'var(--accent-green)',
    error:    'var(--accent-red)',
  };

  const statusLabel: Record<FeedStatus, string> = {
    idle:     feed.rtspUrl ? 'DISABLED' : 'NOT CONFIGURED',
    starting: 'CONNECTING',
    live:     'LIVE',
    error:    'ERROR',
  };

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        ...(isFullscreen ? {
          position: 'fixed', inset: 0, zIndex: 50, borderRadius: 0,
        } : {}),
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: statusColor[feedState.status],
              boxShadow: feedState.status === 'live'
                ? `0 0 6px ${statusColor[feedState.status]}`
                : feedState.status === 'starting'
                ? `0 0 4px ${statusColor[feedState.status]}`
                : 'none',
            }}
          />
          <span
            className="text-xs font-semibold truncate"
            style={{ fontFamily: 'var(--font-syne)', color: 'var(--text-primary)', letterSpacing: '0.04em' }}
          >
            {feed.label}
          </span>
          <span
            className="text-[10px] uppercase tracking-widest shrink-0"
            style={{ color: statusColor[feedState.status], fontFamily: 'var(--font-geist-mono)' }}
          >
            · {feedState.error && feedState.status === 'error' ? feedState.error.slice(0, 20) : statusLabel[feedState.status]}
          </span>
        </div>
        <button
          onClick={onToggleFullscreen}
          className="p-1 rounded transition-colors shrink-0 ml-2"
          style={{ color: 'var(--text-dim)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* Video area */}
      <div
        className="flex-1 relative flex items-center justify-center min-h-0"
        style={{ background: '#040404' }}
      >
        {/* Hatch overlay when no signal */}
        {feedState.status !== 'live' && (
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, var(--text-primary) 0, var(--text-primary) 1px, transparent 0, transparent 50%)',
              backgroundSize: '8px 8px',
            }}
          />
        )}

        {feedState.status === 'live' && (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            muted
            playsInline
          />
        )}

        {feedState.status !== 'live' && (
          <div className="flex flex-col items-center gap-3 px-6 text-center relative z-10">
            {feedState.status === 'starting' && (
              <Loader2 size={26} className="animate-spin" style={{ color: 'var(--accent-yellow)' }} />
            )}
            {feedState.status === 'error' && (
              <AlertCircle size={26} style={{ color: 'var(--accent-red)' }} />
            )}
            {feedState.status === 'idle' && (
              <VideoOff size={26} style={{ color: 'var(--text-dim)' }} />
            )}
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {feedState.status === 'idle'
                ? feed.rtspUrl
                  ? 'Feed disabled — enable in Settings → Camera'
                  : 'No RTSP URL configured'
                : feedState.status === 'starting'
                ? 'Establishing RTSP stream…'
                : feedState.error ?? 'Stream unavailable'}
            </p>
            {feedState.status === 'idle' && !feed.rtspUrl && (
              <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                Settings → Camera → {feed.label}
              </p>
            )}
          </div>
        )}
      </div>

      {/* RTSP URL footer */}
      {feed.rtspUrl && (
        <div
          className="px-3 py-1.5 shrink-0"
          style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}
        >
          <span
            className="text-[10px] font-mono block truncate"
            style={{ color: 'var(--text-dim)' }}
          >
            {feed.rtspUrl}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function SurveillancePage() {
  const cameraFeeds = useVehicleStore((s) => s.settings.cameraFeeds ?? []);

  const [feedStates, setFeedStates] = useState<Record<string, FeedState>>(() =>
    Object.fromEntries(cameraFeeds.map((f) => [f.id, { status: 'idle' as FeedStatus }]))
  );
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateFeedState = useCallback((id: string, patch: Partial<FeedState>) => {
    setFeedStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  useEffect(() => {
    // Reset all states when feeds config changes
    setFeedStates(
      Object.fromEntries(cameraFeeds.map((f) => [f.id, { status: 'idle' as FeedStatus }]))
    );

    const enabledFeeds = cameraFeeds.filter((f) => f.enabled && f.rtspUrl);

    async function startFeeds() {
      for (const feed of enabledFeeds) {
        updateFeedState(feed.id, { status: 'starting' });
        try {
          const res = await fetch(`/api/camera/start/${feed.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rtspUrl: feed.rtspUrl }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            updateFeedState(feed.id, { status: 'error', error: data.detail ?? 'Failed to start' });
          }
        } catch {
          updateFeedState(feed.id, { status: 'error', error: 'Network error' });
        }
      }
    }

    startFeeds();

    // Poll HLS readiness every 2 s until stream is live
    pollRef.current = setInterval(async () => {
      for (const feed of enabledFeeds) {
        setFeedStates((prev) => {
          if (prev[feed.id]?.status === 'live') return prev; // already live, skip
          return prev;
        });
        try {
          const res = await fetch(`/api/camera/status/${feed.id}`);
          const data: { ready?: boolean } = await res.json();
          if (data.ready) updateFeedState(feed.id, { status: 'live' });
        } catch { /* ignore */ }
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      enabledFeeds.forEach((feed) => {
        fetch(`/api/camera/stop/${feed.id}`, { method: 'POST' }).catch(() => {});
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraFeeds]);

  const liveCount = Object.values(feedStates).filter((s) => s.status === 'live').length;
  const configuredCount = cameraFeeds.filter((f) => f.enabled && f.rtspUrl).length;

  return (
    <div className="p-4 flex flex-col gap-4 h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Cctv size={16} style={{ color: 'var(--accent)' }} />
          <h2
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-syne)' }}
          >
            Camera Surveillance
          </h2>
          <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
            RTSP · 4-Feed
          </span>
        </div>

        <div className="flex items-center gap-3">
          {liveCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: 'var(--accent-green)', boxShadow: '0 0 6px var(--accent-green)' }}
              />
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--accent-green)' }}>
                {liveCount} live
              </span>
            </div>
          )}
          <span className="text-[10px] font-mono" style={{ color: 'var(--text-dim)' }}>
            {configuredCount} / 4 configured
          </span>
        </div>
      </div>

      {/* 2 × 2 grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 min-h-0">
        {cameraFeeds.map((feed) => (
          <CameraPanel
            key={feed.id}
            feed={feed}
            feedState={feedStates[feed.id] ?? { status: 'idle' }}
            isFullscreen={fullscreenId === feed.id}
            onToggleFullscreen={() =>
              setFullscreenId((prev) => (prev === feed.id ? null : feed.id))
            }
          />
        ))}
      </div>
    </div>
  );
}
