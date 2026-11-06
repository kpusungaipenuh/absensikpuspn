import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LeaveRequest, LeaveType, Employee } from '../../types';
import {
  Search,
  Filter,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  RefreshCw,
  Eye,
  PlusCircle,
  FileSpreadsheet,
  Printer,
  Trash2,
  Edit,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { ExportButtons } from '../../components/ExportButtons';
import { Modal } from '../../components/Modal';
import { ManualLeaveRecordModal } from '../../components/ManualLeaveRecordModal';
import { ExcelLeaveImportModal } from '../../components/ExcelLeaveImportModal';
import { EditLeaveModal } from '../../components/EditLeaveModal';
import { CutiPrintModal } from '../../components/CutiPrintModal';
import { useSubBagianList } from '../../utils/subBagian';

export const RiwayatPengajuanCuti: React.FC = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals for historical data
  const [showManualModal, setShowManualModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Edit and Delete states
  const [editingReq, setEditingReq] = useState<LeaveRequest | null>(null);
  const [deletingReq, setDeletingReq] = useState<LeaveRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const subBagianList = useSubBagianList();
  const [selectedSubBagian, setSelectedSubBagian] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  // Detail modal & Print modal
  const [selectedReq, setSelectedReq] = useState<LeaveRequest | null>(null);
  const [printLeaveReq, setPrintLeaveReq] = useState<LeaveRequest | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqRes, typeRes, empRes] = await Promise.all([
        api.getAdminAllLeaves({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          leaveTypeId: leaveTypeId !== 'ALL' ? leaveTypeId : undefined,
          status: status !== 'ALL' ? status : undefined,
          unit: selectedSubBagian !== 'ALL' ? selectedSubBagian : undefined,
          search: search || undefined
        }),
        api.getLeaveTypes(),
        api.getEmployees({ unit: selectedSubBagian !== 'ALL' ? selectedSubBagian : undefined })
      ]);
      setRequests(reqRes.requests || []);
      setLeaveTypes(typeRes.types || []);
      setEmployees(empRes.employees || []);
    } catch (e) {
      console.error('Error fetching all leaves:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, leaveTypeId, status, selectedSubBagian]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleDeleteLeave = async () => {
    if (!deletingReq) return;
    try {
      setIsDeleting(true);
      await api.deleteLeave(deletingReq.id);
      setActionNotice({
        type: 'success',
        text: `Pengajuan cuti no. ${deletingReq.nomor_pengajuan} milik ${deletingReq.nama_lengkap} berhasil dihapus.`
      });
      setDeletingReq(null);
      if (selectedReq?.id === deletingReq.id) {
        setSelectedReq(null);
      }
      fetchData();
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: err.message || 'Gagal menghapus riwayat cuti.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllLeaves = async () => {
    try {
      setIsClearingAll(true);
      await api.clearAllLeaves();
      setActionNotice({
        type: 'success',
        text: 'Seluruh riwayat cuti berhasil dikosongkan dan saldo cuti tahunan semua pegawai telah direset.'
      });
      setShowClearAllConfirm(false);
      setSelectedReq(null);
      fetchData();
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: err.message || 'Gagal mengosongkan riwayat cuti.'
      });
    } finally {
      setIsClearingAll(false);
    }
  };

  const exportColumns = [
    { header: 'No Pengajuan', key: 'nomor_pengajuan' },
    { header: 'Nama Pegawai', key: 'nama_lengkap' },
    { header: 'NIP/NIK', key: 'nip_nik' },
    { header: 'Unit Kerja', key: 'unit_kerja' },
    { header: 'Jenis Cuti', key: 'leave_type_name' },
    { header: 'Mulai', key: 'tanggal_mulai' },
    { header: 'Selesai', key: 'tanggal_selesai' },
    { header: 'Jumlah Hari', key: 'jumlah_hari' },
    { header: 'Status', key: 'status' },
    { header: 'Alasan', key: 'alasan' },
    { header: 'Approver', key: 'approver_username' }
  ];

  return (
    <div className="space-y-6">
      {/* Action Notice Alert */}
      {actionNotice && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between shadow-xs transition-all ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{actionNotice.text}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-slate-400 hover:text-slate-700 text-xs p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Riwayat Seluruh Pengajuan Cuti Pegawai
          </h2>
          <p className="text-xs text-slate-500">
            Monitoring rekam jejak, histori, dan status verifikasi cuti di KPU Kota Sungai Penuh
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Catat Cuti Lampau</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Excel Cuti</span>
          </button>

          <button
            onClick={() => setShowClearAllConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
            title="Kosongkan seluruh data riwayat cuti dan kembalikan saldo cuti tahunan pegawai"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Kosongkan Riwayat</span>
          </button>

          <ExportButtons
            title="RIWAYAT PENGAJUAN CUTI PEGAWAI KPU KOTA SUNGAI PENUH"
            filename="Riwayat_Cuti_KPU_SungaiPenuh"
            columns={exportColumns}
            data={requests}
          />
          <button
            onClick={fetchData}
            className="p-2 text-slate-600 hover:text-red-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Muat ulang"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cari Pegawai / No Pengajuan</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Nama / NIP / No Cuti..."
                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>

          {/* Sub Bagian */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sub Bagian</label>
            <select
              value={selectedSubBagian}
              onChange={e => setSelectedSubBagian(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            >
              <option value="ALL">Semua Sub Bagian</option>
              {subBagianList.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Tanggal Mulai */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tanggal Mulai Dari</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            />
          </div>

          {/* Tanggal Selesai */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            />
          </div>

          {/* Jenis Cuti */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jenis Cuti</label>
            <select
              value={leaveTypeId}
              onChange={e => setLeaveTypeId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            >
              <option value="ALL">Semua Jenis Cuti</option>
              {leaveTypes.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nama} ({t.kode})
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status Pengajuan</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            >
              <option value="ALL">Semua Status</option>
              <option value="Menunggu Approval">Menunggu Approval</option>
              <option value="Disetujui">Disetujui</option>
              <option value="Ditolak">Ditolak</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </select>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">No. Pengajuan</th>
                <th className="px-4 py-3 font-semibold">Nama Pegawai</th>
                <th className="px-4 py-3 font-semibold">Jenis Cuti</th>
                <th className="px-4 py-3 font-semibold">Periode</th>
                <th className="px-4 py-3 font-semibold">Durasi</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Approver / Catatan</th>
                <th className="px-4 py-3 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Memuat riwayat pengajuan cuti...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Tidak ditemukan catatan pengajuan cuti pada kriteria ini.
                  </td>
                </tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-slate-700">
                      {req.nomor_pengajuan}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{req.nama_lengkap}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{req.nip_nik}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{req.leave_type_name}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{req.tanggal_mulai}</div>
                      <div className="text-[11px] text-slate-400">s/d {req.tanggal_selesai}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {req.jumlah_hari} Hari Kerja
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          req.status === 'Disetujui'
                            ? 'bg-emerald-100 text-emerald-800'
                            : req.status === 'Menunggu Approval'
                            ? 'bg-amber-100 text-amber-800'
                            : req.status === 'Ditolak'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {req.status === 'Disetujui' && <CheckCircle2 className="w-3 h-3" />}
                        {req.status === 'Menunggu Approval' && <Clock className="w-3 h-3" />}
                        {req.status === 'Ditolak' && <XCircle className="w-3 h-3" />}
                        {req.status === 'Dibatalkan' && <Ban className="w-3 h-3" />}
                        <span>{req.status}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs">
                      {req.approver_username && (
                        <div className="text-[11px] font-medium text-slate-700">
                          Oleh: {req.approver_username}
                        </div>
                      )}
                      {req.catatan_admin && (
                        <div className="text-[10px] text-slate-500 truncate" title={req.catatan_admin}>
                          Catatan: {req.catatan_admin}
                        </div>
                      )}
                      {!req.approver_username && !req.catatan_admin && '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setPrintLeaveReq(req)}
                          className="p-1.5 text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Cetak Formulir Cuti & Surat Permohonan Resmi"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedReq(req)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Lihat Detail Lengkap"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingReq(req)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Data Riwayat Cuti"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingReq(req)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Riwayat Cuti"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedReq && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReq(null)}
          title={`Detail Pengajuan Cuti: ${selectedReq.nomor_pengajuan}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nama Pegawai</span>
                <span className="font-bold text-slate-800">{selectedReq.nama_lengkap}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">NIP / NIK</span>
                <span className="font-mono text-slate-700">{selectedReq.nip_nik}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Unit Kerja</span>
                <span className="text-slate-700">{selectedReq.unit_kerja}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Jabatan</span>
                <span className="text-slate-700">{selectedReq.jabatan}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Jenis Cuti:</span>
                <span className="font-semibold text-slate-800">{selectedReq.leave_type_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Periode Cuti:</span>
                <span className="font-semibold text-slate-800">
                  {selectedReq.tanggal_mulai} s/d {selectedReq.tanggal_selesai}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Jumlah Hari Kerja:</span>
                <span className="font-bold text-red-700">{selectedReq.jumlah_hari} Hari Kerja</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Tanggal Pengajuan:</span>
                <span className="text-slate-700">{selectedReq.tanggal_pengajuan}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Status Saat Ini:</span>
                <span className="font-semibold">{selectedReq.status}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block font-semibold mb-1">Alasan Permohonan:</span>
              <div className="p-3 bg-slate-100 rounded-xl text-slate-700 leading-relaxed">
                {selectedReq.alasan}
              </div>
            </div>

            {selectedReq.lampiran_url && (
              <div>
                <span className="text-slate-500 block font-semibold mb-1">Lampiran Dokumen:</span>
                <a
                  href={selectedReq.lampiran_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 underline"
                >
                  <FileText className="w-4 h-4" />
                  <span>Buka Lampiran Surat/Dokumen Pendukung</span>
                </a>
              </div>
            )}

            {selectedReq.catatan_admin && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="font-bold text-amber-800 block mb-0.5">Catatan Verifikator / Admin:</span>
                <p className="text-amber-900">{selectedReq.catatan_admin}</p>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedReq;
                    setSelectedReq(null);
                    setPrintLeaveReq(target);
                  }}
                  className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs text-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Dokumen</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedReq;
                    setSelectedReq(null);
                    setEditingReq(target);
                  }}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedReq;
                    setSelectedReq(null);
                    setDeletingReq(target);
                  }}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-semibold flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReq(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL CETAK FORMULIR CUTI & SURAT PERMOHONAN */}
      {printLeaveReq && (
        <CutiPrintModal
          isOpen={!!printLeaveReq}
          onClose={() => setPrintLeaveReq(null)}
          request={printLeaveReq}
          allEmployees={employees}
        />
      )}

      {/* Manual Leave Record Modal */}
      <ManualLeaveRecordModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSuccess={() => {
          fetchData();
        }}
        employees={employees}
        leaveTypes={leaveTypes}
      />

      {/* Bulk Excel Leave Import Modal */}
      <ExcelLeaveImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          fetchData();
        }}
        employees={employees}
        leaveTypes={leaveTypes}
      />

      {/* Edit Leave Modal */}
      <EditLeaveModal
        isOpen={!!editingReq}
        leaveRequest={editingReq}
        leaveTypes={leaveTypes}
        onClose={() => setEditingReq(null)}
        onSuccess={() => {
          setActionNotice({
            type: 'success',
            text: 'Data riwayat cuti pegawai berhasil diperbarui.'
          });
          fetchData();
        }}
      />

      {/* Single Delete Confirmation Modal */}
      {deletingReq && (
        <Modal
          isOpen={true}
          onClose={() => !isDeleting && setDeletingReq(null)}
          title="Konfirmasi Hapus Riwayat Cuti"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-1">Hapus Riwayat Pengajuan Cuti?</span>
                <p>
                  Apakah Anda yakin ingin menghapus data pengajuan cuti ini? Jika ini cuti tahunan yang disetujui, saldo cuti tahunan pegawai akan otomatis dikembalikan.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">No. Pengajuan:</span>
                <span className="font-mono font-bold text-slate-800">{deletingReq.nomor_pengajuan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Pegawai:</span>
                <span className="font-semibold text-slate-900">{deletingReq.nama_lengkap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jenis Cuti:</span>
                <span className="text-slate-800">{deletingReq.leave_type_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Periode & Durasi:</span>
                <span className="font-semibold text-slate-800">
                  {deletingReq.tanggal_mulai} s/d {deletingReq.tanggal_selesai} ({deletingReq.jumlah_hari} Hari)
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingReq(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteLeave}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Data'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearAllConfirm && (
        <Modal
          isOpen={true}
          onClose={() => !isClearingAll && setShowClearAllConfirm(false)}
          title="Kosongkan Semua Riwayat Pengajuan Cuti"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-900 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block mb-1">PERINGATAN KERAS</span>
                <p className="leading-relaxed">
                  Tindakan ini akan <strong>menghapus seluruh riwayat permohonan dan catatan cuti</strong> dari sistem.
                  Semua saldo cuti tahunan pegawai akan direset kembali ke saldo penuh (12 hari).
                </p>
                <p className="mt-2 font-bold text-red-700">
                  Tindakan ini tidak dapat dibatalkan (permanen).
                </p>
              </div>
            </div>

            <p className="text-slate-600 text-[11px]">
              Gunakan fitur ini apabila Anda ingin mengatur ulang seluruh riwayat pengajuan cuti dari awal atau setelah terjadi kesalahan import data berulang kali.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isClearingAll}
                onClick={() => setShowClearAllConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isClearingAll}
                onClick={handleClearAllLeaves}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearingAll ? 'Sedang Mengosongkan...' : 'Ya, Kosongkan Semua Riwayat'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
