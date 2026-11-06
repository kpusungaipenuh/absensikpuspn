import React from 'react';
import {
  Download,
  Share2,
  PlusSquare,
  Smartphone,
  CheckCircle2,
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  Globe,
  Apple
} from 'lucide-react';
import { Modal } from '../Modal';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  onInstall: () => Promise<boolean>;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  isIOS,
  isAndroid,
  onInstall,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Panduan Instalasi SITENANG (Android & iOS)"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-xs">
        {/* App Hero Badge */}
        <div className="flex items-center gap-3.5 p-3.5 bg-linear-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7] text-white rounded-2xl shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0">
            <img src="/pwa-192x192.png" alt="SITENANG Icon" className="w-full h-full object-contain rounded-xl" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
              Aplikasi Resmi KPU Kota Sungai Penuh
            </span>
            <h3 className="text-base font-black tracking-tight leading-tight">
              SITENANG Mobile App
            </h3>
            <span className="text-[11px] text-teal-100 block mt-0.5">
              Presensi GPS, WFH/WFA, Notifikasi & Cuti Online
            </span>
          </div>
        </div>

        {/* Chromium Direct Install Action (Android / Desktop) */}
        {isInstallable && (
          <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900 text-xs">
              <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              <span>Instalasi Langsung Terdeteksi:</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Browser Anda mendukung pemasangan instan satu klik ke layar utama perangkat tanpa perlu membuka Play Store.
            </p>
            <button
              type="button"
              onClick={async () => {
                const res = await onInstall();
                if (res) onClose();
              }}
              className="w-full py-2.5 px-4 bg-linear-to-r from-emerald-700 to-teal-700 hover:brightness-105 active:scale-[0.99] text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition"
            >
              <Download className="w-4 h-4 text-amber-200" />
              <span>Pasang / Instal Aplikasi Sekarang</span>
            </button>
          </div>
        )}

        {/* Step-by-Step for iOS (iPhone / iPad Safari) */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
            <Apple className="w-4 h-4 text-slate-800" />
            <span>Cara Instal di iPhone / iPad (iOS Safari):</span>
          </div>
          <ol className="space-y-2 text-[11px] text-slate-600 list-decimal list-inside pl-1">
            <li className="leading-relaxed">
              Buka link aplikasi ini di browser <strong>Safari</strong> iPhone Anda.
            </li>
            <li className="leading-relaxed">
              Tekan tombol <strong>Bagikan (Share)</strong> <span className="inline-block p-1 bg-slate-200 rounded-md font-mono text-[10px] text-slate-800 align-middle"><Share2 className="w-3 h-3 inline" /> Kotak dengan panah ke atas</span> di baris menu bawah Safari.
            </li>
            <li className="leading-relaxed">
              Gulir menu ke bawah lalu pilih menu <strong>"Tambah ke Layar Utama" (Add to Home Screen)</strong> <PlusSquare className="w-3.5 h-3.5 inline text-slate-800" />.
            </li>
            <li className="leading-relaxed">
              Tekan <strong>"Tambah" (Add)</strong> di sudut kanan atas layar. Selesai! Ikon SITENANG kini muncul di beranda iPhone layaknya aplikasi App Store tanpa address bar.
            </li>
          </ol>
        </div>

        {/* Step-by-Step for Android (Chrome / Brave / Edge) */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
            <Smartphone className="w-4 h-4 text-emerald-700" />
            <span>Cara Instal di HP Android (Google Chrome / Brave):</span>
          </div>
          <ol className="space-y-2 text-[11px] text-slate-600 list-decimal list-inside pl-1">
            <li className="leading-relaxed">
              Buka link aplikasi di browser <strong>Google Chrome</strong> HP Android.
            </li>
            <li className="leading-relaxed">
              Tekan tombol titik tiga <strong>(&#8942;)</strong> di sudut kanan atas browser.
            </li>
            <li className="leading-relaxed">
              Pilih menu <strong>"Instal Aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.
            </li>
            <li className="leading-relaxed">
              Tekan tombol <strong>"Instal"</strong>. Sistem Android akan secara otomatis memverifikasi dan memasang aplikasi SITENANG ke menu HP Anda.
            </li>
          </ol>
        </div>

        {/* Keuntungan Versi PWA */}
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-1.5 text-[11px] text-teal-950">
          <span className="font-bold flex items-center gap-1.5 text-teal-900">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            Keuntungan Memasang Aplikasi SITENANG:
          </span>
          <ul className="space-y-1 pl-4 list-disc text-teal-900/90 text-[10.5px]">
            <li>Layar penuh (fullscreen standalone) tanpa bilah alamat browser yang mengganggu.</li>
            <li>Akses cepat sekali klik dari layar beranda HP.</li>
            <li>Mendukung notifikasi pengingat jam absensi masuk & pulang.</li>
            <li>Ringan, hemat memori ponsel, dan pembaruan otomatis tanpa perlu update manual di Play Store.</li>
          </ul>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer"
        >
          Tutup Panduan
        </button>
      </div>
    </Modal>
  );
};
