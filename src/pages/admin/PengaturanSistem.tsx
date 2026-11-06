import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { OfficeLocation, WorkSchedule, Holiday } from '../../types';
import {
  Settings,
  MapPin,
  Clock,
  Calendar,
  Save,
  Plus,
  Trash2,
  ShieldCheck,
  Building2,
  RefreshCw,
  ExternalLink,
  Lock,
  Sliders,
  Users,
  Key,
  UserCheck,
  Info,
  CheckCircle2
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { FeatureLockManager } from '../../components/admin/FeatureLockManager';
import {
  saveOfficeLocationToFirestore,
  saveWorkScheduleToFirestore,
  saveSystemSettingsToFirestore,
  saveHolidayToFirestore,
  deleteHolidayFromFirestore
} from '../../firebase';

export const PengaturanSistem: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'master' | 'features' | 'operators'>('master');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Office Location
  const [office, setOffice] = useState<OfficeLocation>({
    id: 'loc_kpu_spn',
    nama: 'Kantor KPU Kota Sungai Penuh',
    latitude: -2.069272,
    longitude: 101.403224,
    radius_meter: 150,
    alamat: 'Jl. Pancasila, Lawang Agung, Kecamatan Pondok Tinggi, Kota Sungai Penuh'
  });

  // Work Schedule
  const [schedule, setSchedule] = useState<WorkSchedule>({
    id: 'sched_default',
    jam_masuk: '07:30',
    jam_pulang: '16:00',
    toleransi_keterlambatan_menit: 15,
    hari_kerja: '1,2,3,4,5'
  });

  // Settings Key-Values
  const [settings, setSettings] = useState<Record<string, string>>({
    annual_leave_quota: '12',
    enable_gps_validation: 'true',
    working_days_only: 'true'
  });

  // Holidays
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holDate, setHolDate] = useState('');
  const [holName, setHolName] = useState('');
  const [holIsCutiBersama, setHolIsCutiBersama] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [stRes, holRes] = await Promise.all([
        api.getSettings(),
        api.getHolidays()
      ]);

      if (stRes.office) setOffice(stRes.office);
      if (stRes.schedule) setSchedule(stRes.schedule);
      if (stRes.settings) setSettings(stRes.settings);
      setHolidays(holRes.holidays || []);
    } catch (e) {
      console.error('Error fetching settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      await api.saveSettings({
        office,
        schedule,
        settings
      });

      // Simpan ke Google Firebase Firestore
      await Promise.allSettled([
        saveOfficeLocationToFirestore(office),
        saveWorkScheduleToFirestore(schedule),
        saveSystemSettingsToFirestore(settings)
      ]);

      alert('Pengaturan sistem KPU Kota Sungai Penuh berhasil diperbarui dan tersimpan permanen.');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holDate || !holName) return;

    try {
      const newHolRes = await api.addHoliday({
        tanggal: holDate,
        nama: holName,
        is_cuti_bersama: holIsCutiBersama
      });

      // Simpan ke Google Firebase Firestore
      saveHolidayToFirestore({
        id: (newHolRes as any)?.holiday?.id || `hol_${holDate.replace(/[^a-zA-Z0-9]/g, '_')}`,
        tanggal: holDate,
        nama: holName,
        is_cuti_bersama: holIsCutiBersama
      }).catch(err => console.warn('Firestore holiday sync warning:', err));

      setShowHolidayModal(false);
      setHolDate('');
      setHolName('');
      setHolIsCutiBersama(false);
      const res = await api.getHolidays();
      setHolidays(res.holidays || []);
    } catch (err: any) {
      alert(err.message || 'Gagal menambahkan hari libur.');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (confirm('Hapus tanggal libur ini?')) {
      try {
        await api.deleteHoliday(id);
        deleteHolidayFromFirestore(id).catch(err => console.warn('Firestore delete holiday warning:', err));
        const res = await api.getHolidays();
        setHolidays(res.holidays || []);
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus hari libur.');
      }
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Memuat konfigurasi sistem...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Pengaturan Sistem & Master Data
          </h2>
          <p className="text-xs text-slate-500">
            Konfigurasi jam operasional, radius geofencing kantor, jatah cuti, dan kontrol kesiapan rilis fitur
          </p>
        </div>

        {activeTab === 'master' && (
          <button
            id="btn-save-settings"
            onClick={handleSaveAll}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-linear-to-r from-emerald-800 via-teal-700 to-sky-700 hover:opacity-95 rounded-xl shadow-xs transition-opacity cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('master')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'master'
              ? 'bg-linear-to-r from-emerald-800 to-teal-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>1. Jam Kerja, Radius & Master Cuti</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('features')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'features'
              ? 'bg-linear-to-r from-emerald-800 to-teal-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>2. Kunci & Rilis Fitur (Feature Flags)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('operators')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'operators'
              ? 'bg-linear-to-r from-emerald-800 to-teal-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>3. Akun Operator & Kredensial Login</span>
        </button>
      </div>

      {activeTab === 'features' ? (
        <FeatureLockManager />
      ) : activeTab === 'operators' ? (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-slate-700 shadow-sm">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-blue-800/80 text-blue-100 border border-blue-700/50 mb-2">
              <UserCheck className="w-3.5 h-3.5" />
              Daftar Akun Operator Subbagian KPU Kota Sungai Penuh
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Informasi Username & Kredensial Operator
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl mt-1 leading-relaxed">
              Berikut adalah daftar akun operator resmi yang terdaftar pada sistem KPU Kota Sungai Penuh. Informasi akun ini juga dapat diakses langsung pada tombol <strong>"Pilihan Cepat Masuk Akun"</strong> di halaman depan login.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Operator SDM */}
            <div className="bg-white rounded-2xl border border-blue-200 shadow-xs p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 pointer-events-none" />
              <div className="flex items-center gap-2 mb-3">
                <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Operator SDM & Parmas</h3>
                  <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-semibold">
                    ROLE: operator_sdm
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 mt-4 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">Username Login:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm select-all">operatorsdm</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">Kata Sandi (Default):</span>
                  <span className="font-mono font-bold text-slate-800 text-sm select-all">sdm123</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">Email Kedinasan:</span>
                  <span className="font-mono text-slate-600 text-xs">sdm@kpu-sungaipenuh.go.id</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 block mb-1">Cakupan Wewenang:</span>
                <ul className="space-y-1 list-disc list-inside text-slate-600">
                  <li>Manajemen & Approval Cuti Pegawai</li>
                  <li>Monitoring Presensi & Luar Radius</li>
                  <li>Manajemen Data Pegawai & Akun</li>
                  <li>Rekapitulasi Kehadiran & Jam Kerja</li>
                </ul>
              </div>
            </div>

            {/* Operator Keuangan */}
            <div className="bg-white rounded-2xl border border-amber-200 shadow-xs p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-8 -mt-8 pointer-events-none" />
              <div className="flex items-center gap-2 mb-3">
                <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <Key className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Operator Keuangan</h3>
                  <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-semibold">
                    ROLE: operator_keuangan
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 mt-4 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">Username Login:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm select-all">operatorkeuangan</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">Kata Sandi (Default):</span>
                  <span className="font-mono font-bold text-slate-800 text-sm select-all">keuangan123</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">Email Kedinasan:</span>
                  <span className="font-mono text-slate-600 text-xs">keuangan@kpu-sungaipenuh.go.id</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 block mb-1">Cakupan Wewenang:</span>
                <ul className="space-y-1 list-disc list-inside text-slate-600">
                  <li>Perhitungan Tunjangan Kinerja (Tukin)</li>
                  <li>Simulasi Potongan Keterlambatan</li>
                  <li>Rekapitulasi Kehadiran untuk Tukin</li>
                  <li>Download Daftar Pembayaran Tukin</li>
                </ul>
              </div>
            </div>

            {/* Operator Umum & Logistik */}
            <div className="bg-white rounded-2xl border border-teal-200 shadow-xs p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-full -mr-8 -mt-8 pointer-events-none" />
              <div className="flex items-center gap-2 mb-3">
                <span className="p-2 bg-teal-100 text-teal-700 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Operator Umum & Logistik</h3>
                  <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-semibold">
                    ROLE: operator_umum
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 mt-4 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">Username Login:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm select-all">operatorumum</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">Kata Sandi (Default):</span>
                  <span className="font-mono font-bold text-slate-800 text-sm select-all">umum123</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">Email Kedinasan:</span>
                  <span className="font-mono text-slate-600 text-xs">umum@kpu-sungaipenuh.go.id</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700 block mb-1">Cakupan Wewenang:</span>
                <ul className="space-y-1 list-disc list-inside text-slate-600">
                  <li>Manajemen Surat Tugas Perjalanan Dinas (SPPD)</li>
                  <li>Pencatatan Tugas Dalam & Luar Daerah</li>
                  <li>Pengecekan Lampiran Bukti SPPD</li>
                  <li>Sinkronisasi Otomatis Bebas Absen Dinas</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Quick Notice Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 text-xs text-slate-600">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 block mb-0.5">Petunjuk Masuk Login Operator:</span>
              <p className="leading-relaxed">
                Operator dapat langsung memasukkan <strong>Username</strong> dan <strong>Kata Sandi</strong> di atas pada form login. Atau klik salah satu tombol <strong>"Pilihan Cepat Masuk Akun"</strong> pada halaman depan login tanpa perlu mengetik manual.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Pengaturan Jam Kerja & Toleransi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Clock className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Jam Kerja & Toleransi Keterlambatan
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jam Masuk Normal:</label>
                <input
                  type="time"
                  value={schedule.jam_masuk}
                  onChange={e => setSchedule({ ...schedule, jam_masuk: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-sm font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jam Pulang Normal:</label>
                <input
                  type="time"
                  value={schedule.jam_pulang}
                  onChange={e => setSchedule({ ...schedule, jam_pulang: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-sm font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Toleransi Keterlambatan (Menit):
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={schedule.toleransi_keterlambatan_menit}
                onChange={e =>
                  setSchedule({
                    ...schedule,
                    toleransi_keterlambatan_menit: Number(e.target.value)
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Pegawai yang check-in setelah {schedule.jam_masuk} + {schedule.toleransi_keterlambatan_menit} menit
                akan otomatis berstatus <strong>Terlambat</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* 2. Geofencing & Lokasi Kantor KPU */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                2. Lokasi Geofencing Kantor KPU
              </h3>
            </div>
            <a
              href={`https://www.google.com/maps?q=${office.latitude},${office.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100/80 px-2.5 py-1 rounded-lg transition-colors"
              title="Lihat titik koordinat di Google Maps"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Buka di Google Maps</span>
            </a>
          </div>

          <div className="space-y-3 text-xs">
            {/* Quick Set to Default KPU Coordinates Button */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="font-bold text-slate-800 block text-xs">Koordinat Default KPU:</span>
                <span className="text-[11px] font-mono text-slate-600 block">
                  Lat: -2.069272, Lon: 101.403224
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOffice(prev => ({
                    ...prev,
                    latitude: -2.069272,
                    longitude: 101.403224,
                    radius_meter: prev.radius_meter || 150,
                    nama: 'Kantor KPU Kota Sungai Penuh',
                    alamat: 'Jl. Pancasila, Lawang Agung, Kecamatan Pondok Tinggi, Kota Sungai Penuh'
                  }));
                }}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold rounded-lg text-[11px] shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3 text-teal-600" />
                <span>Pakai Default (-2.069272, 101.403224)</span>
              </button>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Lokasi Kantor:</label>
              <input
                type="text"
                value={office.nama}
                onChange={e => setOffice({ ...office, nama: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Latitude Kantor:</label>
                <input
                  type="number"
                  step="any"
                  value={office.latitude}
                  onChange={e => setOffice({ ...office, latitude: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Longitude Kantor:</label>
                <input
                  type="number"
                  step="any"
                  value={office.longitude}
                  onChange={e => setOffice({ ...office, longitude: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Radius Absensi Diizinkan (Meter):
              </label>
              <input
                type="number"
                min={10}
                max={1000}
                value={office.radius_meter}
                onChange={e => setOffice({ ...office, radius_meter: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Pegawai dengan metode kerja WFO harus berada dalam jarak maksimal ini untuk dapat melakukan absensi.
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap Kantor:</label>
              <input
                type="text"
                value={office.alamat}
                onChange={e => setOffice({ ...office, alamat: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px]">
              <span className="font-bold block">✓ Sinkronisasi Otomatis:</span>
              Jika lokasi atau radius diubah oleh Admin dan disimpan, seluruh validasi presensi harian pegawai langsung mengikuti lokasi terbaru ini.
            </div>
          </div>
        </div>

        {/* 3. Pengaturan Cuti */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Calendar className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              3. Kebijakan Hak & Saldo Cuti
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Jatah Cuti Tahunan Standar (Hari):
              </label>
              <input
                type="number"
                value={settings.annual_leave_quota || '12'}
                onChange={e => setSettings({ ...settings, annual_leave_quota: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-sm"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-800 block">Kaidah Hari Kerja Cuti:</span>
              <p className="text-slate-600 text-[11px]">
                Secara otomatis menghitung durasi hari kerja saja (Senin sampai Jumat). Hari Sabtu, Minggu,
                serta hari libur nasional / cuti bersama dikecualikan dari pemotongan saldo cuti.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Hari Libur Nasional & Cuti Bersama */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                4. Hari Libur Nasional & Cuti Bersama
              </h3>
            </div>
            <button
              onClick={() => setShowHolidayModal(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Libur</span>
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
            {holidays.map(h => (
              <div
                key={h.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/60"
              >
                <div>
                  <span className="font-semibold text-slate-800">{h.nama}</span>
                  <span className="text-[11px] font-mono text-slate-500 block">{h.tanggal}</span>
                </div>
                <div className="flex items-center gap-2">
                  {h.is_cuti_bersama === 1 && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-md">
                      Cuti Bersama
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteHoliday(h.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* MODAL ADD HOLIDAY */}
      {showHolidayModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowHolidayModal(false)}
          title="Tambah Hari Libur / Cuti Bersama"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleAddHoliday} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tanggal Libur:</label>
              <input
                type="date"
                required
                value={holDate}
                onChange={e => setHolDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Hari Libur:</label>
              <input
                type="text"
                required
                value={holName}
                onChange={e => setHolName(e.target.value)}
                placeholder="Misal: Tahun Baru Masehi, Hari Raya Idul Fitri..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="check-cuti-bersama"
                checked={holIsCutiBersama}
                onChange={e => setHolIsCutiBersama(e.target.checked)}
                className="rounded-sm text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="check-cuti-bersama" className="font-medium text-slate-700">
                Merupakan Cuti Bersama Resmi
              </label>
            </div>

            <div className="flex items-end justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowHolidayModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-semibold text-white bg-linear-to-r from-emerald-800 to-teal-700 hover:opacity-95 rounded-xl shadow-xs cursor-pointer"
              >
                Simpan Hari Libur
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
