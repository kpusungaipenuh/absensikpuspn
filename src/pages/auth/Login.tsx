import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Lock,
  User,
  ShieldCheck,
  ArrowRight,
  Building2,
  AlertCircle,
  Fingerprint,
  ScanFace,
  Sparkles,
  Smartphone,
  X
} from 'lucide-react';
import { isBiometricSupported, getDeviceDescription } from '../../services/biometricService';

interface SavedAccount {
  username: string;
  namaLengkap: string;
  role: string;
  nipNik?: string;
  fotoProfil?: string;
  jabatan?: string;
  unitKerja?: string;
}

export const Login: React.FC = () => {
  const { login, loginWithBiometrics } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [hasBiometricSensor, setHasBiometricSensor] = useState(false);
  const [savedBioUser, setSavedBioUser] = useState<{ username: string; name: string } | null>(null);
  const [savedAccount, setSavedAccount] = useState<SavedAccount | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    async function checkSensorAndSavedUser() {
      const supported = await isBiometricSupported();
      setHasBiometricSensor(supported);

      // Check saved account in localStorage
      try {
        const raw = localStorage.getItem('sitenang_saved_account');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.username) {
            setSavedAccount(parsed);
            setUsername(parsed.username);
          }
        }
      } catch (_) {}

      const savedName = localStorage.getItem('sitenang_biometric_name');
      const savedUser = localStorage.getItem('sitenang_biometric_username');
      if (savedUser) {
        setSavedBioUser({
          username: savedUser,
          name: savedName || savedUser
        });
        if (!username) {
          setUsername(savedUser);
        }
      }
    }
    checkSensorAndSavedUser();
  }, []);

  const handleSelectSavedAccount = (acc: SavedAccount) => {
    setUsername(acc.username);
    const pwdInput = document.getElementById('input-password');
    if (pwdInput) {
      pwdInput.focus();
    }
  };

  const handleClearSavedAccount = () => {
    setSavedAccount(null);
    setUsername('');
    setPassword('');
    localStorage.removeItem('sitenang_saved_account');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(username, password, rememberMe);
    } catch (err: any) {
      setError(err.message || 'Gagal login. Periksa username dan password Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError(null);
    setIsBiometricLoading(true);

    try {
      await loginWithBiometrics(username.trim() || undefined);
    } catch (err: any) {
      setError(err.message || 'Verifikasi biometrik gagal. Silakan masukkan kata sandi.');
    } finally {
      setIsBiometricLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        {/* KPU Official Logo */}
        <div className="flex justify-center mb-3">
          <img
            src="https://www.kpu.go.id/images/1627539868logo-kpu.png"
            alt="Logo KPU RI"
            className="w-20 h-20 object-contain drop-shadow-md hover:scale-105 transition-transform"
          />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
          <span>SITENANG</span>
        </h2>
        <p className="text-sm font-extrabold text-red-700 tracking-wider mt-0.5">
          KPU KOTA SUNGAI PENUH
        </p>
        <p className="mt-1 text-xs text-slate-600 max-w-sm mx-auto font-medium">
          Sistem Informasi Terpadu Presensi, Penugasan WFH/WFA, dan Layanan Cuti Pegawai
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-200/80 sm:px-10">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Deteksi User Tersimpan di Perangkat */}
          {savedAccount && (
            <div className="mb-5 p-3.5 bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50/60 border border-teal-200 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {savedAccount.fotoProfil ? (
                    <img
                      src={savedAccount.fotoProfil}
                      alt={savedAccount.namaLengkap}
                      className="w-10 h-10 rounded-xl object-cover ring-2 ring-teal-600/30 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-sm">
                      {savedAccount.namaLengkap.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                      <span>{savedAccount.namaLengkap}</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-teal-200/80 text-teal-900 font-bold">
                        User Terdeteksi
                      </span>
                    </div>
                    <p className="text-[10.5px] text-teal-900 truncate mt-0.5 font-mono">
                      {savedAccount.nipNik ? `NIP: ${savedAccount.nipNik}` : savedAccount.username}
                      {savedAccount.jabatan ? ` • ${savedAccount.jabatan}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectSavedAccount(savedAccount)}
                    className="px-2.5 py-1.5 bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition flex items-center gap-1"
                    title="Gunakan akun ini"
                  >
                    <span>Gunakan</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSavedAccount}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                    title="Ganti akun / Masuk akun lain"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Biometric Login Card (Credential Management API) */}
          {hasBiometricSensor && savedBioUser && (
            <div className="mb-5 p-3.5 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/90 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                    <span>{savedBioUser.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-teal-200/70 text-teal-900 font-semibold">Biometrik</span>
                  </div>
                  <p className="text-[10.5px] text-teal-800 truncate mt-0.5">
                    Sentuh sensor sidik jari / Face ID untuk masuk
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={isBiometricLoading}
                className="px-3 py-2 bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shrink-0 transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isBiometricLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Fingerprint className="w-3.5 h-3.5 text-teal-300" />
                    <span>Masuk</span>
                  </>
                )}
              </button>
            </div>
          )}

          {hasBiometricSensor && !savedBioUser && (
            <div className="mb-5">
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={isBiometricLoading}
                className="w-full flex justify-center items-center gap-2.5 py-2.5 px-4 rounded-xl border border-teal-700/30 bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isBiometricLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 text-teal-300 animate-pulse" />
                    <span>Masuk dengan Sidik Jari / Face ID</span>
                  </>
                )}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400">
                  <span className="bg-white px-2">Atau gunakan kata sandi</span>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NIP / Username Pegawai
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="input-username"
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Masukkan NIP atau Username Admin (misal: admincutikpuspn)"
                  className="block w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kata Sandi
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5 pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-red-700 focus:ring-red-600 w-4 h-4 cursor-pointer"
                />
                <span className="text-[11.5px] font-medium text-slate-600">Ingat saya di perangkat ini</span>
              </label>
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-red-700 hover:bg-red-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-red-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Masuk ke Sistem</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Password dienkripsi menggunakan bcrypt hashing</span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} KPU Kota Sungai Penuh. Hak Cipta Dilindungi.
        </p>
      </div>
    </div>
  );
};
