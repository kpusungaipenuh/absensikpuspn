import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { TravelDuty, Employee } from '../../types';
import {
  Briefcase,
  MapPin,
  Calendar,
  Plus,
  Search,
  Filter,
  Users,
  FileText,
  Building2,
  Trash2,
  Edit2,
  Eye,
  Printer,
  CheckCircle2,
  Clock,
  Car,
  Plane,
  X,
  AlertTriangle
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { TravelDutyPrintModal } from '../../components/TravelDutyPrintModal';

export const PerjalananDinasPage: React.FC = () => {
  const currentYear = new Date().getFullYear().toString();
  const [duties, setDuties] = useState<TravelDuty[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterJenis, setFilterJenis] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>(currentYear);
  const [searchTerm, setSearchTerm] = useState('');

  // Notifikasi
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // State Delete Confirmation Modal
  const [dutyToDelete, setDutyToDelete] = useState<TravelDuty | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Create / Edit
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nomor_surat_tugas: '',
    nomor_sppd: '',
    jenis_perjalanan: 'luar_kota' as 'dalam_kota' | 'luar_kota',
    maksud_tujuan: '',
    tempat_berangkat: 'Kota Sungai Penuh',
    tempat_tujuan: '',
    tanggal_berangkat: new Date().toISOString().split('T')[0],
    tanggal_kembali: new Date().toISOString().split('T')[0],
    beban_anggaran: 'DIPA KPU Kota Sungai Penuh T.A. ' + currentYear,
    alat_angkut: 'Kendaraan Dinas / Darat',
    status: 'terjadwal' as 'terjadwal' | 'berjalan' | 'selesai' | 'dibatalkan',
    total_biaya: 0,
    keterangan: '',
    pegawai_ids: [] as { employee_id: string; peran: string }[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal View Detail & Cetak SPPD
  const [viewDetailDuty, setViewDetailDuty] = useState<TravelDuty | null>(null);
  const [printDutyModal, setPrintDutyModal] = useState<TravelDuty | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dutyRes, empRes] = await Promise.all([
        api.getTravelDuties({
          jenis: filterJenis !== 'ALL' ? filterJenis : undefined,
          status: filterStatus !== 'ALL' ? filterStatus : undefined,
          tahun: filterYear
        }),
        api.getEmployees()
      ]);
      setDuties(dutyRes.duties || []);
      setEmployees(empRes.employees || []);
    } catch (err) {
      console.error('Error fetching travel duties:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterJenis, filterStatus, filterYear]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      nomor_surat_tugas: `ST/${Math.floor(Math.random() * 900 + 100)}/KPU-SP/${new Date().getMonth() + 1}/${currentYear}`,
      nomor_sppd: `SPPD/${Math.floor(Math.random() * 900 + 100)}/KPU-SP/${new Date().getMonth() + 1}/${currentYear}`,
      jenis_perjalanan: 'luar_kota',
      maksud_tujuan: '',
      tempat_berangkat: 'Kota Sungai Penuh',
      tempat_tujuan: '',
      tanggal_berangkat: new Date().toISOString().split('T')[0],
      tanggal_kembali: new Date().toISOString().split('T')[0],
      beban_anggaran: 'DIPA KPU Kota Sungai Penuh T.A. ' + currentYear,
      alat_angkut: 'Kendaraan Dinas / Darat',
      status: 'terjadwal',
      total_biaya: 0,
      keterangan: '',
      pegawai_ids: employees.length > 0 ? [{ employee_id: employees[0].id, peran: 'Ketua Tim' }] : []
    });
    setShowFormModal(true);
  };

  const handleOpenEdit = (duty: TravelDuty) => {
    setEditingId(duty.id);
    const assigned = duty.assigned_employees?.map(e => ({
      employee_id: e.id,
      peran: e.peran || 'Anggota'
    })) || [];

    setFormData({
      nomor_surat_tugas: duty.nomor_surat_tugas || '',
      nomor_sppd: duty.nomor_sppd || '',
      jenis_perjalanan: duty.jenis_perjalanan,
      maksud_tujuan: duty.maksud_tujuan,
      tempat_berangkat: duty.tempat_berangkat,
      tempat_tujuan: duty.tempat_tujuan,
      tanggal_berangkat: duty.tanggal_berangkat,
      tanggal_kembali: duty.tanggal_kembali,
      beban_anggaran: duty.beban_anggaran || '',
      alat_angkut: duty.alat_angkut || 'Kendaraan Dinas / Darat',
      status: duty.status,
      total_biaya: duty.total_biaya || 0,
      keterangan: duty.keterangan || '',
      pegawai_ids: assigned.length > 0 ? assigned : (employees.length > 0 ? [{ employee_id: employees[0].id, peran: 'Ketua Tim' }] : [])
    });
    setShowFormModal(true);
  };

  const handleAddEmployeeRow = () => {
    if (employees.length === 0) return;
    setFormData(prev => ({
      ...prev,
      pegawai_ids: [...prev.pegawai_ids, { employee_id: employees[0].id, peran: 'Anggota' }]
    }));
  };

  const handleRemoveEmployeeRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      pegawai_ids: prev.pegawai_ids.filter((_, i) => i !== index)
    }));
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.maksud_tujuan.trim() || !formData.tempat_tujuan.trim()) {
      setNotification({ type: 'error', message: 'Maksud agenda dan tempat tujuan wajib diisi.' });
      return;
    }
    if (formData.pegawai_ids.length === 0) {
      setNotification({ type: 'error', message: 'Silakan tambahkan minimal satu pegawai yang ditugaskan.' });
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingId) {
        await api.updateTravelDuty(editingId, formData);
        setNotification({ type: 'success', message: 'Surat tugas perjalanan dinas berhasil diperbarui.' });
      } else {
        await api.createTravelDuty(formData);
        setNotification({ type: 'success', message: 'Surat tugas perjalanan dinas berhasil dicatat.' });
      }
      setTimeout(() => setNotification(null), 5000);
      setShowFormModal(false);
      await fetchData();
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Gagal menyimpan perjalanan dinas.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (duty: TravelDuty) => {
    setDutyToDelete(duty);
  };

  const handleExecuteDelete = async () => {
    if (!dutyToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteTravelDuty(dutyToDelete.id);
      if (viewDetailDuty?.id === dutyToDelete.id) {
        setViewDetailDuty(null);
      }
      const deletedNumber = dutyToDelete.nomor_surat_tugas;
      setDutyToDelete(null);
      await fetchData();
      setNotification({
        type: 'success',
        message: `Surat Tugas Nomor "${deletedNumber}" berhasil dihapus dari sistem.`
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      console.error('Error deleting travel duty:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Gagal menghapus catatan perjalanan dinas.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDuties = duties.filter(d => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      d.nomor_surat_tugas.toLowerCase().includes(q) ||
      d.maksud_tujuan.toLowerCase().includes(q) ||
      d.tempat_tujuan.toLowerCase().includes(q) ||
      (d.assigned_employees && d.assigned_employees.some(e => e.nama_lengkap.toLowerCase().includes(q)));
    return matchSearch;
  });

  // Calculate statistics
  const countDalamKota = duties.filter(d => d.jenis_perjalanan === 'dalam_kota').length;
  const countLuarKota = duties.filter(d => d.jenis_perjalanan === 'luar_kota').length;

  return (
    <div className="space-y-6">
      {/* Notification Toast/Banner */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 hover:bg-black/5 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-teal-700" />
            <span>KPU Kota Sungai Penuh &bull; Subbagian Umum & Keuangan</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Pencatatan Perjalanan Dinas (SPPD & Surat Tugas)
          </h2>
          <p className="text-xs text-slate-500">
            Kelola data dan administrasi Surat Tugas Perjalanan Dinas Pegawai KPU, baik Perjalanan Dinas Dalam Kota maupun Luar Kota.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            id="btn-tambah-perjalanan-dinas"
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-emerald-800 via-teal-700 to-sky-700 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Surat Tugas Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-medium block">Total Tugas Tahun {filterYear}</span>
            <span className="text-xl font-bold text-slate-900">{duties.length} Perjalanan</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-medium block">Perjalanan Dalam Kota</span>
            <span className="text-xl font-bold text-emerald-900">{countDalamKota} Kegiatan</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-medium block">Perjalanan Luar Kota</span>
            <span className="text-xl font-bold text-purple-900">{countLuarKota} Kegiatan</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nomor surat, tujuan, maksud, nama pegawai..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl w-64 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
            />
          </div>

          {/* Filter Jenis */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">Jenis:</span>
            <select
              value={filterJenis}
              onChange={e => setFilterJenis(e.target.value)}
              className="p-1.5 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-800"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="dalam_kota">Dalam Kota</option>
              <option value="luar_kota">Luar Kota</option>
            </select>
          </div>

          {/* Filter Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">Status:</span>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="p-1.5 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-800"
            >
              <option value="ALL">Semua Status</option>
              <option value="terjadwal">Terjadwal</option>
              <option value="berjalan">Sedang Berjalan</option>
              <option value="selesai">Selesai</option>
              <option value="dibatalkan">Dibatalkan</option>
            </select>
          </div>

          {/* Filter Tahun */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-medium">Tahun:</span>
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="p-1.5 border border-slate-200 rounded-xl bg-slate-50 font-mono font-medium text-slate-800"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
        </div>

        <div className="text-slate-500">
          Ditemukan: <strong className="text-slate-900 font-mono">{filteredDuties.length}</strong> data
        </div>
      </div>

      {/* Duties Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Nomor Surat Tugas & SPPD</th>
                <th className="px-4 py-3 font-semibold">Jenis & Tujuan</th>
                <th className="px-4 py-3 font-semibold">Maksud / Agenda</th>
                <th className="px-4 py-3 font-semibold">Jadwal Pelaksanaan</th>
                <th className="px-4 py-3 font-semibold">Pegawai Bertugas</th>
                <th className="px-4 py-3 font-semibold text-center">Status</th>
                <th className="px-4 py-3 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Memuat data perjalanan dinas...
                  </td>
                </tr>
              ) : filteredDuties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Belum ada data perjalanan dinas yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredDuties.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-slate-900">{item.nomor_surat_tugas}</div>
                      <div className="text-[11px] font-mono text-slate-500">SPPD: {item.nomor_sppd || '-'}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.beban_anggaran}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-1 ${
                          item.jenis_perjalanan === 'dalam_kota'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {item.jenis_perjalanan === 'dalam_kota' ? 'Perjalanan Dalam Kota' : 'Perjalanan Luar Kota'}
                      </span>
                      <div className="flex items-center gap-1 font-semibold text-slate-800 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span>{item.tempat_tujuan}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Dari: {item.tempat_berangkat}</div>
                    </td>

                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-slate-800 font-medium line-clamp-2 leading-relaxed">
                        {item.maksud_tujuan}
                      </p>
                      {item.alat_angkut && (
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Transport: {item.alat_angkut}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-slate-700 font-mono text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{item.tanggal_berangkat} s/d {item.tanggal_kembali}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {item.lama_hari ? `${item.lama_hari} Hari Kerja` : ''}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {item.assigned_employees && item.assigned_employees.length > 0 ? (
                          item.assigned_employees.slice(0, 2).map((e, idx) => (
                            <div key={idx} className="text-[11px] text-slate-800 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                              <span>{e.nama_lengkap} ({e.peran || 'Anggota'})</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                        {item.assigned_employees && item.assigned_employees.length > 2 && (
                          <span className="text-[10px] font-bold text-red-700">
                            +{item.assigned_employees.length - 2} pegawai lainnya
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'selesai'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'berjalan'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'dibatalkan'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPrintDutyModal(item)}
                          className="p-1.5 text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Cetak Surat Perintah Tugas (SPT) & SPPD"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewDetailDuty(item)}
                          className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Lihat Ringkasan Agenda"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Edit Surat Tugas"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Hapus Surat Tugas"
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

      {/* MODAL FORM CREATE / EDIT */}
      {showFormModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowFormModal(false)}
          title={editingId ? 'Edit Surat Tugas Perjalanan Dinas' : 'Buat Surat Tugas Perjalanan Dinas Baru'}
          maxWidth="max-w-3xl"
        >
          <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
            {/* Header info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor Surat Tugas KPU <span className="text-red-600">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={formData.nomor_surat_tugas}
                  onChange={e => setFormData({ ...formData, nomor_surat_tugas: e.target.value })}
                  placeholder="Contoh: 045/ST/KPU-SP/III/2026"
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor SPPD:
                </label>
                <input
                  type="text"
                  value={formData.nomor_sppd}
                  onChange={e => setFormData({ ...formData, nomor_sppd: e.target.value })}
                  placeholder="Contoh: 045/SPPD/KPU-SP/III/2026"
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Jenis Perjalanan & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jenis Perjalanan Dinas <span className="text-red-600">*</span>:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, jenis_perjalanan: 'dalam_kota' })}
                    className={`py-2 px-3 rounded-xl font-bold border transition text-center cursor-pointer ${
                      formData.jenis_perjalanan === 'dalam_kota'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Dalam Kota
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, jenis_perjalanan: 'luar_kota' })}
                    className={`py-2 px-3 rounded-xl font-bold border transition text-center cursor-pointer ${
                      formData.jenis_perjalanan === 'luar_kota'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Luar Kota
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Status Pelaksanaan:
                </label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full p-2 border border-slate-300 rounded-xl font-medium"
                >
                  <option value="terjadwal">Terjadwal</option>
                  <option value="berjalan">Sedang Berjalan</option>
                  <option value="selesai">Selesai</option>
                  <option value="dibatalkan">Dibatalkan</option>
                </select>
              </div>
            </div>

            {/* Rute & Jadwal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kota / Tempat Berangkat:
                </label>
                <input
                  type="text"
                  value={formData.tempat_berangkat}
                  onChange={e => setFormData({ ...formData, tempat_berangkat: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kota / Tempat Tujuan <span className="text-red-600">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={formData.tempat_tujuan}
                  onChange={e => setFormData({ ...formData, tempat_tujuan: e.target.value })}
                  placeholder="Misal: KPU Provinsi Jambi / Jakarta Pusat"
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tanggal Berangkat <span className="text-red-600">*</span>:
                </label>
                <input
                  type="date"
                  required
                  value={formData.tanggal_berangkat}
                  onChange={e => setFormData({ ...formData, tanggal_berangkat: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tanggal Kembali <span className="text-red-600">*</span>:
                </label>
                <input
                  type="date"
                  required
                  value={formData.tanggal_kembali}
                  onChange={e => setFormData({ ...formData, tanggal_kembali: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alat Angkut / Transportasi:
                </label>
                <input
                  type="text"
                  value={formData.alat_angkut}
                  onChange={e => setFormData({ ...formData, alat_angkut: e.target.value })}
                  placeholder="Kendaraan Dinas / Pesawat / Darat"
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            {/* Maksud Agenda Tugas */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Maksud & Uraian Perjalanan Dinas <span className="text-red-600">*</span>:
              </label>
              <textarea
                rows={2}
                required
                value={formData.maksud_tujuan}
                onChange={e => setFormData({ ...formData, maksud_tujuan: e.target.value })}
                placeholder="Misal: Menghadiri Rapat Koordinasi Rekapitulasi Daftar Pemilih Tetap (DPT) Tingkat Provinsi..."
                className="w-full p-2 border border-slate-300 rounded-xl"
              />
            </div>

            {/* Anggaran */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Beban Anggaran (Mata Anggaran):
                </label>
                <input
                  type="text"
                  value={formData.beban_anggaran}
                  onChange={e => setFormData({ ...formData, beban_anggaran: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Estimasi Biaya Perjalanan (Rp):
                </label>
                <input
                  type="number"
                  value={formData.total_biaya}
                  onChange={e => setFormData({ ...formData, total_biaya: Number(e.target.value) })}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>

            {/* Pegawai yang Ditugaskan */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">
                  Daftar Pegawai yang Ditugaskan ({formData.pegawai_ids.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddEmployeeRow}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Pegawai</span>
                </button>
              </div>

              <div className="space-y-2">
                {formData.pegawai_ids.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={row.employee_id}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          pegawai_ids: prev.pegawai_ids.map((item, i) =>
                            i === index ? { ...item, employee_id: val } : item
                          )
                        }));
                      }}
                      className="flex-1 p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                    >
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nama_lengkap} (NIP: {emp.nip_nik || '-'}) - {emp.jabatan}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={row.peran}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          pegawai_ids: prev.pegawai_ids.map((item, i) =>
                            i === index ? { ...item, peran: val } : item
                          )
                        }));
                      }}
                      placeholder="Peran (Ketua/Anggota)"
                      className="w-36 p-2 bg-white border border-slate-300 rounded-xl text-xs"
                    />

                    {formData.pegawai_ids.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEmployeeRow(index)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                        title="Hapus baris"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 font-bold text-white bg-linear-to-r from-emerald-800 via-teal-700 to-sky-700 hover:opacity-95 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Surat Tugas'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL VIEW DETAIL & CETAK */}
      {viewDetailDuty && (
        <Modal
          isOpen={true}
          onClose={() => setViewDetailDuty(null)}
          title="Pratinjau Surat Tugas & SPPD Resmi KPU"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Kop Surat KPU */}
            <div className="border-b-2 border-slate-800 pb-3 text-center space-y-0.5">
              <div className="font-serif font-black text-sm tracking-wider text-slate-900">
                KOMISI PEMILIHAN UMUM KOTA SUNGAI PENUH
              </div>
              <div className="text-[10px] text-slate-600">
                Jl. Muradi No. 1, Kota Sungai Penuh, Jambi 37111 &bull; Email: kpu.sungaipenuh@kpu.go.id
              </div>
            </div>

            <div className="text-center space-y-1">
              <div className="font-bold text-xs uppercase underline tracking-wider">
                SURAT TUGAS PERJALANAN DINAS
              </div>
              <div className="font-mono text-slate-600 text-[11px]">
                Nomor: {viewDetailDuty.nomor_surat_tugas}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 leading-relaxed">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500">Maksud / Agenda:</span>
                <span className="col-span-2 font-bold text-slate-900">{viewDetailDuty.maksud_tujuan}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500">Jenis Perjalanan:</span>
                <span className="col-span-2 font-bold text-slate-800">
                  {viewDetailDuty.jenis_perjalanan === 'dalam_kota' ? 'Perjalanan Dinas Dalam Kota' : 'Perjalanan Dinas Luar Kota'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500">Rute Perjalanan:</span>
                <span className="col-span-2 font-mono text-slate-800">
                  {viewDetailDuty.tempat_berangkat} &rarr; {viewDetailDuty.tempat_tujuan}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500">Waktu Pelaksanaan:</span>
                <span className="col-span-2 font-mono text-slate-800">
                  {viewDetailDuty.tanggal_berangkat} s/d {viewDetailDuty.tanggal_kembali} ({viewDetailDuty.lama_hari || 1} hari)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-slate-500">Beban Anggaran:</span>
                <span className="col-span-2 text-slate-800">{viewDetailDuty.beban_anggaran}</span>
              </div>
              {viewDetailDuty.total_biaya ? (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">Alokasi Biaya:</span>
                  <span className="col-span-2 font-mono font-bold text-emerald-800">
                    Rp {Number(viewDetailDuty.total_biaya).toLocaleString('id-ID')}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Pegawai Bertugas */}
            <div className="space-y-1.5">
              <span className="font-bold text-slate-800 block">Pegawai yang Ditugaskan:</span>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="p-2">No</th>
                      <th className="p-2">Nama Pegawai & NIP</th>
                      <th className="p-2">Jabatan</th>
                      <th className="p-2">Peran dalam Tugas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewDetailDuty.assigned_employees?.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-600">{idx + 1}</td>
                        <td className="p-2">
                          <div className="font-bold text-slate-900">{e.nama_lengkap}</div>
                          <div className="text-[10px] font-mono text-slate-500">NIP: {e.nip_nik || '-'}</div>
                        </td>
                        <td className="p-2 text-slate-600">{e.jabatan || 'Pegawai'}</td>
                        <td className="p-2 font-semibold text-slate-800">{e.peran || 'Anggota'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewDetailDuty;
                    setViewDetailDuty(null);
                    setPrintDutyModal(target);
                  }}
                  className="px-4 py-2 bg-linear-to-r from-emerald-800 to-teal-700 hover:opacity-95 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs text-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Dokumen Resmi (SPT & SPPD)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (viewDetailDuty) {
                      setDutyToDelete(viewDetailDuty);
                    }
                  }}
                  className="px-3.5 py-2 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition text-xs"
                  title="Hapus Surat Tugas Ini"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewDetailDuty(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-xs"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL KONFIRMASI HAPUS PERJALANAN DINAS */}
      {dutyToDelete && (
        <Modal
          isOpen={!!dutyToDelete}
          onClose={() => !isDeleting && setDutyToDelete(null)}
          title="Konfirmasi Hapus Surat Tugas"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-rose-900">Hapus Surat Tugas Perjalanan Dinas?</div>
                <div className="text-rose-700 mt-0.5">
                  Tindakan ini permanen. Catatan surat tugas dan daftar personil yang ditugaskan akan dihapus dari sistem.
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Nomor Surat Tugas</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{dutyToDelete.nomor_surat_tugas}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Agenda / Maksud Tugas</span>
                <span className="font-bold text-slate-800">{dutyToDelete.maksud_tujuan}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Tujuan</span>
                  <span className="text-slate-700 font-medium">{dutyToDelete.tempat_tujuan}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Waktu</span>
                  <span className="text-slate-700 font-medium">{dutyToDelete.tanggal_berangkat} s/d {dutyToDelete.tanggal_kembali}</span>
                </div>
              </div>
              {dutyToDelete.assigned_employees && dutyToDelete.assigned_employees.length > 0 && (
                <div className="pt-1 border-t border-slate-200/60">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Personil Ditugaskan</span>
                  <span className="text-slate-700">
                    {dutyToDelete.assigned_employees.map(e => e.nama_lengkap).join(', ')}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDutyToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL CETAK SPT & SPPD LENGKAP */}
      {printDutyModal && (
        <TravelDutyPrintModal
          isOpen={!!printDutyModal}
          onClose={() => setPrintDutyModal(null)}
          duty={printDutyModal}
          employeesList={employees}
        />
      )}
    </div>
  );
};
