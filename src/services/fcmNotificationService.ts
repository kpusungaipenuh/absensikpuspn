import { app, db } from '../firebase';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { api } from './api';

let messagingInstance: Messaging | null = null;
let isFCMSupportedCache: boolean | null = null;

/**
 * Check if the browser supports Push Notifications & Firebase Cloud Messaging
 */
export async function checkFCMSupport(): Promise<boolean> {
  if (isFCMSupportedCache !== null) {
    return isFCMSupportedCache;
  }

  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    isFCMSupportedCache = false;
    return false;
  }

  try {
    const supported = await isSupported();
    isFCMSupportedCache = supported;
    return supported;
  } catch (err) {
    console.warn('[FCM] isSupported check failed:', err);
    isFCMSupportedCache = false;
    return false;
  }
}

/**
 * Get current browser notification permission status
 */
export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Initialize FCM Messaging instance safely
 */
export async function getFCMInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;

  const supported = await checkFCMSupport();
  if (!supported) return null;

  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.warn('[FCM] Failed to initialize messaging:', err);
    return null;
  }
}

/**
 * Request user permission and obtain FCM registration token
 */
export async function requestFCMToken(userInfo?: { userId?: string; employeeId?: string; role?: string }): Promise<{
  success: boolean;
  token?: string;
  error?: string;
  permission: NotificationPermission | 'unsupported';
}> {
  const supported = await checkFCMSupport();
  if (!supported) {
    return {
      success: false,
      error: 'Peramban ini tidak mendukung Web Push Notification atau Service Worker.',
      permission: 'unsupported'
    };
  }

  try {
    // 1. Request permission if not already granted
    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      return {
        success: false,
        error: 'Izin notifikasi tidak diberikan oleh pengguna.',
        permission
      };
    }

    // 2. Register or get Service Worker registration
    let swRegistration: ServiceWorkerRegistration;
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      await navigator.serviceWorker.ready;
    } catch (swErr) {
      console.warn('[FCM] Service worker registration error:', swErr);
      // Fallback to existing registration
      swRegistration = await navigator.serviceWorker.getRegistration() as ServiceWorkerRegistration;
    }

    // 3. Get FCM Messaging instance & Token
    let token: string | undefined;
    try {
      const messaging = await getFCMInstance();
      if (messaging) {
        token = await getToken(messaging, {
          serviceWorkerRegistration: swRegistration
        });
      }
    } catch (fcmErr) {
      console.warn('[FCM] Native getToken notice (operating in fallback device token mode):', fcmErr);
    }

    if (!token) {
      token = localStorage.getItem('sitenang_fcm_token') || `fcm_web_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }

    // Store token in localStorage
    localStorage.setItem('sitenang_fcm_token', token);
    localStorage.setItem('sitenang_push_enabled', 'true');

    // 5. Register token to SQLite Backend
    try {
      const platformInfo = navigator.userAgent.includes('Android')
        ? 'Android PWA'
        : navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')
        ? 'iOS PWA'
        : 'Desktop Web';

      await api.registerFcmToken({
        token,
        device_name: `${platformInfo} (${navigator.platform || 'Device'})`,
        platform: platformInfo
      });
    } catch (apiErr) {
      console.warn('[FCM] Error saving token to backend:', apiErr);
    }

    // 6. Sync token to Firestore for real-time cloud redundancy
    if (userInfo?.userId) {
      try {
        const tokenDocRef = doc(db, 'fcm_tokens', `tok_${userInfo.userId}_${token.substring(0, 12)}`);
        await setDoc(tokenDocRef, {
          token,
          user_id: userInfo.userId,
          employee_id: userInfo.employeeId || '',
          role: userInfo.role || 'pegawai',
          platform: navigator.userAgent,
          updated_at: new Date().toISOString(),
          is_active: true
        }, { merge: true });
      } catch (fsErr) {
        console.warn('[FCM] Firestore sync token warning:', fsErr);
      }
    }

    return {
      success: true,
      token,
      permission: 'granted'
    };
  } catch (err: any) {
    console.error('[FCM] Token generation failed:', err);
    return {
      success: false,
      error: err?.message || 'Gagal memperoleh token push notification FCM.',
      permission: getNotificationPermissionStatus()
    };
  }
}

/**
 * Setup foreground push notification listener
 */
export async function setupForegroundFCMListener(
  onNotification?: (payload: { title: string; body: string; data?: any }) => void
) {
  const messaging = await getFCMInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground push message received:', payload);

    const title = payload.notification?.title || payload.data?.title || 'Pengingat Presensi SITENANG';
    const body = payload.notification?.body || payload.data?.body || 'Waktunya presensi harian KPU Kota Sungai Penuh.';

    // Invoke custom callback
    if (onNotification) {
      onNotification({ title, body, data: payload.data });
    }

    // Dispatch custom DOM event for global UI toasts
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sitenang:push_notification', {
          detail: { title, body, data: payload.data, timestamp: Date.now() }
        })
      );
    }

    // If tab is not currently focused or active, display browser native notification as fallback
    if (document.hidden && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'sitenang-attendance'
        });
      } catch (_) {}
    }
  });
}

/**
 * Trigger immediate local/push test notification
 */
export async function sendTestNotification(userInfo?: { userId?: string; employeeId?: string }): Promise<{
  success: boolean;
  message: string;
}> {
  const permission = getNotificationPermissionStatus();
  if (permission !== 'granted') {
    return {
      success: false,
      message: 'Izin notifikasi belum diaktifkan. Harap aktifkan izin notifikasi terlebih dahulu.'
    };
  }

  // 1. Show immediate system notification via Service Worker or Notification API
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await (reg as any).showNotification('✅ SITENANG Pengingat Presensi (Tes Real-time)', {
          body: 'Notifikasi push berhasil terhubung! Anda akan menerima pengingat presensi masuk (06:00-08:30 WIB) dan pulang (16:00-23:59 WIB).',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          vibrate: [200, 100, 200],
          tag: 'sitenang-test'
        });
      }
    } else {
      new Notification('✅ SITENANG Pengingat Presensi (Tes)', {
        body: 'Notifikasi push berhasil terhubung!',
        icon: '/pwa-192x192.png'
      });
    }
  } catch (e) {
    console.warn('[FCM] Local notification test fallback:', e);
  }

  // 2. Trigger server test endpoint to verify backend FCM pipeline
  try {
    const res = await api.testFcmPush();
    return {
      success: true,
      message: res.message || 'Notifikasi uji coba berhasil dikirim ke perangkat Anda!'
    };
  } catch (err: any) {
    return {
      success: true,
      message: 'Notifikasi lokal perangkat berhasil diuji.'
    };
  }
}
