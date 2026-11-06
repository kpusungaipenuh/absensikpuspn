import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  ReminderConfig,
  getReminderConfig,
  saveReminderConfig,
  getNotificationPermission,
  requestNotificationPermission,
  sendBrowserNotification,
  playChimeSound,
} from '../services/attendanceNotificationService';

interface AttendanceReminderContextType {
  config: ReminderConfig;
  updateConfig: (newConfig: Partial<ReminderConfig>) => void;
  permission: NotificationPermission | 'unsupported';
  requestPermission: () => Promise<void>;
  triggerTestNotification: () => void;
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  activeAlert: {
    type: 'IN' | 'OUT' | 'TEST';
    title: string;
    message: string;
  } | null;
  dismissAlert: () => void;
  setAttendanceStatus: (hasCheckedIn: boolean, hasCheckedOut: boolean) => void;
}

const AttendanceReminderContext = createContext<AttendanceReminderContextType | null>(null);

export const AttendanceReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ReminderConfig>(getReminderConfig);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(getNotificationPermission);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [hasCheckedOutToday, setHasCheckedOutToday] = useState(false);
  const [activeAlert, setActiveAlert] = useState<{
    type: 'IN' | 'OUT' | 'TEST';
    title: string;
    message: string;
  } | null>(null);

  // Synchronize permission state on mount
  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const updateConfig = (newFields: Partial<ReminderConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...newFields };
      saveReminderConfig(next);
      return next;
    });
  };

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
  };

  const setAttendanceStatus = useCallback((hasIn: boolean, hasOut: boolean) => {
    setHasCheckedInToday(hasIn);
    setHasCheckedOutToday(hasOut);
  }, []);

  const triggerTestNotification = () => {
    if (config.soundEnabled) {
      playChimeSound();
    }

    sendBrowserNotification('🔔 Uji Coba Notifikasi SITENANG', {
      body: 'Sistem pengingat absensi berhasil aktif! Anda akan menerima notifikasi otomatis sebelum jam masuk & pulang.',
    });

    setActiveAlert({
      type: 'TEST',
      title: 'Uji Coba Notifikasi Berhasil!',
      message: 'Sistem pengingat absensi SITENANG aktif. Anda akan menerima notifikasi otomatis sebelum jam presensi.',
    });
  };

  const dismissAlert = () => {
    setActiveAlert(null);
  };

  // Background reminder timer loop
  useEffect(() => {
    if (!config.enabled) return;

    const checkSchedule = () => {
      try {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday

        // Only remind on workdays (Monday=1 through Friday=5)
        if (dayOfWeek === 0 || dayOfWeek === 6) return;

        // Current Jakarta / WIB time in HH:mm
        const wibTimeStr = now.toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).replace('.', ':');

        const todayDateStr = now.toISOString().split('T')[0];

        // 1. Morning Check-in reminder
        if (
          !hasCheckedInToday &&
          config.morningTime === wibTimeStr &&
          config.lastNotifiedDateIn !== todayDateStr
        ) {
          if (config.soundEnabled) playChimeSound();

          sendBrowserNotification('⏰ Waktunya Absen Masuk KPU!', {
            body: 'Selamat pagi! Jangan lupa lakukan presensi masuk SITENANG sebelum pukul 07:30 WIB agar tercatat tepat waktu.',
          });

          setActiveAlert({
            type: 'IN',
            title: 'Pengingat Presensi Masuk (07:30 WIB)',
            message: 'Selamat pagi! Silakan lakukan presensi masuk SITENANG sekarang agar tercatat hadir tepat waktu.',
          });

          updateConfig({ lastNotifiedDateIn: todayDateStr });
        }

        // 2. Afternoon Check-out reminder
        const targetOutTime = dayOfWeek === 5 ? config.fridayAfternoonTime : config.afternoonTime;
        if (
          hasCheckedInToday &&
          !hasCheckedOutToday &&
          targetOutTime === wibTimeStr &&
          config.lastNotifiedDateOut !== todayDateStr
        ) {
          if (config.soundEnabled) playChimeSound();

          sendBrowserNotification('🔔 Waktunya Absen Pulang KPU!', {
            body: 'Jam kerja kedinasan telah selesai. Silakan lakukan presensi pulang SITENANG hari ini. Terima kasih atas dedikasi Anda!',
          });

          setActiveAlert({
            type: 'OUT',
            title: 'Pengingat Presensi Pulang',
            message: 'Jam kedinasan hari ini telah selesai. Jangan lupa lakukan presensi pulang SITENANG.',
          });

          updateConfig({ lastNotifiedDateOut: todayDateStr });
        }
      } catch (err) {
        console.warn('Error during attendance schedule check:', err);
      }
    };

    // Check immediately and every 25 seconds
    checkSchedule();
    const interval = setInterval(checkSchedule, 25000);
    return () => clearInterval(interval);
  }, [config, hasCheckedInToday, hasCheckedOutToday]);

  return (
    <AttendanceReminderContext.Provider
      value={{
        config,
        updateConfig,
        permission,
        requestPermission: handleRequestPermission,
        triggerTestNotification,
        isSettingsOpen,
        openSettings: () => setIsSettingsOpen(true),
        closeSettings: () => setIsSettingsOpen(false),
        activeAlert,
        dismissAlert,
        setAttendanceStatus,
      }}
    >
      {children}
    </AttendanceReminderContext.Provider>
  );
};

export const useAttendanceReminder = () => {
  const context = useContext(AttendanceReminderContext);
  if (!context) {
    throw new Error('useAttendanceReminder must be used within AttendanceReminderProvider');
  }
  return context;
};
