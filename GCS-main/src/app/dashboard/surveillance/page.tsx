'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Cctv, Maximize2, Minimize2, AlertCircle, Loader2, VideoOff,
} from 'lucide-react';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import type { CameraFeed } from '@/lib/store/vehicleStore';

type MpegtsPlayer = ReturnType<(typeof import('mpegts.js'))['default']['createPlayer']>;

type FeedStatus = 'idle' | 'starting' | 'live' | 'error';

interface FeedState {
  status: FeedStatus;
  error?: string;
}

// Non-trickle ICE: wait for the browser to finish gathering candidates (or a
// short timeout) so the SDP offer we POST carries host candidates. go2rtc
// returns a complete answer in one shot, so trickle isn't needed on LAN.
function waitIceGathering(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    const cleanup = () => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', onChange);
    };
    const done = () => { cleanup(); resolve(); };
    const onChange = () => { if (pc.iceGatheringState === 'complete') done(); };
    const timer = setTimeout(done, timeoutMs);
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

// ── Single camera panel ─────────────────────────────────────────────────────
// Primary path: native WebRTC (~100-250ms) — server.ts proxies the SDP exchange
// to a go2rtc sidecar that republishes the RTSP stream; media flows P2P.
// Fallback: if WebRTC can't connect (go2rtc missing/unreachable), drop to
// mpegts.js playing an MPEG-TS stream that server.ts pipes from ffmpeg (~1s).

function CameraPanel({
  feed,
  isFullscreen,
  onToggleFullscreen,
  onStatus,
}: {
  feed: CameraFeed;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onStatus: (id: string, s: FeedState) => void;
}) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<MpegtsPlayer | null>(null);
  const [state, setState] = useState<FeedState>({ status: 'idle' });

  const report = useCallback((s: FeedState) => {
    setState(s);
    onStatus(feed.id, s);
  }, [feed.id, onStatus]);

  useEffect(() => {
    if (!feed.enabled || !feed.rtspUrl) { report({ status: 'idle' }); return; }
    report({ status: 'starting' });

    const rtspUrl = feed.rtspUrl;
    const videoEl = videoRef.current;
    let cancelled = false;
    let live = false;
    let fallbackStarted = false;
    let pc: RTCPeerConnection | null = null;
    let player: MpegtsPlayer | null = null;
    let detachVideo: (() => void) | null = null;
    let readyPoll: ReturnType<typeof setInterval> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const goLive = () => {
      if (cancelled || live) return;
      live = true;
      report({ status: 'live' });
      if (readyPoll) { clearInterval(readyPoll); readyPoll = null; }
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
    };

    // ── mpegts.js fallback (~1s) — used only if WebRTC can't connect ────────
    const startMpegts = () => {
      import('mpegts.js').then((mod) => {
        const Mpegts = mod.default;
        const video = videoRef.current;
        if (cancelled || !video) return;
        if (!Mpegts.getFeatureList().mseLivePlayback) {
          report({ status: 'error', error: 'MSE not supported' });
          return;
        }

        const url = `/api/camera/live/${feed.id}?u=${encodeURIComponent(rtspUrl)}`;
        player = Mpegts.createPlayer(
          // hasAudio:false — the camera stream is video-only; without this mpegts.js
          // waits for an audio track that never arrives and never starts playback.
          { type: 'mpegts', isLive: true, url, hasAudio: false, hasVideo: true },
          {
            enableStashBuffer: false,          // don't pre-buffer → lower latency
            liveBufferLatencyChasing: true,    // auto seek toward the live edge
            liveBufferLatencyMaxLatency: 0.8,
            liveBufferLatencyMinRemain: 0.1,
            lazyLoad: false,
          },
        );
        playerRef.current = player;

        video.addEventListener('playing', goLive);
        video.addEventListener('loadeddata', goLive);
        video.addEventListener('timeupdate', goLive);
        detachVideo = () => {
          video.removeEventListener('playing', goLive);
          video.removeEventListener('loadeddata', goLive);
          video.removeEventListener('timeupdate', goLive);
        };

        player.on(Mpegts.Events.MEDIA_INFO, goLive);
        player.on(Mpegts.Events.ERROR, (_type: unknown, detail: unknown) => {
          if (!cancelled) report({ status: 'error', error: String(detail) });
        });
        player.attachMediaElement(video);
        player.load();
        // play() may return void or a Promise depending on the path; normalize.
        Promise.resolve(player.play()).catch(() => { /* autoplay may need a gesture */ });

        // Events can be missed on video-only TS; poll the element directly. Once
        // it has a decodable frame (readyState ≥ 2) or time is advancing, it's live.
        readyPoll = setInterval(() => {
          if (cancelled) return;
          if (video.readyState >= 2 || video.currentTime > 0) goLive();
        }, 250);
      });
    };

    const startFallback = () => {
      if (cancelled || live || fallbackStarted) return;
      fallbackStarted = true;
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      detachVideo?.(); detachVideo = null;
      if (pc) { try { pc.close(); } catch { /* already gone */ } pc = null; }
      const video = videoRef.current;
      if (video) { try { video.srcObject = null; } catch { /* ignore */ } }
      report({ status: 'starting' });
      startMpegts();
    };

    // ── WebRTC primary (~100-250ms via the go2rtc sidecar) ─────────────────
    // The browser offers a recvonly video transceiver; server.ts proxies the
    // offer/answer to go2rtc and media flows peer-to-peer from there.
    const startWebRTC = async () => {
      const video = videoRef.current;
      if (!video) throw new Error('no video element');

      pc = new RTCPeerConnection({ iceServers: [] }); // LAN: no STUN/TURN needed
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.ontrack = (e) => {
        if (cancelled) return;
        video.srcObject = e.streams[0];
        Promise.resolve(video.play()).catch(() => { /* autoplay may need a gesture */ });
      };
      pc.addEventListener('connectionstatechange', () => {
        if (cancelled || !pc) return;
        if (pc.connectionState === 'connected') goLive();
        else if (pc.connectionState === 'failed') startFallback();
      });
      video.addEventListener('playing', goLive);
      video.addEventListener('loadeddata', goLive);
      detachVideo = () => {
        video.removeEventListener('playing', goLive);
        video.removeEventListener('loadeddata', goLive);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitIceGathering(pc, 1000);
      if (cancelled) return;

      const res = await fetch(`/api/camera/webrtc/${feed.id}?u=${encodeURIComponent(rtspUrl)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pc.localDescription),
      });
      if (!res.ok) throw new Error(`webrtc signaling ${res.status}`);
      const answer = await res.json();
      if (cancelled) return;
      await pc.setRemoteDescription(answer);
    };

    startWebRTC().catch(() => startFallback());

    // If WebRTC hasn't produced a frame in time, drop to the mpegts fallback.
    // Generous window: go2rtc's ffmpeg source has a ~2s cold start, and the
    // fallback opens its own RTSP pull — firing too early would fight go2rtc's
    // shared pull on single-session cameras.
    fallbackTimer = setTimeout(() => {
      if (cancelled || live) return;
      const v = videoRef.current;
      const hasFrame = !!v && (v.readyState >= 2 || v.currentTime > 0);
      if (!hasFrame) startFallback();
    }, 8000);

    return () => {
      cancelled = true;
      if (readyPoll) { clearInterval(readyPoll); readyPoll = null; }
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      detachVideo?.();
      if (pc) { try { pc.close(); } catch { /* already gone */ } pc = null; }
      if (videoEl) { try { videoEl.srcObject = null; } catch { /* ignore */ } }
      try { player?.destroy(); } catch { /* already gone */ }
      playerRef.current = null;
    };
  // report is stable (keyed to feed.id); restart only when the feed source changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.enabled, feed.rtspUrl, feed.id]);

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
              background: statusColor[state.status],
              boxShadow: state.status === 'live'
                ? `0 0 6px ${statusColor[state.status]}`
                : state.status === 'starting'
                ? `0 0 4px ${statusColor[state.status]}`
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
            style={{ color: statusColor[state.status], fontFamily: 'var(--font-geist-mono)' }}
          >
            · {state.error && state.status === 'error' ? state.error.slice(0, 20) : statusLabel[state.status]}
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
        {state.status !== 'live' && (
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, var(--text-primary) 0, var(--text-primary) 1px, transparent 0, transparent 50%)',
              backgroundSize: '8px 8px',
            }}
          />
        )}

        {/* Video element is mounted whenever the feed is active so mpegts.js can
            attach to it before the first frame arrives. */}
        {feed.enabled && feed.rtspUrl && (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            muted
            playsInline
            autoPlay
          />
        )}

        {state.status !== 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center z-10">
            {state.status === 'starting' && (
              <Loader2 size={26} className="animate-spin" style={{ color: 'var(--accent-yellow)' }} />
            )}
            {state.status === 'error' && (
              <AlertCircle size={26} style={{ color: 'var(--accent-red)' }} />
            )}
            {state.status === 'idle' && (
              <VideoOff size={26} style={{ color: 'var(--text-dim)' }} />
            )}
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {state.status === 'idle'
                ? feed.rtspUrl
                  ? 'Feed disabled — enable in Settings → Camera'
                  : 'No RTSP URL configured'
                : state.status === 'starting'
                ? 'Establishing live stream…'
                : state.error ?? 'Stream unavailable'}
            </p>
            {state.status === 'idle' && !feed.rtspUrl && (
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

  const [feedStates, setFeedStates] = useState<Record<string, FeedState>>({});
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);

  const handleStatus = useCallback((id: string, s: FeedState) => {
    setFeedStates((prev) => ({ ...prev, [id]: s }));
  }, []);

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
            RTSP · WebRTC real-time
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
            isFullscreen={fullscreenId === feed.id}
            onToggleFullscreen={() =>
              setFullscreenId((prev) => (prev === feed.id ? null : feed.id))
            }
            onStatus={handleStatus}
          />
        ))}
      </div>
    </div>
  );
}
