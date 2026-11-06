import { api } from './api';

// Utility to convert ArrayBuffer to Base64URL
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Utility to convert Base64URL to Uint8Array
export function base64UrlToBuffer(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the current browser and device support Biometric Platform Authentication (Fingerprint / FaceID / TouchID / Windows Hello)
 */
export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Check if WebAuthn & Credential Management API are available
  if (!window.PublicKeyCredential || !navigator.credentials) {
    return false;
  }

  try {
    // Check if platform authenticator (fingerprint sensor, FaceID, TouchID) is available
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return isAvailable;
    }
    return true;
  } catch (err) {
    console.warn('[Biometric] Platform authenticator check error:', err);
    return false;
  }
}

/**
 * Get device name for descriptive tracking
 */
export function getDeviceDescription(): string {
  if (typeof navigator === 'undefined') return 'Perangkat Browser';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Ponsel Android (Fingerprint / Face)';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Perangkat Apple iOS (Face ID / Touch ID)';
  if (/Mac/i.test(ua)) return 'Apple Mac (Touch ID)';
  if (/Windows/i.test(ua)) return 'Windows PC (Windows Hello / Fingerprint)';
  return 'Perangkat Terpercaya';
}

/**
 * Register biometric credential for current user using browser Credential Management API
 */
export async function registerBiometricCredential(user: {
  id: string;
  username: string;
  nama_lengkap?: string;
  email?: string;
}): Promise<{ success: boolean; message: string; credentialId?: string }> {
  const supported = await isBiometricSupported();
  if (!supported) {
    return {
      success: false,
      message: 'Perangkat atau peramban ini tidak mendukung sensor biometrik (Fingerprint / Face ID).'
    };
  }

  try {
    // 1. Get challenge from server
    let challengeBytes: any = crypto.getRandomValues(new Uint8Array(32));
    try {
      const res = await api.getBiometricChallenge();
      if (res.challenge) {
        challengeBytes = base64UrlToBuffer(res.challenge);
      }
    } catch (_) {
      // Use local random challenge if offline/fallback
    }

    const userIdBytes = new TextEncoder().encode(user.id);
    const rpId = window.location.hostname;
    const deviceName = getDeviceDescription();

    // 2. Request credential creation via Credential Management API (WebAuthn)
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: challengeBytes as any,
        rp: {
          name: 'SITENANG - KPU Kota Sungai Penuh',
          id: rpId
        },
        user: {
          id: userIdBytes as any,
          name: user.username,
          displayName: user.nama_lengkap || user.username
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256 (ECDSA w/ SHA-256)
          { type: 'public-key', alg: -257 }  // RS256 (RSA w/ SHA-256)
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Built-in platform sensor (Fingerprint/FaceID)
          userVerification: 'required',
          residentKey: 'preferred'
        },
        timeout: 60000,
        attestation: 'none'
      }
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Gagal membaca sensor biometrik perangkat.');
    }

    const credentialId = bufferToBase64Url(credential.rawId);

    // 3. Register to backend
    await api.registerBiometricKey({
      credential_id: credentialId,
      device_name: deviceName,
      public_key: credential.id
    });

    // 4. Save local preferences
    localStorage.setItem('sitenang_biometric_enabled', 'true');
    localStorage.setItem('sitenang_biometric_username', user.username);
    localStorage.setItem('sitenang_biometric_name', user.nama_lengkap || user.username);
    localStorage.setItem('sitenang_biometric_cred_id', credentialId);

    return {
      success: true,
      message: 'Sensor biometrik (Sidik Jari / Face ID) berhasil didaftarkan untuk akun ini!',
      credentialId
    };
  } catch (err: any) {
    console.error('[Biometric] Registration failed:', err);
    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        message: 'Pendaftaran biometrik dibatalkan atau izin tidak diberikan oleh pengguna.'
      };
    }
    return {
      success: false,
      message: err.message || 'Gagal mendaftarkan sensor biometrik perangkat.'
    };
  }
}

/**
 * Perform login using biometric credential via Credential Management API
 */
export async function authenticateWithBiometrics(
  usernameHint?: string
): Promise<{ success: boolean; token?: string; user?: any; message: string }> {
  const supported = await isBiometricSupported();
  if (!supported) {
    return {
      success: false,
      message: 'Sensor biometrik (Fingerprint / Face ID) tidak didukung di perangkat atau peramban ini.'
    };
  }

  const storedCredId = localStorage.getItem('sitenang_biometric_cred_id');
  const storedUsername = usernameHint || localStorage.getItem('sitenang_biometric_username') || '';

  try {
    // 1. Get challenge from server
    let challengeBytes: any = crypto.getRandomValues(new Uint8Array(32));
    try {
      const res = await api.getBiometricChallenge();
      if (res.challenge) {
        challengeBytes = base64UrlToBuffer(res.challenge);
      }
    } catch (_) {}

    // Build allowCredentials list if known
    const allowCredentials: PublicKeyCredentialDescriptor[] = [];
    if (storedCredId) {
      try {
        allowCredentials.push({
          type: 'public-key',
          id: base64UrlToBuffer(storedCredId) as any
        });
      } catch (_) {}
    }

    // 2. Invoke browser Credential Management API to prompt native fingerprint / FaceID sensor
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: challengeBytes as any,
        rpId: window.location.hostname,
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        userVerification: 'required',
        timeout: 60000
      }
    })) as PublicKeyCredential;

    if (!assertion) {
      throw new Error('Sensor biometrik tidak merespons.');
    }

    const credentialId = bufferToBase64Url(assertion.rawId);

    // 3. Verify assertion with backend and retrieve authenticated session
    const loginRes = await api.loginWithBiometric({
      credential_id: credentialId,
      username: storedUsername || undefined
    });

    if (loginRes.token && loginRes.user) {
      // Update local storage
      localStorage.setItem('sitenang_biometric_enabled', 'true');
      localStorage.setItem('sitenang_biometric_username', loginRes.user.username);
      localStorage.setItem('sitenang_biometric_name', loginRes.user.namaLengkap || loginRes.user.username);
      localStorage.setItem('sitenang_biometric_cred_id', credentialId);

      return {
        success: true,
        token: loginRes.token,
        user: loginRes.user,
        message: `Selamat datang kembali, ${loginRes.user.namaLengkap || loginRes.user.username}!`
      };
    }

    return {
      success: false,
      message: 'Kredensial biometrik tidak cocok dengan akun terdaftar di sistem.'
    };
  } catch (err: any) {
    console.error('[Biometric] Authentication error:', err);
    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        message: 'Verifikasi biometrik dibatalkan.'
      };
    }
    return {
      success: false,
      message: err.message || 'Verifikasi biometrik gagal. Silakan masuk menggunakan kata sandi biasa.'
    };
  }
}

/**
 * Remove biometric registration for this device
 */
export async function unregisterBiometric(): Promise<boolean> {
  try {
    await api.unregisterBiometric();
  } catch (_) {}

  localStorage.removeItem('sitenang_biometric_enabled');
  localStorage.removeItem('sitenang_biometric_cred_id');
  return true;
}
