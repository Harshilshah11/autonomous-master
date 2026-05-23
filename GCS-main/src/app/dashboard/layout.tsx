'use client';
import { Header } from '@/components/navigation/Header';
import { Sidebar } from '@/components/navigation/Sidebar';
import { useTelemetryPoller } from '@/lib/hooks/useTelemetryPoller';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Global odometry poll only — the Header (connection/battery/mode/armed) is on
  // every page. Mission polling is opted into per-page (mission pages only).
  useTelemetryPoller({ odometry: true, mission: false });

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
