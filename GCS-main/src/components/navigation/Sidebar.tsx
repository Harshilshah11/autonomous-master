'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Crosshair, BellRing, Settings,
  ChevronLeft, ChevronRight, LogOut, Radio, Activity, Cctv,
} from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { href: '/dashboard',                  label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/dashboard/mission',          label: 'Mission',          icon: Crosshair },
  { href: '/dashboard/mission-progress', label: 'Mission Progress', icon: Activity },
  { href: '/dashboard/alerts',           label: 'Alerts',           icon: BellRing },
  { href: '/dashboard/surveillance',     label: 'Surveillance',     icon: Cctv },
  { href: '/dashboard/settings',         label: 'Settings',         icon: Settings },
];

export function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { theme } = useTheme();
  const botMode   = useVehicleStore((s) => s.telemetry.botMode);
  const settings  = useVehicleStore((s) => s.settings);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (!mounted) return true; // Show all on server/first render to avoid flash
    if (botMode === 'MANUAL' && item.label === 'Mission Progress') return false;
    return true;
  });

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    localStorage.removeItem('arno-token');
    toast.success('Logged out');
    router.push('/login');
  }

  const logoSrc = theme === 'dark' ? '/images/dark_logo.png' : '/images/light_logo.png';

  return (
    <aside
      className="flex flex-col h-full transition-all duration-200 relative"
      style={{
        width: collapsed ? '60px' : '200px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center px-3 py-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Image
          src={logoSrc}
          alt="ARNOBOT"
          width={collapsed ? 32 : 140}
          height={32}
          className="object-contain"
          style={{ maxHeight: 32 }}
          unoptimized
        />
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 space-y-0.5 px-1.5">
        {filteredNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className="flex items-center gap-3 px-2.5 py-2 rounded-md transition-all text-sm"
              style={{
                fontFamily: 'var(--font-syne)',
                fontWeight: 500,
                letterSpacing: '0.05em',
                color:      active ? 'var(--accent)'     : 'var(--text-secondary)',
                background: active ? 'var(--accent-glow)' : 'transparent',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="pb-3 px-1.5 space-y-0.5 pt-2"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <div
          className="flex items-center gap-2 px-2.5 py-2 text-xs"
          style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-geist-mono)' }}
        >
          <Radio size={12} className="shrink-0" />
          {!collapsed && (
            <span>
              {settings.transport === 'wifi'
                ? `${settings.ip}:${settings.port}`
                : `UART ${settings.uartDevice}`}
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-2.5 py-2 rounded-md transition-all text-sm"
          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-syne)', fontWeight: 500 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-red)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-colors"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)',
        }}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
