import React, { useState, useEffect, useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  Circle,
  Polyline,
  useMap
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Building2,
  Clock,
  Calendar,
  User,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Layers,
  ZoomIn,
  Navigation,
  Info,
  Maximize2,
  Camera
} from 'lucide-react';
import { Modal } from '../Modal';
import { AttendanceRecord, OfficeLocation } from '../../types';

interface AttendanceLocationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  office?: OfficeLocation | null;
}

// Controller component inside Map to manage camera animations and bounds
const MapViewController: React.FC<{
  officeLocation: { lat: number; lng: number };
  attendanceLocation: { lat: number; lng: number } | null;
  focusMode: 'fit' | 'office' | 'employee';
}> = ({ officeLocation, attendanceLocation, focusMode }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (focusMode === 'fit' && attendanceLocation) {
      if (typeof window !== 'undefined' && (window as any).google?.maps) {
        const bounds = new (window as any).google.maps.LatLngBounds();
        bounds.extend(officeLocation);
        bounds.extend(attendanceLocation);
        map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      }
    } else if (focusMode === 'office') {
      map.panTo(officeLocation);
      map.setZoom(18);
    } else if (focusMode === 'employee' && attendanceLocation) {
      map.panTo(attendanceLocation);
      map.setZoom(18);
    }
  }, [map, officeLocation, attendanceLocation, focusMode]);

  return null;
};

// Calculate Haversine distance in meters
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const AttendanceLocationDetailModal: React.FC<AttendanceLocationDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  office
}) => {
  const [selectedPointType, setSelectedPointType] = useState<'masuk' | 'pulang'>('masuk');
  const [activeInfoWindow, setActiveInfoWindow] = useState<'office' | 'attendance' | null>('attendance');
  const [focusMode, setFocusMode] = useState<'fit' | 'office' | 'employee'>('fit');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [copied, setCopied] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ title: string; url: string } | null>(null);

  // Fallback office coordinates for KPU Kota Sungai Penuh
  const officeCoords = useMemo(() => {
    return {
      lat: office?.latitude ? Number(office.latitude) : -2.069272,
      lng: office?.longitude ? Number(office.longitude) : 101.393433,
      radius: office?.radius_meter ? Number(office.radius_meter) : 100,
      nama: office?.nama || 'Kantor KPU Kota Sungai Penuh',
      alamat: office?.alamat || 'Jl. Depati Parbo No. 1, Kota Sungai Penuh, Jambi'
    };
  }, [office]);

  // Determine current active attendance coordinate
  const attendanceCoords = useMemo(() => {
    if (!record) return null;

    if (selectedPointType === 'pulang' && record.latitude_pulang && record.longitude_pulang) {
      return {
        lat: Number(record.latitude_pulang),
        lng: Number(record.longitude_pulang),
        type: 'pulang' as const,
        time: record.jam_pulang || '-',
        photo: record.foto_pulang
      };
    }

    if (record.latitude_masuk && record.longitude_masuk) {
      return {
        lat: Number(record.latitude_masuk),
        lng: Number(record.longitude_masuk),
        type: 'masuk' as const,
        time: record.jam_masuk || '-',
        photo: record.foto_masuk
      };
    }

    // Secondary fallback to pulang if masuk is null
    if (record.latitude_pulang && record.longitude_pulang) {
      return {
        lat: Number(record.latitude_pulang),
        lng: Number(record.longitude_pulang),
        type: 'pulang' as const,
        time: record.jam_pulang || '-',
        photo: record.foto_pulang
      };
    }

    return null;
  }, [record, selectedPointType]);

  // Calculate live distance from office
  const measuredDistance = useMemo(() => {
    if (!attendanceCoords) return record?.jarak_dari_kantor || 0;
    return getHaversineDistance(
      officeCoords.lat,
      officeCoords.lng,
      attendanceCoords.lat,
      attendanceCoords.lng
    );
  }, [attendanceCoords, officeCoords, record?.jarak_dari_kantor]);

  const isWithinRadius = measuredDistance <= officeCoords.radius;

  // Google Maps API Key securely fetched from env or demo key
  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    'AIzaSyBc9N_T1Xr_3htqZu-uZiOxeQCnQlK6T7I';

  const hasPulangCoords = Boolean(record?.latitude_pulang && record?.longitude_pulang);
  const hasMasukCoords = Boolean(record?.latitude_masuk && record?.longitude_masuk);

  // Copy coordinates to clipboard
  const handleCopyCoordinates = () => {
    if (!attendanceCoords) return;
    const text = `${attendanceCoords.lat.toFixed(6)}, ${attendanceCoords.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !record) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Verifikasi Titik Koordinat & Detail Presensi Pegawai"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-5">
        {/* Top Header Card: Employee Profile & Status */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src={
                record.foto_profil ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
              }
              alt={record.nama_lengkap || 'Pegawai'}
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-200 shadow-xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {record.nama_lengkap || 'Pegawai KPU'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    record.status === 'Hadir'
                      ? 'bg-emerald-100 text-emerald-800'
                      : record.status === 'Terlambat'
                      ? 'bg-amber-100 text-amber-800'
                      : record.status === 'TK'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {record.status}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                NIP: {record.nip_nik || '-'} &bull;{' '}
                <span className="font-sans text-slate-600 font-medium">
                  {record.jabatan || 'Staf Pegawai'} ({record.unit_kerja || 'Sekretariat KPU'})
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                record.metode_kerja === 'WFO'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : record.metode_kerja === 'WFH'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-teal-50 text-teal-700 border-teal-200'
              }`}
            >
              Metode: {record.metode_kerja}
            </span>

            <span className="px-3 py-1 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 flex items-center gap-1.5 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{record.tanggal}</span>
            </span>

            {/* Radius Verification Status Badge */}
            {attendanceCoords ? (
              <span
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${
                  isWithinRadius
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                {isWithinRadius ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Terverifikasi Dalam Radius ({measuredDistance} m)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Di Luar Radius Kantor ({measuredDistance} m)</span>
                  </>
                )}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                Koordinat GPS Belum Tercatat
              </span>
            )}
          </div>
        </div>

        {/* Coordinate Point Selector Tabs if both Masuk & Pulang exist */}
        {hasMasukCoords && hasPulangCoords && (
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => {
                setSelectedPointType('masuk');
                setFocusMode('employee');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedPointType === 'masuk'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Titik Absen Masuk ({record.jam_masuk || '-'})</span>
            </button>
            <button
              onClick={() => {
                setSelectedPointType('pulang');
                setFocusMode('employee');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedPointType === 'pulang'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Titik Absen Pulang ({record.jam_pulang || '-'})</span>
            </button>
          </div>
        )}

        {/* Map and Info Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Side: Interactive Google Map (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-2">
            <div className="relative w-full h-[400px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
              {attendanceCoords ? (
                <APIProvider apiKey={apiKey} libraries={['marker', 'geometry']}>
                  <Map
                    mapId="DEMO_MAP_ID"
                    defaultCenter={{ lat: officeCoords.lat, lng: officeCoords.lng }}
                    defaultZoom={17}
                    mapTypeId={mapType}
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    internalUsageAttributionIds={['gmp_git_agentskills_v1']}
                    className="w-full h-full"
                  >
                    <MapViewController
                      officeLocation={{ lat: officeCoords.lat, lng: officeCoords.lng }}
                      attendanceLocation={
                        attendanceCoords ? { lat: attendanceCoords.lat, lng: attendanceCoords.lng } : null
                      }
                      focusMode={focusMode}
                    />

                    {/* Geofence Circle around Office */}
                    <Circle
                      center={{ lat: officeCoords.lat, lng: officeCoords.lng }}
                      radius={officeCoords.radius}
                      strokeColor={isWithinRadius ? '#059669' : '#d97706'}
                      strokeOpacity={0.8}
                      strokeWeight={2}
                      fillColor={isWithinRadius ? '#10b981' : '#f59e0b'}
                      fillOpacity={0.15}
                    />

                    {/* Polyline connecting Office to Employee Attendance Point */}
                    <Polyline
                      path={[
                        { lat: officeCoords.lat, lng: officeCoords.lng },
                        { lat: attendanceCoords.lat, lng: attendanceCoords.lng }
                      ]}
                      strokeColor={isWithinRadius ? '#059669' : '#dc2626'}
                      strokeOpacity={0.85}
                      strokeWeight={3}
                    />

                    {/* Office Marker */}
                    <AdvancedMarker
                      position={{ lat: officeCoords.lat, lng: officeCoords.lng }}
                      title={officeCoords.nama}
                      onClick={() => setActiveInfoWindow('office')}
                    >
                      <Pin
                        background="#dc2626"
                        borderColor="#991b1b"
                        glyphColor="#ffffff"
                        scale={1.2}
                      >
                        🏛️
                      </Pin>
                    </AdvancedMarker>

                    {/* Attendance Point Marker */}
                    <AdvancedMarker
                      position={{ lat: attendanceCoords.lat, lng: attendanceCoords.lng }}
                      title={`Titik Presensi: ${record.nama_lengkap}`}
                      onClick={() => setActiveInfoWindow('attendance')}
                    >
                      <Pin
                        background={isWithinRadius ? '#059669' : '#ea580c'}
                        borderColor={isWithinRadius ? '#065f46' : '#9a3412'}
                        glyphColor="#ffffff"
                        scale={1.25}
                      >
                        {attendanceCoords.type === 'masuk' ? '📍' : '🏁'}
                      </Pin>
                    </AdvancedMarker>

                    {/* InfoWindow for Office */}
                    {activeInfoWindow === 'office' && (
                      <InfoWindow
                        position={{ lat: officeCoords.lat, lng: officeCoords.lng }}
                        onCloseClick={() => setActiveInfoWindow(null)}
                      >
                        <div className="p-1 max-w-xs text-xs space-y-1">
                          <p className="font-bold text-slate-900 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-red-600" />
                            {officeCoords.nama}
                          </p>
                          <p className="text-slate-600 text-[11px] leading-tight">
                            {officeCoords.alamat}
                          </p>
                          <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                            <span>Radius Maksimal:</span>
                            <span className="font-bold text-emerald-700">{officeCoords.radius} meter</span>
                          </div>
                        </div>
                      </InfoWindow>
                    )}

                    {/* InfoWindow for Attendance Point */}
                    {activeInfoWindow === 'attendance' && (
                      <InfoWindow
                        position={{ lat: attendanceCoords.lat, lng: attendanceCoords.lng }}
                        onCloseClick={() => setActiveInfoWindow(null)}
                      >
                        <div className="p-1 max-w-xs text-xs space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isWithinRadius ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            <p className="font-bold text-slate-900">
                              Presensi {attendanceCoords.type === 'masuk' ? 'Masuk' : 'Pulang'}
                            </p>
                          </div>
                          <p className="text-slate-700 text-[11px]">
                            {record.nama_lengkap} &bull;{' '}
                            <span className="font-mono font-semibold">{attendanceCoords.time} WIB</span>
                          </p>
                          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100 text-[10px] space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Jarak Kantor:</span>
                              <strong className={isWithinRadius ? 'text-emerald-700' : 'text-rose-700'}>
                                {measuredDistance} m ({isWithinRadius ? 'Dalam Radius' : 'Luar Radius'})
                              </strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Koordinat:</span>
                              <span className="font-mono text-slate-700">
                                {attendanceCoords.lat.toFixed(5)}, {attendanceCoords.lng.toFixed(5)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </Map>
                </APIProvider>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50">
                  <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-500 mb-3">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">Koordinat GPS Tidak Tersedia</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Pegawai ini tidak memiliki data koordinat latitude/longitude (mungkin absensi manual, izin/cuti khusus, atau sebelum fitur GPS diaktifkan).
                  </p>
                </div>
              )}

              {/* Floating Quick Map View Controls */}
              {attendanceCoords && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-xl border border-slate-200/90 shadow-sm text-xs">
                  <button
                    onClick={() => setFocusMode('fit')}
                    className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      focusMode === 'fit'
                        ? 'bg-teal-700 text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Tampilkan kantor dan titik pegawai sekaligus"
                  >
                    Fit Keduanya
                  </button>
                  <button
                    onClick={() => setFocusMode('employee')}
                    className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      focusMode === 'employee'
                        ? 'bg-teal-700 text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Pusatkan peta ke titik presensi pegawai"
                  >
                    Fokus Pegawai
                  </button>
                  <button
                    onClick={() => setFocusMode('office')}
                    className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      focusMode === 'office'
                        ? 'bg-teal-700 text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Pusatkan peta ke Kantor KPU"
                  >
                    Fokus Kantor
                  </button>
                  <span className="h-4 w-px bg-slate-200 mx-0.5" />
                  <button
                    onClick={() => setMapType(mapType === 'roadmap' ? 'hybrid' : 'roadmap')}
                    className="px-2 py-1 rounded-md text-slate-600 hover:bg-slate-100 font-medium cursor-pointer flex items-center gap-1"
                    title="Ganti tampilan peta jalan / satelit"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{mapType === 'roadmap' ? 'Satelit' : 'Peta'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Map Legend & Office Geofence Info */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                  <span>Kantor KPU (Pusat Radius)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                  <span>Titik Presensi Pegawai</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 border border-emerald-500" />
                  <span>Radius Maksimal ({officeCoords.radius}m)</span>
                </span>
              </div>

              {attendanceCoords && (
                <a
                  href={`https://www.google.com/maps?q=${attendanceCoords.lat},${attendanceCoords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-700 hover:text-teal-800 font-semibold inline-flex items-center gap-1 underline underline-offset-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka di Google Maps Eksternal</span>
                </a>
              )}
            </div>
          </div>

          {/* Right Side: Detailed Verification Metrics & Selfie Photos (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            {/* GPS Verification Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <Navigation className="w-4 h-4 text-teal-700" />
                <span>Detail Titik Koordinat GPS</span>
              </h4>

              {attendanceCoords ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Koordinat Latitude, Longitude</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {attendanceCoords.lat.toFixed(6)}, {attendanceCoords.lng.toFixed(6)}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyCoordinates}
                      className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                      title="Salin titik koordinat"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Jarak dari Kantor</span>
                      <span className="font-bold text-slate-900 text-sm">{measuredDistance} meter</span>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Radius Diizinkan</span>
                      <span className="font-bold text-slate-900 text-sm">{officeCoords.radius} meter</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Status Validasi</span>
                      <span
                        className={`font-bold text-xs ${
                          isWithinRadius ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {isWithinRadius ? 'VALID (Dalam Radius)' : 'LUAR RADIUS (Perlu Review)'}
                      </span>
                    </div>
                    <span
                      className={`w-3 h-3 rounded-full ${
                        isWithinRadius ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-amber-500 ring-4 ring-amber-100'
                      }`}
                    />
                  </div>

                  {record.device_info && (
                    <div className="p-2 bg-slate-50 rounded-lg text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-700">Perangkat:</span> {record.device_info}
                    </div>
                  )}

                  {record.emergency_reason && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-amber-900 text-[11px] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        Alasan Absen Luar Radius:
                      </span>
                      <p className="text-slate-800 italic bg-white p-2 rounded-lg border border-amber-100">
                        "{record.emergency_reason}"
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Data koordinat GPS tidak tersedia pada absensi ini.
                </p>
              )}
            </div>

            {/* Attendance Time & Selfie Photo Verification */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <Camera className="w-4 h-4 text-teal-700" />
                <span>Foto Selfie & Waktu Kehadiran</span>
              </h4>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Selfie Masuk */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-teal-700" />
                    <span>Masuk: {record.jam_masuk || '-'}</span>
                  </div>
                  {record.foto_masuk ? (
                    <div
                      onClick={() =>
                        setPreviewPhoto({
                          title: `Selfie Masuk: ${record.nama_lengkap} (${record.jam_masuk})`,
                          url: record.foto_masuk!
                        })
                      }
                      className="relative group cursor-pointer w-full aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200 bg-black/5"
                    >
                      <img
                        src={record.foto_masuk}
                        alt="Selfie Masuk"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="w-5 h-5" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-400 text-[11px]">
                      Tidak ada foto
                    </div>
                  )}
                </div>

                {/* Selfie Pulang */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col items-center gap-2 text-center">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Pulang: {record.jam_pulang || '-'}</span>
                  </div>
                  {record.foto_pulang ? (
                    <div
                      onClick={() =>
                        setPreviewPhoto({
                          title: `Selfie Pulang: ${record.nama_lengkap} (${record.jam_pulang})`,
                          url: record.foto_pulang!
                        })
                      }
                      className="relative group cursor-pointer w-full aspect-square rounded-lg overflow-hidden ring-1 ring-slate-200 bg-black/5"
                    >
                      <img
                        src={record.foto_pulang}
                        alt="Selfie Pulang"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="w-5 h-5" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-square rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-400 text-[11px]">
                      Belum absen pulang
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Fullscreen Zoom Foto Selfie */}
        {previewPhoto && (
          <Modal
            isOpen={true}
            onClose={() => setPreviewPhoto(null)}
            title={previewPhoto.title}
            maxWidth="max-w-md"
          >
            <div className="space-y-3">
              <img
                src={previewPhoto.url}
                alt="Zoom Selfie"
                className="w-full h-auto rounded-xl object-contain max-h-[70vh] mx-auto shadow-md"
              />
              <div className="text-center">
                <button
                  onClick={() => setPreviewPhoto(null)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Tutup Tampilan Foto
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </Modal>
  );
};
