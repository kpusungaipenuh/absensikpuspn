import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  User,
  KeyRound,
  Mail,
  Phone,
  Building2,
  Calendar,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  Camera,
  Upload,
  Loader2,
  Fingerprint
} from 'lucide-react';
import { BiometricSettingsCard } from '../../components/biometrics/BiometricSettingsCard';

export const ProfilPegawai: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo upload
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string>(user?.fotoProfil || user?.foto_profil || '');

  useEffect(() => {
    if (user?.fotoProfil || user?.foto_profil) {
      setPreviewPhoto(user.fotoProfil || user.foto_profil || '');
    }
  }, [user?.fotoProfil, user?.foto_profil]);

  // Contact form
  const [email, setEmail] = useState(user?.email || '');
  const [nomorHp, setNomorHp] = useState(user?.nomor_hp || '');
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Password form
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setContactSuccess(false);

    try {
      setIsSavingContact(true);
      await api.updateProfile({ email, nomor_hp: nomorHp });
      setContactSuccess(true);
    } catch (err: any) {
      setContactError(err.message || 'Gagal memperbarui data kontak.');
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError('Password baru minimal terdiri dari 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi kata sandi tidak cocok dengan kata sandi baru.');
      return;
    }

    try {
      setIsSavingPassword(true);
      await api.changePassword({ oldPassword, newPassword });
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Gagal mengganti kata sandi. Pastikan password lama sesuai.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handlePhotoUpload = (file: File) => {
    if (!file) return;
    setPhotoMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const resultData = e.target?.result as string;
      if (!resultData) return;

      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setPreviewPhoto(dataUrl);
            setIsUploadingPhoto(true);
            await api.updateProfile({ foto_profil: dataUrl });
            await refreshUser();
            setPhotoMessage({ type: 'success', text: 'Foto profil berhasil diperbarui!' });
          } else {
            // Fallback directly to resultData
            setPreviewPhoto(resultData);
            setIsUploadingPhoto(true);
            await api.updateProfile({ foto_profil: resultData });
            await refreshUser();
            setPhotoMessage({ type: 'success', text: 'Foto profil berhasil diperbarui!' });
          }
        } catch (err: any) {
          setPhotoMessage({ type: 'error', text: err.message || 'Gagal memperbarui foto profil.' });
        } finally {
          setIsUploadingPhoto(false);
        }
      };

      img.onerror = async () => {
        // Fallback for formats not decodable via HTMLImageElement
        try {
          setPreviewPhoto(resultData);
          setIsUploadingPhoto(true);
          await api.updateProfile({ foto_profil: resultData });
          await refreshUser();
          setPhotoMessage({ type: 'success', text: 'Foto profil berhasil diperbarui!' });
        } catch (err: any) {
          setPhotoMessage({ type: 'error', text: err.message || 'Gagal memperbarui foto profil.' });
        } finally {
          setIsUploadingPhoto(false);
        }
      };

      img.src = resultData;
    };
    reader.readAsDataURL(file);
  };

  const handleResetPhoto = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus foto profil ini?')) return;
    try {
      setIsUploadingPhoto(true);
      await api.updateProfile({ foto_profil: '' });
      setPreviewPhoto('');
      await refreshUser();
      setPhotoMessage({ type: 'success', text: 'Foto profil berhasil dihapus.' });
    } catch (err: any) {
      setPhotoMessage({ type: 'error', text: err.message || 'Gagal menghapus foto profil.' });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Hidden File Input for Profile Photo */}
      <input
        ref={fileInputRef}
        id="user-photo-upload-input"
        type="file"
        accept="image/*"
        disabled={isUploadingPhoto}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handlePhotoUpload(e.target.files[0]);
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Header Profile Card */}
      <div className="bg-white p-6 rounded-2xl border border-red-100/80 shadow-xs flex flex-col sm:flex-row items-center gap-5">
        <div className="relative group shrink-0">
          {(previewPhoto || user?.fotoProfil || user?.foto_profil) ? (
            <img
              src={previewPhoto || user?.fotoProfil || user?.foto_profil}
              alt={user?.namaLengkap || (user as any)?.nama_lengkap || 'Pegawai'}
              className="w-24 h-24 rounded-2xl object-cover ring-2 ring-red-200 shadow-sm bg-white"
              onError={(e) => {
                (e.target as any).style.display = 'none';
                const el = document.getElementById('profil-avatar-fallback');
                if (el) el.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            id="profil-avatar-fallback"
            style={{ display: (previewPhoto || user?.fotoProfil || user?.foto_profil) ? 'none' : 'flex' }}
            className="w-24 h-24 rounded-2xl bg-linear-to-br from-red-800 to-amber-700 text-amber-100 ring-2 ring-red-200 shadow-sm items-center justify-center font-bold text-2xl"
          >
            {(user?.namaLengkap || (user as any)?.nama_lengkap || user?.username || 'P')
              .replace(/^(h\.|dr\.|hj\.|ir\.|drs\.)\s*/i, '')
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map(p => p[0].toUpperCase())
              .join('')}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPhoto}
            title="Ganti Foto Profil"
            className="absolute -bottom-2 -right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md cursor-pointer transition flex items-center justify-center group-hover:scale-105 disabled:opacity-50"
          >
            {isUploadingPhoto ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="text-center sm:text-left space-y-1.5 flex-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
            <Building2 className="w-3 h-3" />
            <span>KPU Kota Sungai Penuh</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {user?.namaLengkap || (user as any)?.nama_lengkap || user?.username}
          </h2>
          <div className="text-xs text-slate-500 font-mono">
            NIP/NIK: <span className="font-semibold text-slate-700">{(user as any)?.nip_nik || (user as any)?.nipNik || '-'}</span> | Username:{' '}
            <span className="text-slate-700">{user?.username}</span>
          </div>
          <div className="text-xs text-slate-600 font-medium">
            {user?.jabatan || 'Pegawai'} &bull; <span className="text-red-700">{user?.unitKerja || (user as any)?.unit_kerja || 'Sekretariat KPU'}</span>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition shadow-2xs disabled:opacity-50"
            >
              <Upload className="w-3 h-3 text-red-600" />
              <span>{isUploadingPhoto ? 'Mengunggah...' : 'Ganti Foto Profil'}</span>
            </button>
            {(previewPhoto || user?.fotoProfil || user?.foto_profil) && (
              <button
                type="button"
                onClick={handleResetPhoto}
                disabled={isUploadingPhoto}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs rounded-lg transition disabled:opacity-50"
              >
                Hapus Foto
              </button>
            )}
            {photoMessage && (
              <span
                className={`text-xs font-semibold flex items-center gap-1 ${
                  photoMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {photoMessage.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {photoMessage.text}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info Form */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Mail className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Informasi Kontak Pegawai
            </h3>
          </div>

          {contactSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Kontak berhasil diperbarui.</span>
            </div>
          )}

          {contactError && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{contactError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateContact} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alamat Email Resmi:</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nomor Handphone / WhatsApp:
              </label>
              <input
                type="text"
                value={nomorHp}
                onChange={e => setNomorHp(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-slate-500 text-[11px]">
              <div className="flex justify-between">
                <span>Tanggal Mulai Tugas (TMT):</span>
                <span className="font-mono text-slate-700">{user?.tanggal_masuk}</span>
              </div>
              <div className="flex justify-between">
                <span>Status Pegawai:</span>
                <span className="font-bold text-emerald-700 uppercase">{user?.status_pegawai}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingContact}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingContact ? 'Menyimpan...' : 'Perbarui Kontak'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Biometric Authentication (Fingerprint / Face ID) */}
        <BiometricSettingsCard user={user} onSuccess={refreshUser} />

        {/* Change Password Form */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <KeyRound className="w-4 h-4 text-red-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Ubah Kata Sandi (Password)
            </h3>
          </div>

          {passwordSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Kata sandi Anda berhasil diubah!</span>
            </div>
          )}

          {passwordError && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kata Sandi Saat Ini <span className="text-red-600">*</span>:
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="Masukkan kata sandi lama"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kata Sandi Baru <span className="text-red-600">*</span>:
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Ulangi Kata Sandi Baru <span className="text-red-600">*</span>:
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Ketik ulang kata sandi baru"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSavingPassword}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isSavingPassword ? 'Menyimpan...' : 'Ganti Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
