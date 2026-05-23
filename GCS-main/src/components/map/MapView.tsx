'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Minus, LocateFixed } from 'lucide-react';
import { useVehicleStore } from '@/lib/store/vehicleStore';
import { useTheme } from '@/components/providers/ThemeProvider';

// Fix Leaflet's default icon path issue in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function vehicleIcon(heading: number) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="36" height="36">
      <g transform="rotate(${heading} 16 16)">
        <polygon points="16,3 26,28 16,22 6,28" fill="#00b4ff" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      </g>
    </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    className: '',
  });
}

function waypointIcon(seq: number) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
      <circle cx="12" cy="12" r="12" fill="#10b981" stroke="white" stroke-width="2"/>
      <text x="12" y="18" text-anchor="middle" font-size="11" font-weight="bold" fill="black" font-family="monospace">${seq}</text>
    </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [28, 28],
    iconAnchor: [12, 12],
    className: '',
  });
}

function VehicleMarker() {
  const { lat, lng } = useVehicleStore((s) => s.telemetry.position);
  const heading = useVehicleStore((s) => s.telemetry.heading);
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      markerRef.current.setIcon(vehicleIcon(heading));
    }
  });

  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={vehicleIcon(heading)}
      zIndexOffset={1000}
    >
      <Tooltip direction="top" offset={[0, -18]} permanent={false}>
        <span style={{ fontSize: 11 }}>Vehicle · {heading.toFixed(0)}°</span>
      </Tooltip>
    </Marker>
  );
}

function MapClickHandler({ mode }: { mode: 'view' | 'mission' | 'progress' }) {
  const addWaypoint = useVehicleStore((s) => s.addWaypoint);
  const waypoints = useVehicleStore((s) => s.waypoints);
  const botMode = useVehicleStore((s) => s.telemetry.botMode);
  useMapEvents({
    click(e) {
      if (mode !== 'mission' || botMode === 'MANUAL') return;
      addWaypoint({ lat: e.latlng.lat, lng: e.latlng.lng, alt: 10, sequence: waypoints.length });
    },
  });
  return null;
}

function MapController() {
  const map = useMap();
  const { lat, lng } = useVehicleStore((s) => s.telemetry.position);
  const hasCentered = useRef(false);

  useEffect(() => {
    // Fix for Leaflet maps not rendering correctly in dynamic/hidden containers
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    // If we already have a position, center it immediately on mount
    if (lat !== 0 && lng !== 0) {
      map.setView([lat, lng], map.getZoom());
      hasCentered.current = true;
    }

    return () => clearTimeout(timer);
  }, [map]); // Run on mount

  useEffect(() => {
    // Center the map when we get the first real GPS coordinate (if not already centered)
    if (!hasCentered.current && lat !== 0 && lng !== 0) {
      map.setView([lat, lng], 17);
      hasCentered.current = true;
    }
  }, [lat, lng, map]);

  return null;
}

function MapRefExposer({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

interface MapViewProps {
  mode?: 'view' | 'mission' | 'progress';
  height?: string;
}

export function MapView({ mode = 'view', height = '100%' }: MapViewProps) {
  const telemetry        = useVehicleStore((s) => s.telemetry);
  const breadcrumb       = useVehicleStore((s) => s.breadcrumb);
  const waypoints        = useVehicleStore((s) => s.waypoints);
  const geofence         = useVehicleStore((s) => s.geofence);
  const settings         = useVehicleStore((s) => s.settings);
  const removeWaypoint   = useVehicleStore((s) => s.removeWaypoint);
  const currentWpIdx     = useVehicleStore((s) => s.currentWaypointIndex);
  const connected        = useVehicleStore((s) => s.connectionStatus.connected);
  const { theme }        = useTheme();
  const mapRef           = useRef<L.Map | null>(null);
  const [locating, setLocating] = useState(false);

  const handleZoomIn  = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  const handleLocate = () => {
    if (connected) {
      const { lat, lng } = telemetry.position;
      mapRef.current?.flyTo([lat, lng], Math.max(mapRef.current?.getZoom() ?? 17, 17), { duration: 0.8 });
    } else {
      setLocating(true);
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 1 });
          setLocating(false);
        },
        () => setLocating(false),
      );
    }
  };

  const hasVehicle = connected;

  const { lat, lng } = telemetry.position;

  const tileUrl = theme === 'light'
    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  const mapBg      = theme === 'light' ? '#e8ecf5' : '#000000';
  const overlayBg  = theme === 'light' ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)';
  const overlayBdr = theme === 'light' ? '#c8d0e0' : 'rgba(255,255,255,0.12)';
  const coordColor = theme === 'light' ? '#38559D' : '#A7BCE3';
  const dimColor   = theme === 'light' ? '#999999' : 'rgba(255,255,255,0.3)';

  const breadcrumbPoints: [number, number][] = breadcrumb.map((p) => [p.lat, p.lng]);
  const sortedWPs = [...waypoints].sort((a, b) => a.sequence - b.sequence);
  const waypointPath: [number, number][] = sortedWPs.map((w) => [w.lat, w.lng]);
  const geofencePts: [number, number][] = geofence.map((p) => [p.lat, p.lng]);

  const handleWpClick = useCallback((id: string) => {
    if (mode === 'mission') removeWaypoint(id);
  }, [mode, removeWaypoint]);

  // Progress mode: remaining path = bot position → active WP → ... → last WP
  // As each waypoint is reached, the completed leg disappears automatically.
  const remainingPath: [number, number][] = (() => {
    if (mode !== 'progress') return [];
    const remaining = sortedWPs.slice(currentWpIdx).map((w): [number, number] => [w.lat, w.lng]);
    // Prepend bot's live position so the line 'starts at the bot'
    if (remaining.length > 0 && lat !== 0 && lng !== 0) {
      return [[lat, lng], ...remaining];
    }
    return remaining;
  })();

  function waypointIconProgress(seq: number, status: 'completed' | 'active' | 'pending') {
    const fill = status === 'completed' ? '#10b981' : status === 'active' ? '#00b4ff' : '#6b7280';
    const ring = status === 'active'
      ? `<circle cx="12" cy="12" r="13" fill="none" stroke="#00b4ff" stroke-width="1.5" opacity="0.5"/>`
      : '';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
        ${ring}
        <circle cx="12" cy="12" r="11" fill="${fill}" stroke="white" stroke-width="2"/>
        <text x="12" y="18" text-anchor="middle" font-size="11" font-weight="bold" fill="${status === 'pending' ? '#ccc' : 'black'}" font-family="monospace">${seq}</text>
      </svg>`;
    return L.divIcon({ html: svg, iconSize: [28, 28], iconAnchor: [12, 12], className: '' });
  }

  return (
    <div style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
      <MapContainer
        center={[lat === 0 ? 20 : lat, lng === 0 ? 0 : lng]}
        zoom={lat === 0 && lng === 0 ? 2 : 17}
        maxZoom={22}
        style={{ width: '100%', height: '100%', background: mapBg }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          key={theme}
          url={tileUrl}
          attribution=""
          maxNativeZoom={19}
          maxZoom={22}
          subdomains="abcd"
        />

        <MapController />
        <MapRefExposer mapRef={mapRef} />
        <MapClickHandler mode={mode} />

        {/* Geofence */}
        {settings.showGeofence && geofencePts.length >= 3 && (
          <Polygon
            positions={geofencePts}
            pathOptions={{ color: '#f97316', weight: 1.5, dashArray: '6 4', fillOpacity: 0.06, opacity: 0.7 }}
          />
        )}

        {/* Breadcrumb trail */}
        {settings.showBreadcrumb && breadcrumbPoints.length >= 2 && (
          <Polyline
            positions={breadcrumbPoints}
            pathOptions={{ color: '#00b4ff', weight: 2, opacity: 0.5 }}
          />
        )}

        {/* Waypoint path — mission mode (full dashed plan line) */}
        {mode !== 'progress' && telemetry.botMode !== 'MANUAL' && waypointPath.length >= 2 && (
          <Polyline
            positions={waypointPath}
            pathOptions={{ color: '#10b981', weight: 1.5, dashArray: '7 4', opacity: 0.8 }}
          />
        )}

        {/* Progress mode: single shrinking remaining-path line.
            Starts at bot's live position → active WP → ... → last WP.
            Completed legs vanish as the bot advances. */}
        {mode === 'progress' && telemetry.botMode !== 'MANUAL' && remainingPath.length >= 2 && (
          <Polyline
            positions={remainingPath}
            pathOptions={{ color: '#00b4ff', weight: 2.5, dashArray: '8 5', opacity: 0.85 }}
          />
        )}

        {/* Waypoint markers */}
        {telemetry.botMode !== 'MANUAL' && waypoints.map((wp, idx) => {
          // In progress mode: use colored status icons
          const icon = mode === 'progress'
            ? waypointIconProgress(
                wp.sequence + 1,
                idx < currentWpIdx ? 'completed' : idx === currentWpIdx ? 'active' : 'pending'
              )
            : waypointIcon(wp.sequence + 1);
          return (
            <Marker
              key={wp.id}
              position={[wp.lat, wp.lng]}
              icon={icon}
              eventHandlers={{ click: () => handleWpClick(wp.id) }}
            >
              <Tooltip direction="top" offset={[0, -12]}>
                <span style={{ fontSize: 11 }}>WP{wp.sequence + 1} · {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}{mode === 'mission' ? ' (click to remove)' : ''}</span>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Vehicle marker */}
        <VehicleMarker />
      </MapContainer>

      {/* Overlay info */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 1000,
        background: overlayBg, border: `1px solid ${overlayBdr}`,
        borderRadius: 6, padding: '4px 8px', backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: coordColor }}>
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>
        <div style={{ fontSize: 9, fontFamily: 'monospace', color: dimColor }}>
          {waypoints.length} WP · {breadcrumb.length} pts trail
        </div>
      </div>

      {mode === 'mission' && telemetry.botMode !== 'MANUAL' && (
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: overlayBg, border: `1px solid ${overlayBdr}`,
          borderRadius: 20, padding: '4px 12px',
        }}>
          <span style={{ fontSize: 10, color: 'var(--accent-green)' }}>Click map to add waypoint · Click marker to remove</span>
        </div>
      )}

      {/* Custom map controls */}
      <div style={{
        position: 'absolute', right: 10, bottom: 36, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {[
          { onClick: handleZoomIn,  icon: <Plus size={12} />,         title: 'Zoom in',  accent: false },
          { onClick: handleZoomOut, icon: <Minus size={12} />,        title: 'Zoom out', accent: false },
          {
            onClick: handleLocate,
            icon: <LocateFixed size={12} style={{ opacity: locating ? 0.4 : 1 }} />,
            title: hasVehicle ? 'Go to vehicle' : 'Use my location',
            accent: hasVehicle,
          },
        ].map(({ onClick, icon, title, accent }) => (
          <button
            key={title}
            onClick={onClick}
            title={title}
            style={{
              width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6,
              background: overlayBg,
              border: `1px solid ${accent ? 'var(--accent)' : overlayBdr}`,
              color: accent ? 'var(--accent)' : (theme === 'dark' ? 'rgba(255,255,255,0.75)' : '#444'),
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            {icon}
          </button>
        ))}
      </div>

    </div>
  );
}
