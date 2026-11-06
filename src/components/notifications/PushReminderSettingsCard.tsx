import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  Send,
  Smartphone,
  ShieldCheck,
  Clock,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import {
  checkFCMSupport,
  getNotificationPermissionStatus,
  requestFCMToken,
  sendTestNotification
} from '../../services/fcmNotificationService';

interface PushReminderSettingsCardProps {
  user?: {
    id?: string;
    userId?: string;
    employee_id?: string;
    nama_lengkap?: string;
    role?: string;
  };
  compact?: boolean;
}

export const PushReminderSettingsCard: React.FC<PushReminderSettingsCardProps> = ({
  user,
  compact = false
}) => {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [loading, setLoading] = useState<boolean>(false);
  const [testLoading, setTestLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [tokenPreview, setTokenPreview] = useState<string>('');

  useEffect(() => {
    async function initCheck() {
      const supported = await checkFCMSupport();
      setIsSupported(supported);
      const perm = getNotificationPermissionStatus();
      setPermission(perm);

      const savedToken = localStorage.getItem('sitenang_fcm_token');
      if (savedToken) {
        setTokenPreview(savedToken);
      } else if (perm === 'granted') {
        // Automatically sync FCM token in background if permission is already granted
        requestFCMToken({
          userId: user?.id || user?.userId,
          employeeId: user?.employee_id,
          role: user?.role
        }).then(res => {
          if (res.token) {
            setTokenPreview(res.token);
          }
        }).catch(() => {});
      }
    }
    initCheck();
  }, [user?.id, user?.employee_id]);

  const handleEnablePush = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await requestFCMToken({
        userId: user?.id || user?.userId,
        employeeId: user?.employee_id,
        role: user?.role
      });

      setPermission(result.permission);

      if (result.success && result.token) {
        setTokenPreview(result.token);
        setMessage({
          type: 'success',
          text: 'Berhasil! Notifikasi push Firebase Cloud Messaging (FCM) telah aktif di perangkat ini.'
        });
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Gagal mengaktifkan notifikasi push.'
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'Terjadi kesalahan saat meminta izin notifikasi.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setTestLoading(true);
    setMessage(null);
    try {
      const res = await sendTestNotification({
        userId: user?.id || user?.userId,
        employeeId: user?.employee_id
      });
      setMessage({
        type: 'success',
        text: res.message
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'Gagal mengirim notifikasi uji coba.'
      });
    } finally {
      setTestLoading(false);
    }
  };

  const isGranted = permission === 'granted';
  const isDenied = permission === 'denied';

  if (compact) {
    return (
      <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 text-white shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isGranted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
              {isGranted ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-slate-100">Pengingat Presensi Push (FCM)</h4>
                {isGranted && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Aktif
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                {isGranted
                  ? 'Pengingat masuk (06:00-08:30) & pulang aktif'
                  : 'Aktifkan agar tidak lupa presensi dan kena status TK'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isGranted ? (
              <button
                onClick={handleEnablePush}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow flex items-center gap-1.5 disabled:opacity-50"
              >
                <Bell className="w-3.5 h-3.5" />
                {loading ? 'Mengaktifkan...' : 'Aktifkan'}
              </button>
            ) : (
              <button
                onClick={handleTestNotification}
                disabled={testLoading}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition flex items-center gap-1.5"
                title="Kirim notifikasi uji coba ke perangkat ini"
              >
                <Send className="w-3 h-3 text-emerald-400" />
                {testLoading ? 'Menguji...' : 'Tes'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/80 border border-emerald-500/30 rounded-2xl p-5 text-white shadow-xl backdrop-blur relative overflow-hidden">
      {/* Decorative accent */}
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${isGranted ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-emerald-900/30 shadow-lg' : isDenied ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
            {isGranted ? <BellRing className="w-6 h-6 animate-pulse" /> : isDenied ? <BellOff className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                Notifikasi Pengingat Absensi Harian (FCM & PWA)
              </h3>
              {isGranted ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Aktif Real-time
                </span>
              ) : isDenied ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Izin Diblokir
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Belum Diaktifkan
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Dapatkan pengingat otomatis langsung di layar ponsel atau laptop Anda sebelum batas waktu presensi berakhir. Notifikasi bekerja secara real-time via <strong>Firebase Cloud Messaging</strong> dan PWA Service Worker.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-start">
          {!isGranted ? (
            <button
              onClick={handleEnablePush}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-900/40 transition active:scale-95 flex items-center gap-2 disabled:opacity-60"
            >
              <Bell className="w-4 h-4" />
              {loading ? 'Mengaktifkan...' : 'Aktifkan Notifikasi'}
            </button>
          ) : (
            <button
              onClick={handleTestNotification}
              disabled={testLoading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition active:scale-95 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              {testLoading ? 'Mengirim...' : 'Tes Notifikasi Real-time'}
            </button>
          )}
        </div>
      </div>

      {/* Jadwal Pengingat Absensi */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-300">Pengingat Presensi Masuk</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200">06.00 - 08.30 WIB</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-snug">
              Pengingat dikirim pukul <strong>06.30 WIB</strong> dan <strong>08.00 WIB</strong> (30 menit sebelum batas akhir). Lewat pukul 08.30 WIB tombol masuk ditutup dan pegawai dinyatakan <strong>TK (Tanpa Keterangan)</strong>.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-cyan-300">Pengingat Presensi Pulang</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200">16.00 - 23.59 WIB</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-snug">
              Pengingat dikirim pukul <strong>16.00 WIB</strong> saat jam kerja selesai. Anda dapat melakukan presensi pulang hingga pukul <strong>23.59 WIB</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={`mt-3.5 p-3 rounded-xl text-xs flex items-center gap-2 border ${message.type === 'success' ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200' : message.type === 'error' ? 'bg-rose-950/60 border-rose-500/40 text-rose-200' : 'bg-slate-800 border-slate-700 text-slate-200'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Status Denied Guidance */}
      {isDenied && (
        <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs">
          <strong>Perhatian:</strong> Izin notifikasi telah diblokir di pengaturan peramban Anda. Untuk mengaktifkannya, klik ikon gembok di bilah alamat browser (URL), pilih <em>Permissions/Izin</em>, ubah <em>Notifications</em> ke <strong>Allow/Izinkan</strong>, lalu muat ulang halaman.
        </div>
      )}
    </div>
  );
};
