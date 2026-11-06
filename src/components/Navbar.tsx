import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Bell,
  LogOut,
  Menu,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Clock,
  CheckCheck,
  ExternalLink,
  X,
  Volume2
} from 'lucide-react';
import { api } from '../services/api';
import { NotificationItem } from '../types';
import { RoleSwitcherButton } from './RoleSwitcherButton';
import { PWAInstallButton } from './pwa/PWAInstallButton';
import { OfflineIndicator } from './pwa/OfflineIndicator';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  onToggleSidebar: () => void;
  onNavigate?: (view: string) => void;
}

// Gentle pleasant chime using Web Audio API
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.1, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch {
    // Ignore audio permission or autoplay restrictions
  }
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onNavigate }) => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Active floating toast for immediate visibility
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchNotifs = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
    } catch (e) {
      console.warn('Error fetching notifications:', e);
    }
  };

  // Trigger floating alert banner
  const triggerToast = (item: NotificationItem) => {
    setActiveToast(item);
    playNotificationChime();

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 7000);

    // If browser notifications are permitted, show native system/PWA push notification banner
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(item.title, {
              body: item.message,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: `sitenang-toast-${item.id || Date.now()}`,
              data: { url: item.action_url || '/' }
            });
          }).catch(() => {
            new Notification(item.title, {
              body: item.message,
              icon: '/pwa-192x192.png'
            });
          });
        } else {
          new Notification(item.title, {
            body: item.message,
            icon: '/pwa-192x192.png'
          });
        }
      } catch (_) {}
    }
  };

  // Real-time EventSource connection + fallback polling
  useEffect(() => {
    fetchNotifs();

    // Setup SSE connection
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/notifications/stream');

      eventSource.addEventListener('notification', (e: MessageEvent) => {
        try {
          const newNotif: NotificationItem = JSON.parse(e.data);
          setNotifications(prev => [newNotif, ...prev]);
          triggerToast(newNotif);
        } catch (err) {
          console.error('Failed to parse incoming notification event', err);
        }
      });

      eventSource.onerror = () => {
        // SSE connection dropped, will auto-reconnect or fallback to interval
      };
    } catch (err) {
      console.warn('SSE not supported or failed to initialize', err);
    }

    // Polling fallback every 15 seconds to ensure synchronization
    const pollInterval = setInterval(fetchNotifs, 15000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleRead = async (id: string, actionRedirect?: boolean) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
      );

      if (actionRedirect && onNavigate) {
        if (user?.role === 'admin') {
          onNavigate('admin-approval-cuti');
        } else {
          onNavigate('pegawai-ajukan-cuti');
        }
        setShowNotifications(false);
      }
    } catch (e) {
      console.warn('Error mark read:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.warn('Error marking all notifications read:', e);
    }
  };

  const getStatusBadge = (title: string, type: string) => {
    const t = title.toLowerCase();
    if (t.includes('disetujui')) {
      return {
        bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        icon: CheckCircle2,
        label: 'Disetujui'
      };
    }
    if (t.includes('ditolak')) {
      return {
        bg: 'bg-rose-100 text-rose-800 border-rose-200',
        dot: 'bg-rose-500',
        icon: AlertCircle,
        label: 'Ditolak'
      };
    }
    if (t.includes('dibatalkan')) {
      return {
        bg: 'bg-amber-100 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        icon: AlertTriangle,
        label: 'Dibatalkan'
      };
    }
    if (t.includes('baru') || t.includes('pengajuan')) {
      return {
        bg: 'bg-blue-100 text-blue-800 border-blue-200',
        dot: 'bg-blue-500',
        icon: Bell,
        label: 'Permohonan Baru'
      };
    }
    return {
      bg: 'bg-slate-100 text-slate-800 border-slate-200',
      dot: 'bg-slate-500',
      icon: Bell,
      label: 'Info'
    };
  };

  const filteredNotifs = notifications.filter(n => {
    if (activeTab === 'unread') return !n.is_read;
    return true;
  });

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-slate-200 shadow-xs">
      {/* Floating Real-Time Toast Alert */}
      {activeToast && (
        <div
          id="toast-realtime-notif"
          className="fixed top-20 right-4 sm:right-6 z-50 max-w-md w-full sm:w-96 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-4 animate-in slide-in-from-top-4 duration-300 ring-4 ring-slate-900/10"
        >
          <div className="flex items-start gap-3">
            {(() => {
              const badge = getStatusBadge(activeToast.title, activeToast.type);
              const Icon = badge.icon;
              return (
                <div className={`p-2 rounded-lg ${badge.bg} border shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
              );
            })()}

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Notifikasi Real-Time
                </span>
                <button
                  onClick={() => setActiveToast(null)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h4 className="text-sm font-semibold text-white mt-1">
                {activeToast.title}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed line-clamp-2">
                {activeToast.message}
              </p>

              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    handleRead(activeToast.id, true);
                    setActiveToast(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-linear-to-r from-emerald-700 via-teal-700 to-sky-700 hover:brightness-110 text-white rounded-lg transition-colors cursor-pointer"
                >
                  <span>Buka & Tinjau</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    handleRead(activeToast.id, false);
                    setActiveToast(null);
                  }}
                  className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Tandai Dibaca
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left side brand & toggle */}
      <div className="flex items-center gap-3">
        <button
          id="btn-toggle-sidebar"
          onClick={onToggleSidebar}
          className="p-2 -ml-2 text-slate-600 rounded-lg hover:bg-slate-100 focus:outline-hidden lg:hidden cursor-pointer"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <img
            src="https://www.kpu.go.id/images/1627539868logo-kpu.png"
            alt="Logo KPU"
            className="w-9 h-9 object-contain drop-shadow-xs"
          />
          <div className="hidden sm:block">
            <h1 className="text-sm font-extrabold tracking-tight text-slate-800 leading-tight flex items-center gap-1.5">
              <span>SITENANG</span>
              <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800">KPU Sungai Penuh</span>
            </h1>
            <p className="text-[10px] font-medium text-slate-500">
              Sistem Informasi Presensi, WFH/WFA, dan Layanan Cuti Pegawai
            </p>
          </div>
        </div>
      </div>

      {/* Right side navigation items */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Live Clock & Date */}
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <div className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {currentTime.toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 font-mono text-slate-700 font-semibold">
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            <span>{currentTime.toLocaleTimeString('id-ID')}</span>
          </div>
        </div>

        {/* Theme Dark Mode Toggle */}
        <ThemeToggle />

        {/* PWA Install Button */}
        <PWAInstallButton variant="compact" />
        <OfflineIndicator />

        {/* Notifications Button & Dropdown */}
        <div className="relative">
          <button
            id="btn-notification"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Lihat Notifikasi"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-white bg-teal-600 rounded-full ring-2 ring-white animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Notifikasi Internal
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-teal-100 text-teal-800 rounded-full">
                      {unreadCount} baru
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-800 hover:underline cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Tandai Semua Dibaca</span>
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 px-4 py-1.5 border-b border-slate-100 text-xs">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    activeTab === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Semua ({notifications.length})
                </button>
                <button
                  onClick={() => setActiveTab('unread')}
                  className={`px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    activeTab === 'unread'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Belum Dibaca ({unreadCount})
                </button>
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {filteredNotifs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <Bell className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    Tidak ada notifikasi {activeTab === 'unread' ? 'baru' : ''}
                  </div>
                ) : (
                  filteredNotifs.map(n => {
                    const badge = getStatusBadge(n.title, n.type);
                    const Icon = badge.icon;
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleRead(n.id, true)}
                        className={`p-3.5 text-xs transition-colors cursor-pointer relative group ${
                          n.is_read
                            ? 'bg-white opacity-75 hover:bg-slate-50 hover:opacity-100'
                            : 'bg-red-50/40 hover:bg-red-50/80 font-medium'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`p-1.5 rounded-lg shrink-0 ${badge.bg} border`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-semibold text-slate-800 truncate">
                                {n.title}
                              </span>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                {new Date(n.created_at).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>

                            <p className="text-slate-600 text-[11px] leading-relaxed mb-2">
                              {n.message}
                            </p>

                            <div className="flex items-center justify-between">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold rounded-md border ${badge.bg}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                {badge.label}
                              </span>

                              <span className="text-[10px] text-red-600 group-hover:underline inline-flex items-center gap-1 font-medium">
                                <span>Lihat detail</span>
                                <ExternalLink className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Role Switcher (Enabled when logged in employee has operator role assigned) */}
        <RoleSwitcherButton variant="full" />

        {/* User profile & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="flex items-center gap-2.5">
            {user?.fotoProfil || user?.foto_profil ? (
              <img
                src={user.fotoProfil || user.foto_profil}
                alt={user.namaLengkap || (user as any).nama_lengkap || 'User'}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                {user?.namaLengkap ? user.namaLengkap.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-800 truncate max-w-[140px]">
                {user?.namaLengkap}
              </div>
              <span
                className={`inline-block px-1.5 py-0.2 text-[10px] font-medium rounded-sm uppercase tracking-wider ${
                  user?.role === 'admin'
                    ? 'bg-red-100 text-red-800 font-semibold'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {user?.role}
              </span>
            </div>
          </div>

          <button
            id="btn-logout"
            onClick={logout}
            className="p-2 ml-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            title="Keluar / Logout"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
