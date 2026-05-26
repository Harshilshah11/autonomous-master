'use client';
import { useRef, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { drive, stop } from '@/lib/api/commands';
import { useVehicleStore } from '@/lib/store/vehicleStore';

// [speed, direction] per key
const KEY_MAP: Record<string, [number, number]> = {
  w: [100, 0],
  s: [-100, 0],
  a: [0, -100],
  d: [0, 100],
};

export function ManualControlPanel() {
  const botMode     = useVehicleStore((s) => s.telemetry.botMode);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressedRef  = useRef<Set<string>>(new Set());
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    if (botMode === 'AUTO') return;

    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (!KEY_MAP[key]) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (pressedRef.current.has(key)) return; // suppress key-repeat
      pressedRef.current.add(key);
      setActiveKey(key);
      const [speed, direction] = KEY_MAP[key];
      drive(speed, direction).catch(() => null);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        drive(speed, direction).catch(() => null);
      }, 100);
    }

    function onKeyUp(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (!KEY_MAP[key]) return;
      pressedRef.current.delete(key);
      if (pressedRef.current.size === 0) {
        setActiveKey(null);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        stop().catch(() => null);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [botMode]);

  if (botMode === 'AUTO') return null;

  const startCommand = (speed: number, direction: number) => {
    drive(speed, direction).catch(() => null);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      drive(speed, direction).catch(() => null);
    }, 100);
  };

  const stopCommand = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      stop().catch(() => null);
    }
  };

  const btnClass = (key: string) =>
    `relative p-3 rounded-lg border transition-colors flex flex-col items-center gap-0.5 ${
      activeKey === key
        ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
        : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:bg-[var(--accent-dim)] active:bg-[var(--accent)] active:text-black'
    }`;

  return (
    <div className="gcs-card p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          Manual Control (Hold to Move)
        </span>
        <span
          className="text-[9px] font-mono px-1.5 py-0.5 rounded"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)' }}
        >
          W A S D
        </span>
      </div>

      <div className="flex flex-col items-center gap-2 py-2">
        {/* W — Forward */}
        <button
          onMouseDown={() => startCommand(100, 0)}
          onMouseUp={stopCommand}
          onMouseLeave={stopCommand}
          onTouchStart={() => startCommand(100, 0)}
          onTouchEnd={stopCommand}
          className={btnClass('w')}
        >
          <ChevronUp size={24} />
          <span className="text-[8px] font-bold opacity-60">W</span>
        </button>

        <div className="flex gap-2">
          {/* A — Left */}
          <button
            onMouseDown={() => startCommand(0, -100)}
            onMouseUp={stopCommand}
            onMouseLeave={stopCommand}
            onTouchStart={() => startCommand(0, -100)}
            onTouchEnd={stopCommand}
            className={btnClass('a')}
          >
            <ChevronLeft size={24} />
            <span className="text-[8px] font-bold opacity-60">A</span>
          </button>

          {/* S — Backward */}
          <button
            onMouseDown={() => startCommand(-100, 0)}
            onMouseUp={stopCommand}
            onMouseLeave={stopCommand}
            onTouchStart={() => startCommand(-100, 0)}
            onTouchEnd={stopCommand}
            className={btnClass('s')}
          >
            <ChevronDown size={24} />
            <span className="text-[8px] font-bold opacity-60">S</span>
          </button>

          {/* D — Right */}
          <button
            onMouseDown={() => startCommand(0, 100)}
            onMouseUp={stopCommand}
            onMouseLeave={stopCommand}
            onTouchStart={() => startCommand(0, 100)}
            onTouchEnd={stopCommand}
            className={btnClass('d')}
          >
            <ChevronRight size={24} />
            <span className="text-[8px] font-bold opacity-60">D</span>
          </button>
        </div>
      </div>
    </div>
  );
}
