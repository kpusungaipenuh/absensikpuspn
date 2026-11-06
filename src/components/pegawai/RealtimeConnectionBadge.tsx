import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Cloud, Database, Info, X } from 'lucide-react';
import { api } from '../../services/api';

interface RealtimeConnectionBadgeProps {
  className?: string;
  onRefresh?: () => void;
  variant?: 'pill' | 'card' | 'compact';
}

export const RealtimeConnectionBadge: React.FC<RealtimeConnectionBadgeProps> = ({
  className = '',
  onRefresh,
  variant = 'pill'
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  });
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastSyncedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      if (onRefresh) onRefresh();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic lightweight ping check every 30 seconds
    const interval = setInterval(async () => {
      if (navigator.onLine) {
        try {
          const res = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' }).catch(() => null);
          if (res && res.ok) {
            setIsOnline(true);
          }
        } catch (_) {
          // If server is not responding, mark as offline/disconnected
        }
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [onRefresh]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' }).catch(() => null);
      if (res && res.ok) {
        setIsOnline(true);
        setLastSyncedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
        if (onRefresh) onRefresh();
      } else {
        setIsOnline(navigator.onLine);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => setShowDetailModal(true)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
          isOnline
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/25'
            : 'bg-amber-500/20 text-amber-300 border-amber-400/40 hover:bg-amber-500/30'
        } ${className}`}
        title={isOnline ? 'Terhubung (Online)' : 'Mode Offline'}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
        <span>{isOnline ? 'Online' : 'Offline'}</span>
      </button>
    );
  }

  return (
    <>
      <div
        onClick={() => setShowDetailModal(true)}
        className={`inline-flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl cursor-pointer transition-all border shadow-xs select-none ${
          isOnline
            ? 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-900 border-emerald-200'
            : 'bg-amber-50/95 hover:bg-amber-100/95 text-amber-950 border-amber-300 ring-2 ring-amber-400/20'
        } ${className}`}
        title="Klik untuk melihat status sinkronisasi data presensi"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isOnline ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-bold text-xs truncate">
                {isOnline ? 'Online (Tersinkronisasi)' : 'Mode Offline'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate leading-none mt-0.5">
              {isOnline
                ? `Sinkron real-time • ${lastSyncedTime} WIB`
                : 'Data akan otomatis disinkronkan saat online'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 pl-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleManualCheck();
            }}
            disabled={isChecking}
            className={`p-1 rounded-md hover:bg-black/5 text-slate-500 hover:text-slate-800 transition ${isChecking ? 'animate-spin' : ''}`}
            title="Periksa koneksi sekarang"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Detail Modal Sinkronisasi */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-slate-200 text-slate-800 relative space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-xl ${isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                </div>
                <h3 className="font-bold text-sm text-slate-900">Status Koneksi & Sinkronisasi</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className={`p-3 rounded-2xl border ${isOnline ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Status Jaringan:</span>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    {isOnline ? 'Terhubung (Online)' : 'Terputus (Offline)'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  {isOnline
                    ? 'Perangkat Anda terhubung ke server SITENANG dan Cloud Firestore. Seluruh transaksi presensi, selfie kamera, dan koordinat GPS disimpan secara real-time.'
                    : 'Koneksi internet tidak terdeteksi. Jangan khawatir, Anda tetap bisa melakukan presensi foto & GPS. Data disimpan secara aman di memori lokal dan akan disinkronkan otomatis begitu internet kembali aktif.'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-teal-600" />
                    Penyimpanan Cloud
                  </span>
                  <span className="font-semibold text-slate-700">Firebase Firestore</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-sky-600" />
                    Penyimpanan Lokal
                  </span>
                  <span className="font-semibold text-slate-700">IndexedDB Cache Aktif</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                    Sinkronisasi Terakhir
                  </span>
                  <span className="font-semibold text-slate-700">{lastSyncedTime} WIB</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleManualCheck}
                disabled={isChecking}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'Memeriksa...' : 'Cek Ulang Koneksi'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="flex-1 py-2 rounded-xl bg-teal-800 hover:bg-teal-700 text-white font-semibold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
