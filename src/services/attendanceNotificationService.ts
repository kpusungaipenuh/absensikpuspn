// SITENANG Attendance Push Notification & Reminder Service

export interface ReminderConfig {
  enabled: boolean;
  morningTime: string; // e.g. "07:15"
  afternoonTime: string; // e.g. "16:30"
  fridayAfternoonTime: string; // e.g. "16:00"
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  lastNotifiedDateIn?: string;
  lastNotifiedDateOut?: string;
}

const STORAGE_KEY = 'sitenang_attendance_reminder_config';

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  enabled: true,
  morningTime: '07:15',
  afternoonTime: '16:30',
  fridayAfternoonTime: '16:00',
  soundEnabled: true,
  vibrateEnabled: true,
};

// Play a pleasant chime tone using Web Audio API
export function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // First note (E5 ~ 659.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Second note (A5 ~ 880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.65);
  } catch (e) {
    console.warn('Audio chime playback issue:', e);
  }
}

// Load reminder settings
export function getReminderConfig(): ReminderConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REMINDER_CONFIG;
    return { ...DEFAULT_REMINDER_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_REMINDER_CONFIG;
  }
}

// Save reminder settings
export function saveReminderConfig(config: ReminderConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save reminder config:', e);
  }
}

// Check notification permission state
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

// Request permission for Web Notifications
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (e) {
    console.error('Error requesting notification permission:', e);
    return 'denied';
  }
}

// Trigger an explicit browser notification
export function sendBrowserNotification(title: string, options?: NotificationOptions): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  if (Notification.permission === 'granted') {
    try {
      const notifOptions: any = {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'sitenang-attendance-reminder',
        renotify: true,
        ...options,
      };
      const notif = new Notification(title, notifOptions);

      notif.onclick = () => {
        window.focus();
        notif.close();
      };

      // Vibrate if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      return notif;
    } catch (e) {
      console.warn('Failed to dispatch Notification constructor:', e);
      // Try via service worker registration if available
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: 'sitenang-attendance-reminder',
            ...options,
          });
        });
      }
    }
  }
  return null;
}
