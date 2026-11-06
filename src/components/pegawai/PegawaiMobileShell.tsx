import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Home,
  User as UserIcon,
  Bell,
  Headphones,
  QrCode,
  ScanFace,
  ChevronLeft,
  Smartphone,
  Maximize2,
  Minimize2,
  X,
  Phone,
  MessageCircle,
  HelpCircle,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  LogOut,
  MapPin,
  BellRing
} from 'lucide-react';
import { api } from '../../services/api';
import { NotificationItem } from '../../types';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { PushReminderSettingsCard } from '../notifications/PushReminderSettingsCard';
import { AttendanceReminderModal } from './AttendanceReminderModal';
import { useAttendanceReminder } from '../../context/AttendanceReminderContext';
import { RoleSwitcherButton } from '../RoleSwitcherButton';
import { ThemeToggle } from '../ThemeToggle';

interface PegawaiMobileShellProps {
  currentView: string;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
  onOpenQuickAbsen?: () => void;
  todayAttendanceStatus?: string;
}

export const PegawaiMobileShell: React.FC<PegawaiMobileShellProps> = ({
  currentView,
  onNavigate,
  children,
  onOpenQuickAbsen,
  todayAttendanceStatus
}) => {
  const { user, logout } = useAuth();

  // Desktop simulator mode: 'phone' (iPhone/Android mockup) vs 'expanded' (full responsive)
  const [deviceMode, setDeviceMode] = useState<'phone' | 'expanded'>('phone');
  
  // Attendance Reminder Settings
  const { openSettings: openReminderSettings, config: reminderConfig } = useAttendanceReminder();

  // Modals
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  useEffect(() => {
    const loadNotifs = async () => {
      try {
        const res = await api.getNotifications();
        if (res.notifications) {
          setNotifications(res.notifications);
          setUnreadCount(res.notifications.filter(n => !n.is_read).length);
        }
      } catch {
        // quiet fallback
      }
    };
    loadNotifs();
  }, []);

  const isHome = currentView === 'pegawai-dashboard' || currentView === 'pegawai-absensi';
  const isProfile = currentView === 'pegawai-profil' || currentView === 'pegawai-ubah-password';

  // Titles for subpages
  const getSubpageTitle = () => {
    switch (currentView) {
      case 'pegawai-riwayat-absensi':
        return 'Riwayat Presensi';
      case 'pegawai-ajukan-cuti':
      case 'pegawai-riwayat-cuti':
        return 'Permintaan Kehadiran';
      case 'pegawai-saldo-cuti':
        return 'Saldo Cuti Pegawai';
      case 'pegawai-kalender-cuti':
        return 'Kalender Kehadiran & Cuti';
      case 'pegawai-profil':
      case 'pegawai-ubah-password':
        return 'Profil & Akun Pegawai';
      default:
        return 'SITENANG Mobile';
    }
  };

  return (
    <div className="h-[100dvh] sm:min-h-screen bg-slate-950 text-slate-800 antialiased flex flex-col items-center justify-start sm:p-4 md:p-6 transition-all duration-300 overflow-hidden sm:overflow-auto">
      {/* Top Desktop Helper Bar (visible only on desktop/tablet screens >= 640px) */}
      <div className="w-full max-w-5xl hidden sm:flex items-center justify-between mb-3 px-3.5 py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 text-white text-xs shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-200">
            Aplikasi Presensi Pegawai KPU Kota Sungai Penuh
          </span>
          <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2.5 py-0.5 rounded-full font-bold">
            SITENANG Mobile
          </span>
        </div>

        <div className="flex items-center gap-2">
          <RoleSwitcherButton variant="full" />

          <button
            type="button"
            onClick={() => setDeviceMode(deviceMode === 'phone' ? 'expanded' : 'phone')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors font-medium cursor-pointer"
          >
            {deviceMode === 'phone' ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Mode Layar Lebar</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                <span>Mode Smartphone (Mockup)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40 transition-colors font-medium cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Main Container: Native Phone Frame Mockup or Full Fluid Container */}
      <div
        className={`w-full bg-[#F8FAFC] transition-all duration-300 relative flex flex-col shadow-2xl h-[100dvh] sm:h-auto overflow-hidden ${
          deviceMode === 'phone'
            ? 'sm:max-w-[425px] sm:h-[890px] sm:rounded-[44px] sm:border-[10px] sm:border-slate-800 sm:ring-1 sm:ring-slate-700'
            : 'sm:max-w-2xl sm:rounded-3xl sm:border sm:border-slate-200 sm:min-h-screen'
        }`}
      >
        {/* Top App Bar - Forest Green + Teal + Sky Blue Gradient with KPU Logo */}
        {isHome ? (
          <div className="bg-linear-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7] text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-md border-b border-teal-900/40">
            {/* Left: KPU Logo + SITENANG Title + Quick Scan */}
            <div className="flex items-center gap-2.5">
              <img
                src="https://www.kpu.go.id/images/1627539868logo-kpu.png"
                alt="Logo KPU"
                className="w-7 h-7 object-contain drop-shadow-sm shrink-0"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-black text-white tracking-wider font-sans leading-none drop-shadow-xs">
                    SITENANG
                  </span>
                  <div
                    onClick={() => onOpenQuickAbsen?.()}
                    className="w-5 h-5 rounded-md bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition-colors shadow-xs"
                    title="Pindai Presensi Cepat"
                  >
                    <QrCode className="w-3 h-3" />
                  </div>
                </div>
                <span className="text-[9px] text-teal-100 font-medium tracking-wide leading-none mt-0.5">
                  KPU KOTA SUNGAI PENUH
                </span>
              </div>
            </div>

            {/* Right: Role Switcher, PWA Install, Reminder, Notification Bell, Help pill */}
            <div className="flex items-center gap-1.5">
              {/* Dark Mode Toggle */}
              <ThemeToggle className="bg-white/15 text-white hover:bg-white/25 border-none p-1.5" />

              {/* Role Switcher (Operator mode toggle if assigned) */}
              <RoleSwitcherButton variant="compact" />

              {/* PWA Install Button */}
              <PWAInstallButton variant="compact" />

              {/* Attendance Reminder Settings Bell */}
              <button
                type="button"
                onClick={openReminderSettings}
                className="relative p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                title="Atur Pengingat Jam Absen (Push Notif)"
              >
                <BellRing className={`w-4 h-4 ${reminderConfig.enabled ? 'text-amber-300' : 'text-slate-300'}`} />
                {reminderConfig.enabled && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-emerald-400 rounded-full ring-1 ring-white" />
                )}
              </button>

              {/* Notification Bell */}
              <button
                type="button"
                onClick={() => setShowNotificationModal(true)}
                className="relative p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                title="Notifikasi Sistem"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-sky-400 text-slate-950 rounded-full text-[9px] font-black flex items-center justify-center shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Help button */}
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold backdrop-blur-xs transition-colors cursor-pointer border border-white/25 shadow-xs"
              >
                <Headphones className="w-3.5 h-3.5 text-sky-200" />
                <span className="hidden sm:inline">Help</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-linear-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-md border-b border-teal-900/40">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('pegawai-dashboard')}
                className="p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
                title="Kembali ke Beranda"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-2">
                <img
                  src="https://www.kpu.go.id/images/1627539868logo-kpu.png"
                  alt="Logo KPU"
                  className="w-5 h-5 object-contain shrink-0"
                />
                <h2 className="text-sm font-bold tracking-tight text-white line-clamp-1">
                  {getSubpageTitle()}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <RoleSwitcherButton variant="compact" />
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-xs transition-colors cursor-pointer border border-white/25"
              >
                <Headphones className="w-3.5 h-3.5 text-sky-200" />
                <span>Help</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Viewport with momentum touch scrolling */}
        <div className="flex-1 overflow-y-auto pb-32 relative select-text overscroll-contain">
          {children}
        </div>

        {/* Fixed Bottom Navigation Bar (ALWAYS docked at bottom of the screen on mobile without scrolling) */}
        <div className="fixed sm:absolute bottom-0 left-0 right-0 sm:inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-6 py-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-between z-40 shadow-[0_-4px_25px_rgba(0,0,0,0.08)]">
          {/* Left: Beranda (Home) */}
          <button
            type="button"
            onClick={() => onNavigate('pegawai-dashboard')}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              isHome ? 'text-emerald-800 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${isHome ? 'bg-emerald-50 text-emerald-700' : ''}`}>
              <Home className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px]">Beranda</span>
          </button>

          {/* Center Raised Action Button (FAB) in Forest Green + Teal + Sky Blue Gradient */}
          <div className="relative -top-5 flex flex-col items-center">
            <button
              type="button"
              id="fab-absen-mobile"
              onClick={() => onOpenQuickAbsen?.()}
              title="Presensi Masuk / Pulang (Kamera Selfie & GPS)"
              className="w-14 h-14 rounded-full bg-linear-to-tr from-[#064E3B] via-[#0D9488] to-[#0284C7] text-white flex items-center justify-center shadow-lg shadow-teal-800/35 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-4 ring-[#F8FAFC]"
            >
              <ScanFace className="w-7 h-7 stroke-[2.2]" />
            </button>
            <span className="text-[10px] font-bold text-teal-900 -mt-0.5 tracking-tight">
              Presensi
            </span>
          </div>

          {/* Right: Profil */}
          <button
            type="button"
            onClick={() => onNavigate('pegawai-profil')}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              isProfile ? 'text-emerald-800 font-bold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${isProfile ? 'bg-emerald-50 text-emerald-700' : ''}`}>
              <UserIcon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className="text-[11px]">Profil</span>
          </button>
        </div>

        {/* Android Virtual Navigation Bar indicator (|||  ◯  <) */}
        {deviceMode === 'phone' && (
          <div className="hidden sm:flex bg-white/95 border-t border-slate-100 py-1.5 px-8 items-center justify-around text-slate-400 text-xs shrink-0 select-none">
            <span className="font-mono tracking-widest text-slate-300 font-bold">|||</span>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
            <span className="font-mono text-slate-300 font-bold text-sm">&lt;</span>
          </div>
        )}
      </div>

      {/* HELP MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-teal-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                <Headphones className="w-4 h-4 text-teal-600" />
                <span>Pusat Bantuan SDM KPU</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-teal-50/70 rounded-2xl border border-teal-100 space-y-1">
                <p className="font-bold text-teal-950">
                  Layanan Bantuan Presensi & Cuti
                </p>
                <p className="text-teal-900/80 leading-relaxed text-[11px]">
                  Jika mengalami kendala GPS, kamera selfie, penggantian jam kerja, atau pengajuan cuti, silakan hubungi Subbagian SDM KPU Kota Sungai Penuh.
                </p>
              </div>

              <div className="space-y-2">
                <a
                  href="https://wa.me/6281234567890?text=Halo%20Admin%20SDM%20KPU%20Kota%20Sungai%20Penuh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-2xl border border-emerald-200 font-semibold transition-colors"
                >
                  <MessageCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="block font-bold text-xs">WhatsApp Helpdesk SDM</span>
                    <span className="text-[10px] text-emerald-700 font-normal">Respon Cepat Jam Kerja (07.30 - 16.30 WIB)</span>
                  </div>
                </a>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                    <span>Ketentuan Jam Presensi KPU</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Batas Hadir: 08.29 WIB (Lewat 08.29 dianggap TK)<br />
                    Hadir 07.30 s.d. 08.29: Wajib Ganti Jam Keterlambatan<br />
                    Radius Kantor KPU: Maksimal 150 Meter
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 bg-linear-to-r from-emerald-800 to-teal-700 hover:from-emerald-900 hover:to-teal-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICATION MODAL */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-teal-100 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                <Bell className="w-4 h-4 text-teal-600" />
                <span>Pemberitahuan & Notifikasi</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNotificationModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 text-xs">
              {/* Push Notification FCM Card */}
              <div className="mb-2">
                <PushReminderSettingsCard user={user} compact={true} />
              </div>

              {notifications.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-1">
                  <Bell className="w-6 h-6 mx-auto text-slate-300" />
                  <p>Belum ada notifikasi baru.</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-2xl border text-xs space-y-1 ${
                      n.is_read
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-teal-50/70 border-teal-200 text-teal-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{n.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {n.created_at?.substring(11, 16) || ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowNotificationModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors shrink-0 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Attendance Push Notification Settings Modal */}
      <AttendanceReminderModal />
      <OfflineIndicator />
    </div>
  );
};
