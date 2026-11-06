import React from 'react';
import {
  Bell,
  BellRing,
  Clock,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Play,
  X,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { Modal } from '../Modal';
import { useAttendanceReminder } from '../../context/AttendanceReminderContext';

export const AttendanceReminderModal: React.FC = () => {
  const {
    isSettingsOpen,
    closeSettings,
    config,
    updateConfig,
    permission,
    requestPermission,
    triggerTestNotification,
  } = useAttendanceReminder();

  if (!isSettingsOpen) return null;

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={closeSettings}
      title="Pengaturan Pengingat Absensi (Push Notification)"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-xs">
        {/* Header summary banner */}
        <div className="p-3.5 bg-linear-to-r from-emerald-800 via-teal-700 to-sky-700 text-white rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-sm">
            <BellRing className="w-4 h-4 text-amber-300 animate-bounce" />
            <span>Pengingat Presensi Otomatis</span>
          </div>
          <p className="text-[11px] text-teal-100 leading-relaxed">
            SITENANG akan mengirimkan notifikasi suara & pop-up pada jam-jam tertentu agar pegawai tidak lupa melakukan absensi masuk dan pulang.
          </p>
        </div>

        {/* Browser Permission Status Card */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-teal-700" />
              Izin Notifikasi Perangkat / Browser:
            </span>
            {permission === 'granted' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3 h-3" /> Diizinkan
              </span>
            ) : permission === 'denied' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                <AlertTriangle className="w-3 h-3" /> Diblokir di Browser
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                <Info className="w-3 h-3" /> Belum Diaktifkan
              </span>
            )}
          </div>

          {permission !== 'granted' && (
            <div className="pt-1">
              <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                Untuk menerima notifikasi sistem di HP atau laptop, klik tombol di bawah untuk mengizinkan:
              </p>
              <button
                type="button"
                onClick={requestPermission}
                className="w-full py-2 px-3 bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                <Bell className="w-3.5 h-3.5 text-amber-200" />
                <span>Aktifkan Izin Notifikasi Browser / HP</span>
              </button>
            </div>
          )}
        </div>

        {/* Main On/Off Toggle */}
        <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
          <div>
            <span className="font-bold text-slate-900 block">Status Pengingat Otomatis</span>
            <span className="text-[10px] text-slate-500">
              {config.enabled ? 'Sistem pengingat aktif setiap hari kerja' : 'Pengingat dinonaktifkan'}
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={e => updateConfig({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
          </label>
        </div>

        {/* Schedule Inputs */}
        <div className="space-y-3 p-3 bg-slate-50/70 border border-slate-200 rounded-xl">
          <span className="font-bold text-slate-800 block text-xs">Jadwal Jam Notifikasi (WIB):</span>

          {/* Morning Check-In */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Pengingat Absen Masuk:
              </span>
              <span className="text-[10px] text-slate-400 block">
                Batas tepat waktu jam 07:30 WIB
              </span>
            </div>
            <input
              type="time"
              value={config.morningTime}
              onChange={e => updateConfig({ morningTime: e.target.value })}
              className="px-2 py-1 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Afternoon Mon-Thu Check-Out */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Pengingat Pulang (Senin - Kamis):
              </span>
              <span className="text-[10px] text-slate-400 block">
                Jam pulang standar kedinasan (16:30)
              </span>
            </div>
            <input
              type="time"
              value={config.afternoonTime}
              onChange={e => updateConfig({ afternoonTime: e.target.value })}
              className="px-2 py-1 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Friday Afternoon Check-Out */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Pengingat Pulang (Khusus Hari Jumat):
              </span>
              <span className="text-[10px] text-slate-400 block">
                Jam pulang hari Jumat (16:00)
              </span>
            </div>
            <input
              type="time"
              value={config.fridayAfternoonTime}
              onChange={e => updateConfig({ fridayAfternoonTime: e.target.value })}
              className="px-2 py-1 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 bg-slate-50 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Sound & Tone Options */}
        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
              {config.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-teal-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              Bunyikan Nada Chime Saat Notifikasi
            </span>
            <input
              type="checkbox"
              checked={config.soundEnabled}
              onChange={e => updateConfig({ soundEnabled: e.target.checked })}
              className="w-4 h-4 text-teal-600 rounded-sm focus:ring-teal-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Test Notification Trigger */}
        <div className="pt-1">
          <button
            type="button"
            onClick={triggerTestNotification}
            className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-800 font-bold rounded-xl border border-slate-300 text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs"
          >
            <Play className="w-3.5 h-3.5 text-teal-700 fill-teal-700" />
            <span>Kirim Uji Coba Notifikasi Sekarang (Coba Bunyi & Pop-Up)</span>
          </button>
        </div>

        {/* Save / Close */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={closeSettings}
            className="px-5 py-2.5 bg-linear-to-r from-emerald-800 to-teal-700 hover:opacity-95 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
          >
            Selesai & Simpan
          </button>
        </div>
      </div>
    </Modal>
  );
};
