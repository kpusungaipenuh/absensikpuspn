import React, { useState, useEffect } from 'react';
import {
  X,
  UserCheck,
  Calendar,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Search,
  PlusCircle,
  Briefcase,
  LogIn,
  LogOut,
  CheckCheck,
  Info,
  Sparkles
} from 'lucide-react';
import { api } from '../../services/api';
import { Employee, AttendanceRecord } from '../../types';

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export type ManualAttendanceMode = 'keduanya' | 'masuk_saja' | 'pulang_saja';

export const ManualAttendanceModal: React.FC<ManualAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Mode Selection: 'keduanya' | 'masuk_saja' | 'pulang_saja'
  const [entryMode, setEntryMode] = useState<ManualAttendanceMode>('keduanya');

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [tanggal, setTanggal] = useState(() => {
    // Current date in WIB
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
    return formatter.format(now);
  });
  const [jamMasuk, setJamMasuk] = useState('07:30');
  const [jamPulang, setJamPulang] = useState('16:00');
  const [metodeKerja, setMetodeKerja] = useState<'WFO' | 'WFH' | 'DL'>('WFO');
  const [status, setStatus] = useState<string>('Otomatis');
  const [catatan, setCatatan] = useState('Pegawai lupa melakukan presensi mandiri');

  // Existing Record Detection
  const [existingRecord, setExistingRecord] = useState<AttendanceRecord | null>(null);
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMessage(null);
      loadEmployees();
    }
  }, [isOpen]);

  const loadEmployees = async () => {
    try {
      setIsLoadingEmployees(true);
      const res = await api.getEmployees({ status: 'aktif' });
      const list = res.employees || [];
      setEmployees(list);
      if (list.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(list[0].id);
      }
    } catch (err: any) {
      console.warn('Gagal memuat daftar pegawai:', err);
      setError('Gagal mengambil daftar pegawai. Muat ulang modal.');
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  // Cek apakah pegawai sudah memiliki catatan absensi pada tanggal yang dipilih
  useEffect(() => {
    if (isOpen && selectedEmployeeId && tanggal) {
      let isCancelled = false;
      setIsCheckingExisting(true);
      api.checkEmployeeAttendanceRecord(selectedEmployeeId, tanggal)
        .then(res => {
          if (!isCancelled) {
            const rec = res.record;
            setExistingRecord(rec);
            if (rec) {
              if (rec.jam_masuk && !jamMasuk) {
                setJamMasuk(rec.jam_masuk.substring(0, 5));
              }
              if (rec.jam_pulang && !jamPulang) {
                setJamPulang(rec.jam_pulang.substring(0, 5));
              }
            }
          }
        })
        .catch(() => {
          if (!isCancelled) setExistingRecord(null);
        })
        .finally(() => {
          if (!isCancelled) setIsCheckingExisting(false);
        });
      return () => {
        isCancelled = true;
      };
    } else {
      setExistingRecord(null);
    }
  }, [isOpen, selectedEmployeeId, tanggal]);

  if (!isOpen) return null;

  const filteredEmployees = employees.filter(emp => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      emp.nama_lengkap.toLowerCase().includes(q) ||
      (emp.nip_nik && emp.nip_nik.toLowerCase().includes(q)) ||
      (emp.jabatan && emp.jabatan.toLowerCase().includes(q))
    );
  });

  const selectedEmp = employees.find(e => e.id === selectedEmployeeId);

  // Helper kalkulasi keterlambatan
  const parseMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const inMins = (entryMode === 'keduanya' || entryMode === 'masuk_saja') && jamMasuk
    ? parseMinutes(jamMasuk)
    : (existingRecord?.jam_masuk ? parseMinutes(existingRecord.jam_masuk) : null);

  const schedInMins = 7 * 60 + 30; // 07:30 = 450 menit
  const schedOutMins = 16 * 60; // 16:00 = 960 menit
  const lateMinutes = inMins !== null ? Math.max(0, inMins - schedInMins) : 0;
  const requiredOutMins = schedOutMins + lateMinutes;
  const formatMins = (total: number) => {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const outMins = (entryMode === 'keduanya' || entryMode === 'pulang_saja') && jamPulang
    ? parseMinutes(jamPulang)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      setError('Pilih pegawai yang akan ditambahkan absensinya.');
      return;
    }
    if (!tanggal) {
      setError('Tanggal presensi wajib ditentukan.');
      return;
    }

    if (entryMode === 'keduanya') {
      if (!jamMasuk || !jamPulang) {
        setError('Untuk mode "Keduanya", Jam Masuk dan Jam Pulang wajib diisi.');
        return;
      }
    } else if (entryMode === 'masuk_saja') {
      if (!jamMasuk) {
        setError('Untuk mode "Absen Masuk Saja", Jam Masuk wajib diisi.');
        return;
      }
    } else if (entryMode === 'pulang_saja') {
      if (!jamPulang) {
        setError('Untuk mode "Absen Pulang Saja", Jam Pulang wajib diisi.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const finalJamMasuk = (entryMode === 'keduanya' || entryMode === 'masuk_saja') && jamMasuk
        ? `${jamMasuk}:00`
        : undefined;

      const finalJamPulang = (entryMode === 'keduanya' || entryMode === 'pulang_saja') && jamPulang
        ? `${jamPulang}:00`
        : undefined;

      const res = await api.recordManualAttendance({
        employeeId: selectedEmployeeId,
        tanggal,
        jamMasuk: finalJamMasuk,
        jamPulang: finalJamPulang,
        mode: entryMode,
        status: status === 'Otomatis' ? undefined : status,
        metodeKerja,
        catatan: catatan.trim() || `Ditambahkan manual (${entryMode === 'masuk_saja' ? 'Absen Masuk Saja' : entryMode === 'pulang_saja' ? 'Absen Pulang Saja' : 'Keduanya (Masuk & Pulang)'}) oleh Admin`
      });

      setSuccessMessage(res.message || 'Presensi manual berhasil dicatat.');
      if (onSuccess) {
        onSuccess();
      }
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan absensi manual pegawai.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-xl overflow-hidden my-6 animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-linear-to-r from-teal-800 to-emerald-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <PlusCircle className="w-4 h-4 text-teal-200" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Input Presensi Manual Pegawai</h3>
              <p className="text-[11px] text-teal-200">
                Bisa input absen masuk saja, absen pulang saja, atau keduanya sekaligus
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* 1. Pilih Pegawai */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Pilih Pegawai <span className="text-red-500">*</span>
            </label>

            {/* Quick Search */}
            <div className="relative mb-1.5">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama atau NIP pegawai..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <select
              value={selectedEmployeeId}
              onChange={e => setSelectedEmployeeId(e.target.value)}
              required
              disabled={isLoadingEmployees}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-600 cursor-pointer font-medium text-slate-800"
            >
              <option value="" disabled>
                -- Pilih Pegawai ({filteredEmployees.length} ditemukan) --
              </option>
              {filteredEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.nama_lengkap} - NIP: {emp.nip_nik || '-'} ({emp.jabatan || 'Pegawai'})
                </option>
              ))}
            </select>

            {selectedEmp && (
              <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-teal-700" />
                  <span className="font-bold text-slate-900">{selectedEmp.nama_lengkap}</span>
                </div>
                <span className="text-slate-500">{selectedEmp.sub_bagian || selectedEmp.unit_kerja || 'Sekretariat KPU'}</span>
              </div>
            )}
          </div>

          {/* 2. Tanggal Presensi & Metode Kerja */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Tanggal Presensi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="date"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-600 text-slate-800 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Metode Kerja
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['WFO', 'WFH', 'DL'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetodeKerja(m)}
                    className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer text-center ${
                      metodeKerja === m
                        ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Existing Attendance Status Banner (Jika sudah ada data) */}
          {isCheckingExisting ? (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 animate-pulse">
              Memeriksa catatan presensi pada tanggal {tanggal}...
            </div>
          ) : existingRecord ? (
            <div className="p-3 bg-teal-50 border border-teal-200/90 rounded-2xl text-xs space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-teal-950 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-teal-700" />
                  Presensi Terdata Pada Tanggal Ini
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-200 text-teal-950 font-extrabold">
                  {existingRecord.status || 'Hadir'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                <div className="bg-white/90 p-2 rounded-xl border border-teal-100 shadow-2xs">
                  <span className="text-slate-500 font-sans block text-[10px]">Presensi Masuk:</span>
                  <span className="font-bold text-slate-900">
                    {existingRecord.jam_masuk ? `${existingRecord.jam_masuk.substring(0, 5)} WIB` : '(Belum Ada)'}
                  </span>
                </div>
                <div className="bg-white/90 p-2 rounded-xl border border-teal-100 shadow-2xs">
                  <span className="text-slate-500 font-sans block text-[10px]">Presensi Pulang:</span>
                  <span className="font-bold text-slate-900">
                    {existingRecord.jam_pulang ? `${existingRecord.jam_pulang.substring(0, 5)} WIB` : '(Belum Ada)'}
                  </span>
                </div>
              </div>
              {entryMode === 'pulang_saja' && existingRecord.jam_masuk && (
                <p className="text-[10.5px] text-teal-900 font-medium pt-0.5">
                  💡 Jam masuk ({existingRecord.jam_masuk.substring(0, 5)} WIB) akan tetap dipertahankan. Anda hanya menambahkan / memperbarui jam pulang.
                </p>
              )}
              {entryMode === 'masuk_saja' && existingRecord.jam_pulang && (
                <p className="text-[10.5px] text-teal-900 font-medium pt-0.5">
                  💡 Jam pulang ({existingRecord.jam_pulang.substring(0, 5)} WIB) akan tetap dipertahankan. Anda hanya memperbarui jam masuk.
                </p>
              )}
            </div>
          ) : null}

          {/* 3. Pilihan Mode Presensi: Keduanya vs Masuk Saja vs Pulang Saja */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Pilihan Mode Input Presensi <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                id="btn-mode-keduanya"
                onClick={() => setEntryMode('keduanya')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer text-center ${
                  entryMode === 'keduanya'
                    ? 'bg-gradient-to-r from-teal-800 to-emerald-800 text-white border-teal-800 shadow-sm font-bold ring-2 ring-teal-600/30'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CheckCheck className={`w-4 h-4 ${entryMode === 'keduanya' ? 'text-teal-200' : 'text-teal-700'}`} />
                <span className="text-xs leading-tight">Keduanya</span>
                <span className={`text-[9.5px] ${entryMode === 'keduanya' ? 'text-teal-200' : 'text-slate-500'}`}>
                  (Masuk & Pulang)
                </span>
              </button>

              <button
                type="button"
                id="btn-mode-masuk-saja"
                onClick={() => setEntryMode('masuk_saja')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer text-center ${
                  entryMode === 'masuk_saja'
                    ? 'bg-gradient-to-r from-emerald-700 to-teal-800 text-white border-emerald-700 shadow-sm font-bold ring-2 ring-emerald-600/30'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <LogIn className={`w-4 h-4 ${entryMode === 'masuk_saja' ? 'text-emerald-200' : 'text-emerald-600'}`} />
                <span className="text-xs leading-tight">Masuk Saja</span>
                <span className={`text-[9.5px] ${entryMode === 'masuk_saja' ? 'text-emerald-200' : 'text-slate-500'}`}>
                  (Hanya Absen Pagi)
                </span>
              </button>

              <button
                type="button"
                id="btn-mode-pulang-saja"
                onClick={() => setEntryMode('pulang_saja')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer text-center ${
                  entryMode === 'pulang_saja'
                    ? 'bg-gradient-to-r from-sky-700 to-teal-800 text-white border-sky-700 shadow-sm font-bold ring-2 ring-sky-600/30'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <LogOut className={`w-4 h-4 ${entryMode === 'pulang_saja' ? 'text-sky-200' : 'text-sky-600'}`} />
                <span className="text-xs leading-tight">Pulang Saja</span>
                <span className={`text-[9.5px] ${entryMode === 'pulang_saja' ? 'text-sky-200' : 'text-slate-500'}`}>
                  (Hanya Absen Sore)
                </span>
              </button>
            </div>
          </div>

          {/* 4. Form Input Waktu Sesuai Mode Terpilih */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90">
            {/* Box Jam Masuk */}
            <div className={`space-y-1.5 p-2.5 rounded-xl border transition ${
              entryMode === 'pulang_saja'
                ? 'bg-slate-100/70 border-slate-200 opacity-60'
                : 'bg-white border-emerald-200/90 shadow-2xs'
            }`}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  Jam Masuk (WIB)
                  {entryMode !== 'pulang_saja' && <span className="text-red-500">*</span>}
                </label>
                {entryMode !== 'pulang_saja' ? (
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setJamMasuk('07:15')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-mono transition"
                    >
                      07:15
                    </button>
                    <button
                      type="button"
                      onClick={() => setJamMasuk('07:30')}
                      className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-mono transition"
                    >
                      07:30
                    </button>
                    <button
                      type="button"
                      onClick={() => setJamMasuk('07:45')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 font-mono transition"
                    >
                      07:45
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">Nonaktif</span>
                )}
              </div>

              {entryMode === 'pulang_saja' ? (
                <div className="py-2 px-3 bg-slate-200/60 rounded-xl text-slate-500 font-mono text-xs flex items-center justify-between">
                  <span>
                    {existingRecord?.jam_masuk
                      ? `Tetap: ${existingRecord.jam_masuk.substring(0, 5)} WIB`
                      : '(Kosong / Tanpa Masuk)'}
                  </span>
                  <span className="text-[10px] font-sans italic text-slate-400">Tidak diubah</span>
                </div>
              ) : (
                <input
                  type="time"
                  value={jamMasuk}
                  onChange={e => setJamMasuk(e.target.value)}
                  required={entryMode !== 'pulang_saja'}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono font-bold text-slate-900"
                />
              )}
              <span className="text-[10px] text-slate-500 block">Jadwal normal: 07:30 WIB</span>
            </div>

            {/* Box Jam Pulang */}
            <div className={`space-y-1.5 p-2.5 rounded-xl border transition ${
              entryMode === 'masuk_saja'
                ? 'bg-slate-100/70 border-slate-200 opacity-60'
                : 'bg-white border-sky-200/90 shadow-2xs'
            }`}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  Jam Pulang (WIB)
                  {entryMode !== 'masuk_saja' && <span className="text-red-500">*</span>}
                </label>
                {entryMode !== 'masuk_saja' ? (
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setJamPulang('16:00')}
                      className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-bold font-mono transition"
                    >
                      16:00
                    </button>
                    <button
                      type="button"
                      onClick={() => setJamPulang('16:30')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-800 font-mono transition"
                    >
                      16:30
                    </button>
                    <button
                      type="button"
                      onClick={() => setJamPulang('17:00')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-800 font-mono transition"
                    >
                      17:00
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">Nonaktif</span>
                )}
              </div>

              {entryMode === 'masuk_saja' ? (
                <div className="py-2 px-3 bg-slate-200/60 rounded-xl text-slate-500 font-mono text-xs flex items-center justify-between">
                  <span>
                    {existingRecord?.jam_pulang
                      ? `Tetap: ${existingRecord.jam_pulang.substring(0, 5)} WIB`
                      : '(Kosong / Belum Pulang)'}
                  </span>
                  <span className="text-[10px] font-sans italic text-slate-400">Tidak diubah</span>
                </div>
              ) : (
                <input
                  type="time"
                  value={jamPulang}
                  onChange={e => setJamPulang(e.target.value)}
                  required={entryMode !== 'masuk_saja'}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-600 font-mono font-bold text-slate-900"
                />
              )}
              <span className="text-[10px] text-slate-500 block">Jadwal normal: 16:00 WIB</span>
            </div>
          </div>

          {/* Info Kalkulasi Keterlambatan Real-time Sesuai Mode */}
          {entryMode === 'masuk_saja' && jamMasuk && (
            <div className={`p-2.5 rounded-xl border text-[11px] flex items-center justify-between ${
              lateMinutes > 0
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}>
              <div className="flex items-center gap-2">
                {lateMinutes > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>
                  {lateMinutes > 0
                    ? `Terlambat ${lateMinutes} menit (Masuk > 07:30 WIB).`
                    : 'Masuk tepat waktu (sebelum / pukul 07:30 WIB). Bebas ganti jam.'}
                </span>
              </div>
              <span className="font-mono font-bold text-[11px]">
                Target Pulang Minimal: {formatMins(requiredOutMins)} WIB
              </span>
            </div>
          )}

          {entryMode === 'pulang_saja' && jamPulang && (
            <div className="p-2.5 rounded-xl border border-sky-200 bg-sky-50/70 text-sky-950 text-[11px] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-sky-700 shrink-0" />
                <span>
                  {existingRecord?.jam_masuk
                    ? `Melengkapi jam pulang untuk kedatangan pukul ${existingRecord.jam_masuk.substring(0, 5)} WIB.`
                    : 'Mencatat presensi pulang tanpa jam presensi masuk pagi.'}
                </span>
              </div>
              <span className="font-mono font-bold text-[11px]">
                Pulang: {jamPulang} WIB
              </span>
            </div>
          )}

          {entryMode === 'keduanya' && jamMasuk && jamPulang && (
            <div className={`p-2.5 rounded-xl border text-[11px] flex items-center justify-between ${
              lateMinutes > 0 && outMins !== null && outMins < requiredOutMins
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : lateMinutes > 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}>
              <div className="flex items-center gap-2">
                {lateMinutes > 0 && outMins !== null && outMins < requiredOutMins ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>
                  {lateMinutes > 0
                    ? outMins !== null && outMins >= requiredOutMins
                      ? `Terlambat ${lateMinutes} mnt, kewajiban ganti jam dipenuhi (${jamPulang} >= ${formatMins(requiredOutMins)} WIB).`
                      : `Terlambat ${lateMinutes} mnt, pulang sebelum target ${formatMins(requiredOutMins)} WIB (Potong Tukin).`
                    : `Hadir tepat waktu (${jamMasuk} s/d ${jamPulang} WIB). Bebas pemotongan.`}
                </span>
              </div>
              <span className="font-mono font-bold text-[11px]">
                Target: {formatMins(requiredOutMins)} WIB
              </span>
            </div>
          )}

          {/* 5. Status Presensi & Alasan / Catatan */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Status Presensi
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-600 font-medium text-slate-800"
            >
              <option value="Otomatis">Otomatis (Sesuai Jam Masuk/Pulang & Aturan KPU)</option>
              <option value="Hadir">Hadir</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Izin">Izin</option>
              <option value="Cuti">Cuti</option>
              <option value="Dinas Luar">Dinas Luar (DL)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Catatan / Keterangan Admin <span className="text-red-500">*</span>
            </label>
            <textarea
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              placeholder="Jelaskan alasan penambahan manual (misal: Pegawai hadir di kantor namun lupa klik absen di HP karena langsung tugas luar)..."
              rows={2}
              required
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-600 text-slate-800"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>
                Mode aktif:{' '}
                <strong>
                  {entryMode === 'keduanya'
                    ? 'Masuk & Pulang'
                    : entryMode === 'masuk_saja'
                    ? 'Absen Masuk Saja'
                    : 'Absen Pulang Saja'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-gradient-to-r from-teal-800 to-emerald-800 hover:from-teal-900 hover:to-emerald-900 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-teal-200" />
                    <span>Simpan Presensi Manual</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
