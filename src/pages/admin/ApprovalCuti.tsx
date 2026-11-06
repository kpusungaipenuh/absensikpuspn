import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LeaveRequest } from '../../types';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  Calendar,
  User,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Printer
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { CutiPrintModal } from '../../components/CutiPrintModal';

export const ApprovalCuti: React.FC = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState<LeaveRequest | null>(null);
  const [printReq, setPrintReq] = useState<LeaveRequest | null>(null);

  // Approve dialog
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Reject dialog
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminPendingLeaves();
      setRequests(res.requests || []);
    } catch (e) {
      console.error('Error fetching pending leaves:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleOpenApprove = (req: LeaveRequest) => {
    setSelectedReq(req);
    setAdminNotes('');
    setShowApproveModal(true);
  };

  const handleOpenReject = (req: LeaveRequest) => {
    setSelectedReq(req);
    setRejectionReason('');
    setRejectError(null);
    setShowRejectModal(true);
  };

  const executeApprove = async () => {
    if (!selectedReq) return;
    try {
      setIsProcessing(true);
      await api.approveLeave(selectedReq.id, adminNotes);
      setShowApproveModal(false);
      setSelectedReq(null);
      await fetchPending();
      alert('Pengajuan cuti berhasil disetujui! Saldo cuti tahunan pegawai otomatis terpotong secara sekuensial (N-2 -> N-1 -> N).');
    } catch (err: any) {
      alert(err.message || 'Gagal menyetujui cuti.');
    } finally {
      setIsProcessing(false);
    }
  };

  const executeReject = async () => {
    if (!selectedReq) return;
    if (!rejectionReason.trim()) {
      setRejectError('Alasan penolakan wajib diisi agar pegawai mengetahui alasannya.');
      return;
    }

    try {
      setIsProcessing(true);
      await api.rejectLeave(selectedReq.id, rejectionReason.trim());
      setShowRejectModal(false);
      setSelectedReq(null);
      await fetchPending();
      alert('Pengajuan cuti telah ditolak.');
    } catch (err: any) {
      setRejectError(err.message || 'Gagal menolak cuti.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Verifikasi & Approval Pengajuan Cuti
          </h2>
          <p className="text-xs text-slate-500">
            Daftar permohonan cuti pegawai KPU Kota Sungai Penuh yang menunggu verifikasi admin
          </p>
        </div>

        <button
          onClick={fetchPending}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Segarkan Antrean</span>
        </button>
      </div>

      {/* Main Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Antrean Permohonan Cuti
            </span>
          </div>
          <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
            {requests.length} Pengajuan Menunggu
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Memuat permohonan cuti...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
            <h4 className="text-sm font-bold text-slate-800">Semua Pengajuan Telah Diproses</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Tidak ada antrean pengajuan cuti pegawai yang berstatus 'Menunggu Approval' saat ini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map(req => (
              <div
                key={req.id}
                className="p-5 sm:p-6 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Employee info */}
                <div className="flex items-start gap-4">
                  {req.foto_profil ? (
                    <img
                      src={req.foto_profil}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-base shrink-0">
                      {req.nama_lengkap?.charAt(0)}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{req.nama_lengkap}</h4>
                      <span className="text-xs text-slate-400 font-mono">({req.nip_nik})</span>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
                        {req.leave_type_name}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>{req.jabatan}</span>
                      <span>&bull;</span>
                      <span>{req.unit_kerja}</span>
                      <span>&bull;</span>
                      <span className="font-mono text-[11px] text-slate-400">No: {req.nomor_pengajuan}</span>
                    </div>

                    <div className="pt-2 text-xs text-slate-700 flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1 font-semibold text-slate-900">
                        <Calendar className="w-3.5 h-3.5 text-teal-600" />
                        <span>
                          {req.tanggal_mulai} s/d {req.tanggal_selesai}
                        </span>
                        <span className="ml-1 text-slate-500 font-normal">
                          ({req.jumlah_hari} Hari Kerja)
                        </span>
                      </div>

                      {req.lampiran_url && (
                        <a
                          href={req.lampiran_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Lihat Lampiran Dokumen</span>
                        </a>
                      )}
                    </div>

                    <div className="pt-1.5 text-xs text-slate-600 bg-slate-100/60 p-2.5 rounded-lg border border-slate-200/60">
                      <span className="font-semibold text-slate-700">Alasan: </span>
                      {req.alasan}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                  <button
                    id={`btn-print-${req.id}`}
                    onClick={() => setPrintReq(req)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                    title="Cetak Surat Permohonan Cuti Resmi"
                  >
                    <Printer className="w-4 h-4 text-teal-700" />
                    <span>Cetak Surat</span>
                  </button>

                  <button
                    id={`btn-reject-${req.id}`}
                    onClick={() => handleOpenReject(req)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Tolak</span>
                  </button>

                  <button
                    id={`btn-approve-${req.id}`}
                    onClick={() => handleOpenApprove(req)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Setujui</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL APPROVE */}
      {showApproveModal && selectedReq && (
        <Modal
          isOpen={true}
          onClose={() => setShowApproveModal(false)}
          title="Konfirmasi Persetujuan Cuti"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Validasi Pengurangan Saldo Otomatis</span>
              </div>
              <p>
                Menyetujui cuti <strong>{selectedReq.nama_lengkap}</strong> selama{' '}
                <strong>{selectedReq.jumlah_hari} Hari Kerja</strong> ({selectedReq.leave_type_name}).
              </p>
              {selectedReq.uses_balance === 1 && (
                <p className="text-[11px] text-emerald-700 font-medium pt-1">
                  Aturan: Saldo dipotong berurutan dari <strong>N-2</strong>, lalu{' '}
                  <strong>N-1</strong>, kemudian <strong>N</strong>.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Admin (Opsional):
              </label>
              <textarea
                rows={3}
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                placeholder="Misal: Disetujui, koordinasikan tugas dengan rekan kerja pengganti..."
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-approve"
                type="button"
                disabled={isProcessing}
                onClick={executeApprove}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'Memproses...' : 'Ya, Setujui Cuti'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL REJECT */}
      {showRejectModal && selectedReq && (
        <Modal
          isOpen={true}
          onClose={() => setShowRejectModal(false)}
          title="Tolak Pengajuan Cuti"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800">
              Anda akan menolak pengajuan cuti <strong>{selectedReq.nama_lengkap}</strong>. Saldo
              cuti pegawai tidak akan terpotong.
            </div>

            {rejectError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-xl text-xs font-medium">
                {rejectError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Alasan Penolakan <span className="text-rose-600">*</span> (Wajib diisi):
              </label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Jelaskan alasan penolakan, misal: Agenda pleno KPU darurat, pekerjaan mendesak..."
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-600 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-reject"
                type="button"
                disabled={isProcessing}
                onClick={executeReject}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'Memproses...' : 'Tolak Pengajuan'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL CETAK FORMULIR CUTI */}
      {printReq && (
        <CutiPrintModal
          isOpen={!!printReq}
          onClose={() => setPrintReq(null)}
          request={printReq}
        />
      )}
    </div>
  );
};
