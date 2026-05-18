'use client';
import { Header } from '@/components/navigation/Header';
import { Sidebar } from '@/components/navigation/Sidebar';
import { useTelemetrySocket } from '@/lib/hooks/useTelemetrySocket';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Connect to the Python telemetry_server.py WebSocket bridge
  useTelemetrySocket();

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title="ARNOBOT GCS — Ground Control Station" />
        <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-primary)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

