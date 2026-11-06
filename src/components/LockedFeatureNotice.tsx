import React from 'react';
import {
  Lock,
  Clock,
  ArrowLeft,
  ShieldAlert,
  Info,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { FeatureLock } from '../types';
import { useAuth } from '../context/AuthContext';

interface LockedFeatureNoticeProps {
  feature?: FeatureLock;
  onNavigateHome?: () => void;
  onNavigateToSettings?: () => void;
  onAdminBypass?: () => void;
  onQuickUnlock?: () => Promise<void>;
}

export const LockedFeatureNotice: React.FC<LockedFeatureNoticeProps> = ({
  feature,
  onNavigateHome,
  onNavigateToSettings,
  onAdminBypass,
  onQuickUnlock
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [unlocking, setUnlocking] = React.useState(false);

  const handleInstantUnlock = async () => {
    if (!onQuickUnlock) return;
    try {
      setUnlocking(true);
      await onQuickUnlock();
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden text-center">
        {/* Top Banner Accent */}
        <div className="h-2.5 bg-gradient-to-r from-amber-500 via-red-500 to-amber-600" />

        <div className="p-8 sm:p-12">
          {/* Lock Icon Emblem */}
          <div className="mx-auto w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-6 shadow-xs">
            <Lock className="w-9 h-9 sm:w-10 sm:h-10 text-amber-600 animate-pulse" />
          </div>

          {/* Tag / Category */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/70 text-amber-800 border border-amber-200/60 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{feature?.category || 'Fitur Sistem'} &bull; Tahap Kesiapan & Rilis</span>
          </div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mb-3">
            {feature?.name || 'Fitur Sedang Dalam Pengembangan'}
          </h2>

          {/* Maintenance Message or Default Notice */}
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed mb-6">
            {feature?.maintenance_message ||
              'Fitur ini sedang dalam tahap finalisasi, verifikasi teknis, atau pemeliharaan oleh Administrator KPU Kota Sungai Penuh dan belum dibuka untuk akses umum.'}
          </p>

          {/* Status Details Card */}
          <div className="max-w-md mx-auto bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-left text-xs mb-8 space-y-2.5">
            <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Status Akses:</span>
              <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                <Lock className="w-3 h-3" />
                Terkunci Sementara
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Sasaran Pembatasan:</span>
              <span className="font-semibold text-slate-700">
                {feature?.locked_for === 'everyone'
                  ? 'Seluruh Pengguna (Mode Perawatan)'
                  : feature?.locked_for === 'pegawai_only'
                  ? 'Khusus Pegawai (Admin & Operator Terbuka)'
                  : 'Seluruh Non-Administrator'}
              </span>
            </div>

            {feature?.release_estimate && (
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 font-medium">Perkiraan Rilis:</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-600" />
                  {feature.release_estimate}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Beranda
              </button>
            )}

            {/* Admin Quick Bypass */}
            {isAdmin && onAdminBypass && feature?.locked_for !== 'everyone' && (
              <button
                type="button"
                onClick={onAdminBypass}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="Buka modul ini khusus untuk pengujian oleh Admin Utama"
              >
                <ExternalLink className="w-4 h-4" />
                Masuk / Pratinjau Sebagai Administrator Utama
              </button>
            )}

            {/* Admin Quick Unlock */}
            {isAdmin && onQuickUnlock && (
              <button
                type="button"
                onClick={handleInstantUnlock}
                disabled={unlocking}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                {unlocking ? 'Membuka Kunci...' : 'Buka Kunci Fitur Ini Sekarang'}
              </button>
            )}

            {isAdmin && onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                Kelola Semua Kunci Fitur
              </button>
            )}
          </div>

          {/* Admin Info Banner */}
          {isAdmin && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-start gap-2.5 text-left text-xs bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80 text-amber-900">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Wewenang Administrator Utama:</span>
                <span>
                  Fitur ini sedang berstatus <strong>TERKUNCI</strong> untuk pengguna sistem (termasuk pegawai dan operator). Sebagai Administrator Utama, Anda berhak menguji fitur dengan tombol &quot;Pratinjau&quot; atau membuka kuncinya kembali agar dapat diakses.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
