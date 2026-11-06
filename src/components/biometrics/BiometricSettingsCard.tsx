import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  ScanFace,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Smartphone,
  Trash2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import {
  isBiometricSupported,
  registerBiometricCredential,
  authenticateWithBiometrics,
  unregisterBiometric,
  getDeviceDescription
} from '../../services/biometricService';
import { api } from '../../services/api';

interface BiometricSettingsCardProps {
  user: any;
  onSuccess?: () => void;
}

export const BiometricSettingsCard: React.FC<BiometricSettingsCardProps> = ({ user, onSuccess }) => {
  const [supported, setSupported] = useState<boolean>(false);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [registeredDate, setRegisteredDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [testLoading, setTestLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const deviceName = getDeviceDescription();

  useEffect(() => {
    async function initCheck() {
      const isAvailable = await isBiometricSupported();
      setSupported(isAvailable);

      // Check if registered locally
      const localCredId = localStorage.getItem('sitenang_biometric_cred_id');
      const localEnabled = localStorage.getItem('sitenang_biometric_enabled') === 'true';

      // Check backend status
      try {
        const res = await api.getBiometricStatus();
        if (res.registered || (localEnabled && localCredId)) {
          setIsRegistered(true);
          if (res.credentials && res.credentials[0]) {
            setRegisteredDate(res.credentials[0].created_at);
          }
        } else {
          setIsRegistered(false);
        }
      } catch (_) {
        setIsRegistered(Boolean(localEnabled && localCredId));
      }
    }

    if (user?.id) {
      initCheck();
    }
  }, [user]);

  const handleRegister = async () => {
    if (!user) return;
    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await registerBiometricCredential({
        id: user.id,
        username: user.username,
        nama_lengkap: user.nama_lengkap || user.namaLengkap,
        email: user.email
      });

      if (res.success) {
        setIsRegistered(true);
        setStatusMsg({
          type: 'success',
          text: 'Sensor biometrik (Sidik Jari / Face ID) berhasil didaftarkan! Anda sekarang bisa masuk tanpa mengetik kata sandi.'
        });
        if (onSuccess) onSuccess();
      } else {
        setStatusMsg({
          type: 'error',
          text: res.message
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Gagal mendaftarkan sensor biometrik perangkat.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestVerify = async () => {
    setTestLoading(true);
    setStatusMsg(null);

    try {
      const res = await authenticateWithBiometrics(user?.username);
      if (res.success) {
        setStatusMsg({
          type: 'success',
          text: 'Verifikasi sidik jari / Face ID berhasil 100%! Sensor berfungsi normal dan siap digunakan.'
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: res.message
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Uji coba biometrik gagal.'
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus data biometrik untuk perangkat ini?')) return;
    setLoading(true);
    setStatusMsg(null);

    try {
      await unregisterBiometric();
      setIsRegistered(false);
      setStatusMsg({
        type: 'info',
        text: 'Kredensial biometrik perangkat ini telah dinonaktifkan.'
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Gagal menonaktifkan biometrik.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
            <Fingerprint className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Autentikasi Biometrik (Sidik Jari / Face ID)
            </h3>
            <p className="text-[11px] text-slate-500">
              Credential Management API & WebAuthn
            </p>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            isRegistered
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : supported
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}
        >
          {isRegistered ? 'Terdaftar & Aktif' : supported ? 'Sensor Tersedia' : 'Tidak Didukung'}
        </span>
      </div>

      <div className="text-xs text-slate-600 leading-relaxed space-y-2">
        <p>
          Gunakan sensor biometrik bawaan ponsel (Fingerprint / Face ID) atau laptop (Touch ID / Windows Hello) untuk masuk ke SITENANG tanpa perlu mengetik kata sandi lagi.
        </p>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 text-slate-700">
            <Smartphone className="w-4 h-4 text-teal-700 shrink-0" />
            <span>Perangkat: <strong className="text-slate-900">{deviceName}</strong></span>
          </div>
          <span className="font-semibold text-emerald-700">
            {supported ? '✓ Sensor Siap' : '✗ Tidak Terdeteksi'}
          </span>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : statusMsg.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-slate-50 text-slate-800 border-slate-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
        {!isRegistered ? (
          <button
            type="button"
            onClick={handleRegister}
            disabled={loading || !supported}
            className="flex items-center gap-2 px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 text-xs"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Fingerprint className="w-3.5 h-3.5 text-teal-300" />
            )}
            <span>{loading ? 'Menyentuh Sensor...' : 'Daftarkan Sidik Jari / Face ID'}</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleTestVerify}
              disabled={testLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 font-semibold rounded-xl border border-slate-200 transition cursor-pointer text-xs"
            >
              <Fingerprint className="w-3.5 h-3.5 text-teal-700" />
              <span>{testLoading ? 'Memindai...' : 'Uji Verifikasi'}</span>
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl border border-rose-200 transition cursor-pointer text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Biometrik</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
