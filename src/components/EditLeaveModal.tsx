import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { LeaveRequest, LeaveType } from '../types';
import { Modal } from './Modal';
import { Edit, Save, AlertCircle, Info, Calendar } from 'lucide-react';

interface EditLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leaveRequest: LeaveRequest | null;
  leaveTypes: LeaveType[];
}

export const EditLeaveModal: React.FC<EditLeaveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  leaveRequest,
  leaveTypes
}) => {
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [nomorPengajuan, setNomorPengajuan] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [days, setDays] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('Disetujui');
  const [catatanAdmin, setCatatanAdmin] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (leaveRequest) {
      setLeaveTypeId(leaveRequest.leave_type_id || '');
      setNomorPengajuan(leaveRequest.nomor_pengajuan || '');
      setStartDate(leaveRequest.tanggal_mulai || '');
      setEndDate(leaveRequest.tanggal_selesai || '');
      setDays(leaveRequest.jumlah_hari || 1);
      setReason(leaveRequest.alasan || '');
      setStatus(leaveRequest.status || 'Disetujui');
      setCatatanAdmin(leaveRequest.catatan_admin || '');
      setErrorMessage(null);
    }
  }, [leaveRequest]);

  // Recalculate days when dates change
  const handleDateChange = async (newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);
    if (newStart && newEnd) {
      if (newStart > newEnd) {
        setErrorMessage('Tanggal mulai tidak boleh lebih besar dari tanggal selesai.');
        return;
      }
      setErrorMessage(null);
      try {
        const res = await api.calculateLeaveDays(newStart, newEnd);
        if (res?.days) setDays(res.days);
      } catch {
        const diff = Math.abs(new Date(newEnd).getTime() - new Date(newStart).getTime());
        setDays(Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
      }
    }
  };

  if (!isOpen || !leaveRequest) return null;

  const selectedType = leaveTypes.find(t => t.id === leaveTypeId);
  const isCutiTahunan = selectedType?.id === 'lt_ct' || selectedType?.kode === 'CT';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setErrorMessage('Tanggal mulai dan selesai wajib diisi.');
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('Alasan cuti wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await api.updateLeave(leaveRequest.id, {
        leaveTypeId,
        nomorPengajuan: nomorPengajuan.trim() || undefined,
        startDate,
        endDate,
        days: Number(days),
        reason: reason.trim(),
        status,
        catatanAdmin: catatanAdmin.trim() || undefined
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memperbarui data cuti.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Riwayat Pengajuan Cuti"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Info Pegawai */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Pegawai</span>
            <span className="font-bold text-slate-900 text-sm">{leaveRequest.nama_lengkap}</span>
            <span className="text-slate-500 text-[11px] block">NIP: {leaveRequest.nip_nik}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Unit Kerja</span>
            <span className="font-medium text-slate-700">{leaveRequest.unit_kerja || '-'}</span>
          </div>
        </div>

        {/* Jenis Cuti & No Pengajuan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Jenis Cuti <span className="text-red-500">*</span>
            </label>
            <select
              value={leaveTypeId}
              onChange={e => setLeaveTypeId(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            >
              {leaveTypes.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nama} ({t.kode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nomor Surat / Pengajuan
            </label>
            <input
              type="text"
              value={nomorPengajuan}
              onChange={e => setNomorPengajuan(e.target.value)}
              placeholder="Contoh: 800.1.11.1/01/KPU-SP/2024"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Tanggal Mulai, Tanggal Selesai, Jumlah Hari */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tanggal Mulai <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => handleDateChange(e.target.value, endDate)}
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Tanggal Selesai <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => handleDateChange(startDate, e.target.value)}
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Jumlah Hari Kerja <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Aturan Pemotongan Saldo Banner */}
        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-900">
            {isCutiTahunan ? (
              <span>
                Jenis cuti ini adalah <strong>Cuti Tahunan</strong>. Saldo cuti tahunan pegawai akan dipotong otomatis jika status disetujui.
              </span>
            ) : (
              <span>
                Jenis cuti ini (<strong>{selectedType?.nama}</strong>) <strong>tidak memotong saldo cuti tahunan</strong> sesuai ketentuan.
              </span>
            )}
          </div>
        </div>

        {/* Status Pengajuan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Status Pengajuan <span className="text-red-500">*</span>
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            >
              <option value="Disetujui">Disetujui</option>
              <option value="Menunggu Approval">Menunggu Approval</option>
              <option value="Ditolak">Ditolak</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Catatan Admin / Verifikator
            </label>
            <input
              type="text"
              value={catatanAdmin}
              onChange={e => setCatatanAdmin(e.target.value)}
              placeholder="Catatan penyesuaian data..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Alasan Cuti */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Alasan / Keperluan Cuti <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            required
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
          />
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
