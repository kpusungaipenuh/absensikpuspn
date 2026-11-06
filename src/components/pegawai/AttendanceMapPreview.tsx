import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Building2,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LocateFixed,
  Maximize2
} from 'lucide-react';

export interface AttendanceMapPreviewProps {
  userCoords: { latitude: number; longitude: number } | null;
  officeLocation: {
    latitude: number;
    longitude: number;
    nama_kantor?: string;
    nama?: string;
    alamat?: string;
    radius_meter?: number;
  } | null;
  distanceFromOffice: number | null;
  isInsideRadius: boolean;
  isLocating?: boolean;
  onRefreshLocation?: () => void;
  height?: string;
}

export const AttendanceMapPreview: React.FC<AttendanceMapPreviewProps> = ({
  userCoords,
  officeLocation,
  distanceFromOffice,
  isInsideRadius,
  isLocating = false,
  onRefreshLocation,
  height = '240px'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy prior map instance if exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultLat = officeLocation?.latitude || -2.069272;
    const defaultLng = officeLocation?.longitude || 101.388836;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 16,
      zoomControl: true,
      attributionControl: false
    });

    // Standard OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const markersGroup = L.featureGroup().addTo(map);
    markersGroupRef.current = markersGroup;
    mapInstanceRef.current = map;
    setMapReady(true);

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(resizeTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // Update Markers, Geofence Circle, and Bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const officeLat = officeLocation?.latitude ?? -2.069272;
    const officeLng = officeLocation?.longitude ?? 101.388836;
    const radiusMeters = officeLocation?.radius_meter || 150;
    const officeName = officeLocation?.nama_kantor || officeLocation?.nama || 'Kantor KPU Kota Sungai Penuh';

    // 1. Office Geofence Circle
    const circle = L.circle([officeLat, officeLng], {
      radius: radiusMeters,
      color: '#059669',
      weight: 2,
      opacity: 0.8,
      fillColor: '#10B981',
      fillOpacity: 0.18,
      dashArray: '4, 4'
    }).addTo(group);

    circle.bindTooltip(`Batas Radius Presensi (${radiusMeters} meter)`, {
      permanent: false,
      direction: 'top'
    });

    // 2. Custom Office Marker Pin
    const officeIconHtml = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <div style="
          width: 38px;
          height: 38px;
          background: linear-gradient(135deg, #064E3B, #0D766E);
          color: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(6, 78, 59, 0.45), 0 0 0 2px white;
          border: 1.5px solid #34D399;
        ">
          <svg style="width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.2;" viewBox="0 0 24 24">
            <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
            <path d="M9 22v-4h6v4"/>
            <path d="M8 6h.01"/>
            <path d="M16 6h.01"/>
            <path d="M12 6h.01"/>
            <path d="M12 10h.01"/>
            <path d="M12 14h.01"/>
            <path d="M16 10h.01"/>
            <path d="M16 14h.01"/>
            <path d="M8 10h.01"/>
            <path d="M8 14h.01"/>
          </svg>
        </div>
        <div style="
          margin-top: 3px;
          background: #064E3B;
          color: white;
          font-size: 10px;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 6px;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.25);
          letter-spacing: -0.02em;
        ">
          KANTOR KPU
        </div>
      </div>
    `;

    const officeIcon = L.divIcon({
      html: officeIconHtml,
      className: 'custom-office-pin',
      iconSize: [80, 56],
      iconAnchor: [40, 28]
    });

    const officeMarker = L.marker([officeLat, officeLng], { icon: officeIcon }).addTo(group);
    officeMarker.bindPopup(`
      <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
        <strong style="color: #064E3B; font-size: 13px; display: block; margin-bottom: 2px;">${officeName}</strong>
        <span>Titik Pusat Radius Presensi Pegawai</span><br/>
        <span style="color: #64748B; font-size: 10px;">Radius Valid: Maks <strong>${radiusMeters} meter</strong></span>
      </div>
    `);

    // 3. User Marker Pin (if userCoords available)
    if (userCoords) {
      const userLat = userCoords.latitude;
      const userLng = userCoords.longitude;
      const pinColor = isInsideRadius ? '#059669' : '#DC2626';
      const pinBg = isInsideRadius ? 'linear-gradient(135deg, #059669, #0284C7)' : 'linear-gradient(135deg, #DC2626, #EA580C)';
      const statusText = isInsideRadius ? 'DALAM RADIUS' : 'LUAR RADIUS';

      const userIconHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <div style="position: relative;">
            <div style="
              width: 36px;
              height: 36px;
              background: ${pinBg};
              color: white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 14px rgba(0,0,0,0.35), 0 0 0 3px white;
            ">
              <svg style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.5;" viewBox="0 0 24 24">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div style="
              position: absolute;
              top: -4px;
              right: -4px;
              width: 12px;
              height: 12px;
              background: ${pinColor};
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 0 8px ${pinColor};
            "></div>
          </div>
          <div style="
            margin-top: 3px;
            background: ${pinColor};
            color: white;
            font-size: 9px;
            font-weight: 800;
            padding: 1px 6px;
            border-radius: 6px;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.25);
          ">
            POSISI ANDA (${statusText})
          </div>
        </div>
      `;

      const userIcon = L.divIcon({
        html: userIconHtml,
        className: 'custom-user-pin',
        iconSize: [90, 56],
        iconAnchor: [45, 28]
      });

      const userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(group);
      userMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
          <strong style="color: ${pinColor}; font-size: 13px; display: block; margin-bottom: 2px;">Posisi GPS Anda</strong>
          <span>Jarak ke Kantor: <strong>${distanceFromOffice ?? '?'} meter</strong></span><br/>
          <span style="color: ${isInsideRadius ? '#059669' : '#DC2626'}; font-weight: bold; font-size: 11px;">
            Status: ${isInsideRadius ? 'Memenuhi Syarat Radius' : 'Di Luar Batas Radius'}
          </span>
        </div>
      `);

      // 4. Connecting line between user and office
      const connector = L.polyline(
        [
          [officeLat, officeLng],
          [userLat, userLng]
        ],
        {
          color: isInsideRadius ? '#0D9488' : '#E11D48',
          weight: 2.5,
          opacity: 0.85,
          dashArray: '6, 6'
        }
      ).addTo(group);

      if (distanceFromOffice !== null) {
        connector.bindTooltip(`Jarak: ${distanceFromOffice} meter`, {
          permanent: true,
          direction: 'center',
          className: 'bg-slate-900 text-white font-bold text-[10px] px-2 py-0.5 rounded-md shadow-md border-0'
        });
      }

      // Auto fit bounds to enclose both markers comfortably
      try {
        const bounds = L.latLngBounds([
          [officeLat, officeLng],
          [userLat, userLng]
        ]);
        map.fitBounds(bounds, {
          padding: [45, 45],
          maxZoom: 17
        });
      } catch {
        map.setView([officeLat, officeLng], 16);
      }
    } else {
      map.setView([officeLat, officeLng], 16);
    }
  }, [userCoords, officeLocation, distanceFromOffice, isInsideRadius, mapReady]);

  // Map control helpers
  const handleFocusOffice = () => {
    if (!mapInstanceRef.current || !officeLocation) return;
    mapInstanceRef.current.flyTo([officeLocation.latitude, officeLocation.longitude], 17, {
      duration: 0.8
    });
  };

  const handleFocusUser = () => {
    if (!mapInstanceRef.current || !userCoords) return;
    mapInstanceRef.current.flyTo([userCoords.latitude, userCoords.longitude], 17, {
      duration: 0.8
    });
  };

  const handleFitAll = () => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;
    try {
      const bounds = markersGroupRef.current.getBounds();
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
      }
    } catch {
      // quiet fallback
    }
  };

  const maxRadius = officeLocation?.radius_meter || 150;

  return (
    <div className="space-y-2.5">
      {/* Visual Map Frame */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
        <div
          ref={mapContainerRef}
          style={{ height, width: '100%' }}
          className="z-0"
        />

        {/* Live Map Top Badge: Inside / Outside Radius */}
        <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between gap-2 pointer-events-none">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-md backdrop-blur-md pointer-events-auto border transition-colors ${
              !userCoords
                ? 'bg-slate-900/85 text-slate-200 border-slate-700'
                : isInsideRadius
                ? 'bg-emerald-600/95 text-white border-emerald-400'
                : 'bg-rose-600/95 text-white border-rose-400'
            }`}
          >
            {!userCoords ? (
              <>
                <Navigation className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span>Mendeteksi Lokasi GPS...</span>
              </>
            ) : isInsideRadius ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                <span>DALAM RADIUS KANTOR ({distanceFromOffice ?? '?'} m)</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                <span>DI LUAR RADIUS ({distanceFromOffice ?? '?'} m &gt; {maxRadius}m)</span>
              </>
            )}
          </div>

          {/* Refresh GPS Button */}
          {onRefreshLocation && (
            <button
              type="button"
              onClick={onRefreshLocation}
              disabled={isLocating}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/95 text-slate-800 hover:bg-white text-[11px] font-bold shadow-md border border-slate-200 pointer-events-auto cursor-pointer transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              title="Perbarui Titik Lokasi GPS"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-700 ${isLocating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLocating ? 'Mencari...' : 'Perbarui GPS'}</span>
            </button>
          )}
        </div>

        {/* Floating Quick Action Map Controls (Bottom Right) */}
        <div className="absolute bottom-2.5 right-2.5 z-10 flex flex-col gap-1.5 pointer-events-auto">
          {userCoords && (
            <button
              type="button"
              onClick={handleFocusUser}
              className="p-2 bg-white/95 hover:bg-white text-teal-800 rounded-xl shadow-md border border-slate-200 transition cursor-pointer"
              title="Arahkan ke Posisi Saya"
            >
              <LocateFixed className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleFocusOffice}
            className="p-2 bg-white/95 hover:bg-white text-emerald-800 rounded-xl shadow-md border border-slate-200 transition cursor-pointer"
            title="Arahkan ke Kantor KPU"
          >
            <Building2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleFitAll}
            className="p-2 bg-white/95 hover:bg-white text-slate-700 rounded-xl shadow-md border border-slate-200 transition cursor-pointer"
            title="Tampilkan Kantor & Posisi Pegawai"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Geofence & Location Details Card */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-white p-2 rounded-lg border border-slate-200/80">
            <span className="text-[10px] font-semibold text-slate-500 uppercase block">Jarak ke Kantor</span>
            <span className={`text-base font-extrabold ${isInsideRadius ? 'text-emerald-700' : 'text-rose-700'}`}>
              {distanceFromOffice !== null ? `${distanceFromOffice} meter` : 'Menghitung...'}
            </span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200/80">
            <span className="text-[10px] font-semibold text-slate-500 uppercase block">Radius Kantor KPU</span>
            <span className="text-base font-extrabold text-slate-800">
              Maks {maxRadius} meter
            </span>
          </div>
        </div>

        {/* Office details */}
        <div className="flex items-start gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200">
          <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800">
              {officeLocation?.nama_kantor || officeLocation?.nama || 'Kantor KPU Kota Sungai Penuh'}
            </span>
            <span className="text-slate-500 block text-[10px]">
              {officeLocation?.alamat || 'Jl. Depati Parbo, Koto Renah, Kec. Pesisir Bukit, Kota Sungai Penuh'}
            </span>
          </div>
        </div>

        {/* GPS Coordinates & Accuracy */}
        {userCoords && (
          <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
            <span>Koordinat: {userCoords.latitude.toFixed(6)}, {userCoords.longitude.toFixed(6)}</span>
            <span className="text-teal-700 font-sans font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              Satelit Terkunci
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
