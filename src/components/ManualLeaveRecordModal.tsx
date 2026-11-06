import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Employee, LeaveType } from '../types';
import {
  Calendar,
  UserCheck,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
  Search,
  ShieldCheck,
  Info
} from 'lucide-react';

interface ManualLeaveRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employees: Employee[];
  leaveTypes: LeaveType[];
}

export const ManualLeaveRecordModal: React.FC<ManualLeaveRecordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  employees,
  leaveTypes
}) => {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [nomorPengajuan, setNomorPengajuan] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState<number>(1);
  const [isAutoCalculatingDays, setIsAutoCalculatingDays] = useState(false);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('Disetujui');
  const [tanggalPengajuan, setTanggalPengajuan] = useState('');
  const [tanggalApproval, setTanggalApproval] = useState('');
  const [potongSaldo, setPotongSaldo] = useState(false);
  const [catatanAdmin, setCatatanAdmin] = useState('Pencatatan riwayat cuti lampau manual');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set initial leave type
  useEffect(() => {
    if (leaveTypes.length > 0 && !leaveTypeId) {
      const defaultType = leaveTypes.find(t => t.id === 'lt_ct' || t.kode === 'CT') || leaveTypes[0];
      setLeaveTypeId(defaultType.id);
    }
  }, [leaveTypes, leaveTypeId]);

  // Recalculate days when start or end date changes
  useEffect(() => {
    if (startDate && endDate) {
      if (startDate > endDate) {
        setErrorMessage('Tanggal mulai tidak boleh lebih lambat dari tanggal selesai.');
        return;
      }
      setErrorMessage(null);
      setIsAutoCalculatingDays(true);
      api.calculateLeaveDays(startDate, endDate)
        .then(res => {
          setDays(res.days || 1);
        })
        .catch(() => {
          // fallback rough day count
          const diffTime = Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          setDays(diffDays);
        })
        .finally(() => {
          setIsAutoCalculatingDays(false);
        });

      if (!tanggalPengajuan) setTanggalPengajuan(startDate);
      if (!tanggalApproval) setTanggalApproval(startDate);
    }
  }, [startDate, endDate]);

  if (!isOpen) return null;

  const filteredEmployees = employees.filter(emp => {
    const q = employeeSearch.toLowerCase();
    return (
      emp.nama_lengkap.toLowerCase().includes(q) ||
      emp.nip_nik.toLowerCase().includes(q) ||
      emp.jabatan.toLowerCase().includes(q)
    );
  });

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
  const selectedLeaveType = leaveTypes.find(t => t.id === leaveTypeId);
  const isCutiTahunan = selectedLeaveType?.id === 'lt_ct' || selectedLeaveType?.kode === 'CT';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedEmployeeId) {
      setErrorMessage('Silakan pilih pegawai terlebih dahulu.');
      return;
    }
    if (!leaveTypeId) {
      setErrorMessage('Silakan pilih jenis cuti.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMessage('Tanggal mulai dan selesai cuti wajib diisi.');
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('Alasan atau keterangan cuti wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.recordManualLeave({
        employeeId: selectedEmployeeId,
        leaveTypeId,
        nomorPengajuan: nomorPengajuan.trim() || undefined,
        startDate,
        endDate,
        days: Number(days),
        reason: reason.trim(),
        status,
        tanggalPengajuan: tanggalPengajuan || startDate,
        tanggalApproval: tanggalApproval || startDate,
        potongSaldo: isCutiTahunan ? potongSaldo : false,
        catatanAdmin: catatanAdmin.trim() || undefined
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan riwayat cuti.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 rounded-xl text-white">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Catat Riwayat Cuti Masa Lalu</h3>
              <p className="text-xs text-slate-300">
                Pencatatan langsung histori cuti yang sudah pernah diambil sebelumnya
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Pegawai Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Pilih Pegawai <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik nama / NIP untuk cari..."
                  value={employeeSearch}
                  onChange={e => setEmployeeSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              </div>
              <select
                value={selectedEmployeeId}
                onChange={e => setSelectedEmployeeId(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              >
                <option value="">-- Pilih Pegawai ({filteredEmployees.length}) --</option>
                {filteredEmployees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nama_lengkap} (NIP: {emp.nip_nik})
                  </option>
                ))}
              </select>
            </div>
            {selectedEmployee && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center gap-3">
                <img
                  src={
                    selectedEmployee.foto_profil ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                  }
                  alt={selectedEmployee.nama_lengkap}
                  className="w-8 h-8 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <span className="font-bold text-slate-800">{selectedEmployee.nama_lengkap}</span>
                  <span className="text-slate-500 ml-2">
                    &bull; {selectedEmployee.jabatan} ({selectedEmployee.unit_kerja})
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Jenis Cuti */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Jenis Cuti <span className="text-red-500">*</span>
              </label>
              <select
                value={leaveTypeId}
                onChange={e => setLeaveTypeId(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              >
                {leaveTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.nama} ({type.kode})
                  </option>
                ))}
              </select>
            </div>

            {/* Nomor Surat / Pengajuan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nomor Surat / SK Cuti (Opsional)
              </label>
              <input
                type="text"
                value={nomorPengajuan}
                onChange={e => setNomorPengajuan(e.target.value)}
                placeholder="Contoh: 800.1.11.1/05/KPU-SP/2024"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Dates & Days */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Tanggal Mulai <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Tanggal Selesai <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
                className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Jumlah Hari {isAutoCalculatingDays && '(menghitung...)'}
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={e => setDays(Number(e.target.value))}
                required
                className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white font-bold text-slate-900 focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Alasan / Keperluan Cuti <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Contoh: Menghadiri acara pernikahan keluarga di luar kota / Cuti tahunan lampau"
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Status Catatan
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              >
                <option value="Disetujui">Disetujui (Resmi)</option>
                <option value="Menunggu Approval">Menunggu Approval</option>
                <option value="Ditolak">Ditolak</option>
                <option value="Dibatalkan">Dibatalkan</option>
              </select>
            </div>

            {/* Tanggal Pengajuan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Tgl Pengajuan Surat
              </label>
              <input
                type="date"
                value={tanggalPengajuan}
                onChange={e => setTanggalPengajuan(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>

            {/* Tanggal Approval */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Tgl Persetujuan
              </label>
              <input
                type="date"
                value={tanggalApproval}
                onChange={e => setTanggalApproval(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Potong Saldo Checkbox */}
          {isCutiTahunan ? (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={potongSaldo}
                  onChange={e => setPotongSaldo(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-amber-900 block">
                    Kurangi Saldo Cuti Pegawai Saat Ini?
                  </span>
                  <span className="text-slate-600 text-[11px] leading-relaxed">
                    Khusus Cuti Tahunan: Jika <strong>TIDAK dicentang</strong> (rekomendasi untuk riwayat tahun-tahun sebelumnya), data hanya dicatat ke histori tanpa mengurangi saldo berjalan pegawai.
                  </span>
                </div>
              </label>
            </div>
          ) : (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900">
                <span className="font-bold block mb-0.5">Tidak Memotong Saldo Cuti</span>
                <span className="text-[11px] text-blue-700 leading-relaxed">
                  Sesuai ketentuan, hanya jenis <strong>Cuti Tahunan</strong> yang memotong saldo cuti tahunan. Pengajuan <strong>{selectedLeaveType?.nama || 'ini'}</strong> tidak akan mengurangi saldo cuti pegawai.
                </span>
              </div>
            </div>
          )}

          {/* Catatan Admin */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Catatan Petugas / Admin (Opsional)
            </label>
            <input
              type="text"
              value={catatanAdmin}
              onChange={e => setCatatanAdmin(e.target.value)}
              placeholder="Contoh: Migrasi dari aplikasi cuti lama"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan ke Riwayat Cuti</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
