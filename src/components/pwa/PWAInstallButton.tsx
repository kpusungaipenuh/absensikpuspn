import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle, Info } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'banner' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'compact'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running inside installed standalone PWA, hide install triggers
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  if (variant === 'banner') {
    return (
      <>
        <div className={`p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 text-white backdrop-blur shadow-xl ${className}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30 shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-emerald-200">Instal Aplikasi SITENANG (PWA)</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Akses lebih cepat, notifikasi presensi real-time, dan tampilan layar penuh seperti aplikasi Android.
                </p>
              </div>
            </div>
            {isInstallable && (
              <button
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="shrink-0 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                {isInstalling ? 'Memasang...' : 'Instal Sekarang'}
              </button>
            )}
            {isIOS && (
              <button
                onClick={() => setShowIOSGuide(true)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-white font-medium text-xs border border-emerald-600/40 transition"
              >
                Petunjuk iOS
              </button>
            )}
          </div>
        </div>

        {/* Modal Petunjuk iOS */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-emerald-500/30 p-6 text-white shadow-2xl relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 border border-emerald-500/30">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-emerald-300">Instal di iPhone / iPad</h3>
              <div className="mt-3 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <p>Buka tautan ini di peramban <strong>Safari</strong>.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <p>Ketuk tombol <strong>Share / Bagikan</strong> (ikon kotak dengan panah atas di bilah bawah Safari).</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                  <p>Pilih opsi <strong>"Add to Home Screen"</strong> (Tambah ke Layar Utama).</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
                  <p>Ketuk <strong>Add</strong> di pojok kanan atas. SITENANG akan muncul di layar depan ponsel Anda.</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Compact / Button variant for Header or Sidebar
  if (isInstallable) {
    return (
      <button
        onClick={handleInstallClick}
        disabled={isInstalling}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium shadow transition active:scale-95 ${className}`}
        title="Instal SITENANG di perangkat ini"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{isInstalling ? 'Memasang...' : 'Instal Aplikasi'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition ${className}`}
          title="Petunjuk instalasi di iOS"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Instal di iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-emerald-500/30 p-6 text-white shadow-2xl relative">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold text-emerald-300">Instal di iPhone / iPad</h3>
              <p className="text-xs text-slate-300 mt-2">
                1. Ketuk ikon <strong>Bagikan (Share)</strong> di bilah navigasi Safari.<br />
                2. Geser ke bawah lalu ketuk <strong>Add to Home Screen</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
