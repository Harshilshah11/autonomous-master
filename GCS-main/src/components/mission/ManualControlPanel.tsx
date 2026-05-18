'use client';
import { useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { sendManualCommand } from '@/lib/hooks/useTelemetrySocket';
import { useVehicleStore } from '@/lib/store/vehicleStore';

export function ManualControlPanel() {
  const botMode = useVehicleStore((s) => s.telemetry.botMode);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  if (botMode === 'AUTO') return null;

  const startCommand = (speed: number, direction: number) => {
    // Send first command immediately
    sendManualCommand(speed, direction);
    
    // Start interval for continuous sending
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      sendManualCommand(speed, direction);
    }, 100);
  };

  const stopCommand = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      // Send stop command
      sendManualCommand(0, 0);
    }
  };

  return (
    <div className="gcs-card p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          Manual Control (Hold to Move)
        </span>
      </div>

      <div className="flex flex-col items-center gap-2 py-2">
        <button 
          onMouseDown={() => startCommand(100, 0)}
          onMouseUp={stopCommand}
          onMouseLeave={stopCommand}
          onTouchStart={() => startCommand(100, 0)}
          onTouchEnd={stopCommand}
          className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:bg-[var(--accent-dim)] active:bg-[var(--accent)] active:text-black transition-colors"
        >
          <ChevronUp size={24} />
        </button>
        <div className="flex gap-2">
          <button 
            onMouseDown={() => startCommand(0, -100)}
            onMouseUp={stopCommand}
            onMouseLeave={stopCommand}
            onTouchStart={() => startCommand(0, -100)}
            onTouchEnd={stopCommand}
            className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:bg-[var(--accent-dim)] active:bg-[var(--accent)] active:text-black transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onMouseDown={() => startCommand(-100, 0)}
            onMouseUp={stopCommand}
            onMouseLeave={stopCommand}
            onTouchStart={() => startCommand(-100, 0)}
            onTouchEnd={stopCommand}
            className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:bg-[var(--accent-dim)] active:bg-[var(--accent)] active:text-black transition-colors"
          >
            <ChevronDown size={24} />
          </button>
          <button 
            onMouseDown={() => startCommand(0, 100)}
            onMouseUp={stopCommand}
            onMouseLeave={stopCommand}
            onTouchStart={() => startCommand(0, 100)}
            onTouchEnd={stopCommand}
            className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:bg-[var(--accent-dim)] active:bg-[var(--accent)] active:text-black transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
