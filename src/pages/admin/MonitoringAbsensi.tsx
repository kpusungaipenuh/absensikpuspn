import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSubBagianList } from '../../utils/subBagian';
import { getWibDateStr } from '../../utils/dateUtils';
import {
  Eye,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  Filter,
  Trash2,
  AlertTriangle,
  FileDown,
  PlusCircle
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { ExportFilteredAttendanceModal } from '../../components/admin/ExportFilteredAttendanceModal';
import { ManualAttendanceModal } from '../../components/admin/ManualAttendanceModal';
import { AttendanceLocationDetailModal } from '../../components/admin/AttendanceLocationDetailModal';

export const MonitoringAbsensi: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() => getWibDateStr());
  const [activeTab, setActiveTab] = useState<'sudah' | 'belum'>('sudah');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const subBagianList = useSubBagianList();
  const [selectedSubBagian, setSelectedSubBagian] = useState('ALL');
  const [search, setSearch] = useState('');
  const [photoModal, setPhotoModal] = useState<{ title: string; url: string } | null>(null);
  const [selectedLocationRecord, setSelectedLocationRecord] = useState<any | null>(null);
  const [officeData, setOfficeData] = useState<any | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    nama: string;
    nip: string;
    tanggal: string;
    jamMasuk: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMonitoring = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await api.getMonitoringAttendance(selectedDate);
      setData(res);
    } catch (e: any) {
      if (e?.message?.includes('Sesi tidak valid') || e?.message?.includes('401')) {
        // Session expired or invalidated, silent fallback handled by auth state
        return;
      }
      if (
        e?.message?.includes('Failed to fetch') ||
        e?.message?.includes('koneksi') ||
        e?.message?.includes('NetworkError') ||
        e?.name === 'TypeError'
      ) {
        console.warn('Monitoring attendance temporary network blip, retrying on next poll:', e?.message);
        return;
      }
      console.error('Error fetching monitoring attendance:', e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoring(false);
    const timer = setInterval(() => {
      fetchMonitoring(true);
    }, 20000); // 20s live polling
    return () => clearInterval(timer);
  }, [selectedDate]);

  useEffect(() => {
    api.getSettings().then(res => {
      if (res?.office) setOfficeData(res.office);
    }).catch(err => {
      console.warn('Could not load office settings:', err);
    });
  }, []);

  const handleDeleteAttendance = async () => {
    if (!deleteConfirm) return;
    try {
      setIsDeleting(true);
      await api.deleteAttendance(deleteConfirm.id);
      alert(`Data absensi ${deleteConfirm.nama} berhasil dihapus. Pegawai kini dapat melakukan absensi ulang.`);
      setDeleteConfirm(null);
      await fetchMonitoring();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus data absensi');
    } finally {
      setIsDeleting(false);
    }
  };

  const { totalPegawai = 0, totalSudahAbsen = 0, totalBelumAbsen = 0, sudahAbsen = [], belumAbsen = [] } =
    data || {};

  const filteredSudah = sudahAbsen.filter((item: any) => {
    if (selectedSubBagian !== 'ALL') {
      const sub = item.sub_bagian || item.unit_kerja;
      if (sub !== selectedSubBagian) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return item.nama_lengkap?.toLowerCase().includes(q) || item.nip_nik?.includes(q);
  });

  const filteredBelum = belumAbsen.filter((item: any) => {
    if (selectedSubBagian !== 'ALL') {
      const sub = item.sub_bagian || item.unit_kerja;
      if (sub !== selectedSubBagian) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return item.nama_lengkap?.toLowerCase().includes(q) || item.nip_nik?.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Monitoring Kehadiran Real-Time Pegawai
          </h2>
          <p className="text-xs text-slate-500">
            Pemantauan langsung status absensi seluruh pegawai KPU Kota Sungai Penuh hari ini
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="font-semibold text-slate-600">Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-800 font-medium focus:outline-hidden"
            />
          </div>
          <button
            type="button"
            id="btn-manual-attendance-monitoring"
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-linear-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
            title="Tambah absensi pegawai secara manual (jika pegawai lupa absen)"
          >
            <PlusCircle className="w-3.5 h-3.5 text-teal-200" />
            <span>+ Input Presensi Manual</span>
          </button>
          <button
            type="button"
            id="btn-export-pdf-monitoring-page"
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-linear-to-r from-red-700 to-rose-700 hover:from-red-800 hover:to-rose-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
            title="Ekspor PDF Dokumen Resmi Daftar Hadir"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Ekspor PDF</span>
          </button>
          <button
            onClick={fetchMonitoring}
            className="p-2 text-slate-600 hover:text-teal-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Segarkan data sekarang"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Total Pegawai Terdaftar</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalPegawai} Orang</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            100%
          </div>
        </div>

        <div
          onClick={() => setActiveTab('sudah')}
          className={`p-4 rounded-xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            activeTab === 'sudah'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div>
            <div className="text-xs font-semibold text-emerald-700">Sudah Melakukan Absensi</div>
            <div className="text-2xl font-bold text-emerald-800 mt-1">{totalSudahAbsen} Orang</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('belum')}
          className={`p-4 rounded-xl border shadow-xs flex items-center justify-between cursor-pointer transition-all ${
            activeTab === 'belum'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div>
            <div className="text-xs font-semibold text-amber-700">Belum Melakukan Absensi</div>
            <div className="text-2xl font-bold text-amber-800 mt-1">{totalBelumAbsen} Orang</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <UserX className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <button
              id="tab-sudah-absen"
              onClick={() => setActiveTab('sudah')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                activeTab === 'sudah'
                  ? 'bg-linear-to-r from-emerald-800 to-teal-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              TAB 1: Sudah Absen ({totalSudahAbsen})
            </button>
            <button
              id="tab-belum-absen"
              onClick={() => setActiveTab('belum')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                activeTab === 'belum'
                  ? 'bg-linear-to-r from-teal-700 to-sky-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              TAB 2: Belum Absen ({totalBelumAbsen})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedSubBagian}
                onChange={e => setSelectedSubBagian(e.target.value)}
                className="bg-transparent text-slate-700 font-medium focus:outline-hidden"
              >
                <option value="ALL">Semua Sub Bagian</option>
                {subBagianList.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama pegawai / NIP..."
                className="w-full sm:w-56 text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
              />
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* TAB 1: SUDAH ABSEN */}
        {activeTab === 'sudah' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nama Pegawai & NIP</th>
                  <th className="px-4 py-3 font-semibold">Sub Bagian</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold font-mono">Jam Masuk</th>
                  <th className="px-4 py-3 font-semibold font-mono">Jam Pulang</th>
                  <th className="px-4 py-3 font-semibold text-center">Metode</th>
                  <th className="px-4 py-3 font-semibold">Jarak & Radius</th>
                  <th className="px-4 py-3 font-semibold text-center">Foto Selfie</th>
                  <th className="px-4 py-3 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSudah.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      Belum ada pegawai yang check-in pada tanggal ini.
                    </td>
                  </tr>
                ) : (
                  filteredSudah.map((item: any) => {
                    const att = item.attendance;
                    const fullRecord = {
                      ...att,
                      nama_lengkap: item.nama_lengkap,
                      nip_nik: item.nip_nik,
                      foto_profil: item.foto_profil,
                      sub_bagian: item.sub_bagian || item.unit_kerja,
                      jabatan: item.jabatan,
                      tanggal: selectedDate
                    };
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={
                                item.foto_profil ||
                                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                              }
                              alt=""
                              className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                            />
                            <div>
                              <div className="font-semibold text-slate-900">{item.nama_lengkap}</div>
                              <div className="text-[11px] font-mono text-slate-400">{item.nip_nik}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.sub_bagian || item.unit_kerja}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              att.status === 'Hadir'
                                ? 'bg-emerald-100 text-emerald-800'
                                : att.status === 'Terlambat'
                                ? 'bg-amber-100 text-amber-800'
                                : att.status === 'TK'
                                ? 'bg-rose-100 text-rose-800 font-bold border border-rose-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {att.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {att.jam_masuk || '-'}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-slate-700">
                          {att.jam_pulang || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                              att.metode_kerja === 'WFO'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : att.metode_kerja === 'WFH'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}
                          >
                            {att.metode_kerja}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <button
                            onClick={() => setSelectedLocationRecord(fullRecord)}
                            className="flex items-center gap-1 font-medium hover:text-teal-700 text-left cursor-pointer group transition-colors"
                            title="Verifikasi titik koordinat kehadiran di Google Maps"
                          >
                            <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0 group-hover:scale-110 transition-transform" />
                            <span className="underline decoration-slate-300 group-hover:decoration-teal-600 underline-offset-2">
                              {att.jarak_dari_kantor ? `${Math.round(att.jarak_dari_kantor)} meter` : 'Lihat Titik GPS'}
                            </span>
                          </button>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {att.status_validasi_lokasi}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {att.foto_masuk ? (
                            <button
                              onClick={() =>
                                setPhotoModal({
                                   title: `Foto Selfie Masuk: ${item.nama_lengkap} (${att.jam_masuk})`,
                                  url: att.foto_masuk
                                })
                              }
                              className="p-1 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              <img
                                src={att.foto_masuk}
                                alt="Selfie"
                                className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-200"
                              />
                            </button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedLocationRecord(fullRecord)}
                              title="Verifikasi titik koordinat kehadiran di Google Maps"
                              className="inline-flex items-center gap-1 px-2 py-1 text-teal-700 hover:text-white bg-teal-50 hover:bg-teal-700 border border-teal-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              <span>Peta</span>
                            </button>
                            <button
                              onClick={() =>
                                setDeleteConfirm({
                                  id: att.id,
                                  nama: item.nama_lengkap,
                                  nip: item.nip_nik,
                                  tanggal: selectedDate,
                                  jamMasuk: att.jam_masuk
                                })
                              }
                              title="Hapus data absensi agar pegawai bisa mengulang absen"
                              className="inline-flex items-center gap-1 px-2 py-1 text-red-700 hover:text-white bg-red-50 hover:bg-red-700 border border-red-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: BELUM ABSEN */}
        {activeTab === 'belum' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nama Pegawai & NIP</th>
                  <th className="px-4 py-3 font-semibold">Sub Bagian</th>
                  <th className="px-4 py-3 font-semibold">Jabatan</th>
                  <th className="px-4 py-3 font-semibold text-center">Jadwal Metode Kerja</th>
                  <th className="px-4 py-3 font-semibold">Keterangan / Status Khusus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBelum.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Seluruh pegawai aktif telah melakukan absensi!
                    </td>
                  </tr>
                ) : (
                  filteredBelum.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{item.nama_lengkap}</div>
                        <div className="text-[11px] font-mono text-slate-400">{item.nip_nik}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.sub_bagian || item.unit_kerja}</td>
                      <td className="px-4 py-3 text-slate-700">{item.jabatan}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                            item.assignedMethod === 'WFH'
                              ? 'bg-purple-100 text-purple-800'
                              : item.assignedMethod === 'WFA'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {item.assignedMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.isLeave ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                            Sedang Cuti: {item.isLeave}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-medium">Belum Check-In</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PHOTO MODAL */}
      {photoModal && (
        <Modal
          isOpen={true}
          onClose={() => setPhotoModal(null)}
          title={photoModal.title}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col items-center">
            <img
              src={photoModal.url}
              alt="Foto absensi"
              className="w-full h-80 object-cover rounded-xl shadow-md border border-slate-200"
            />
            <button
              onClick={() => setPhotoModal(null)}
              className="mt-4 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-900 cursor-pointer"
            >
              Tutup Foto
            </button>
          </div>
        </Modal>
      )}

      {/* DELETE ATTENDANCE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Konfirmasi Hapus Data Absensi"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-red-900">
                  Hapus presensi untuk mengizinkan pegawai mengulang absen?
                </p>
                <p className="text-red-700 leading-relaxed">
                  Tindakan ini akan menghapus log presensi masuk dan foto selfie pegawai bersangkutan untuk tanggal <strong>{deleteConfirm.tanggal}</strong>.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Pegawai:</span>
                <span className="font-semibold text-slate-900">{deleteConfirm.nama}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NIP / NIK:</span>
                <span className="font-mono text-slate-900">{deleteConfirm.nip}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tanggal:</span>
                <span className="font-medium text-slate-900">{deleteConfirm.tanggal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jam Masuk Tercatat:</span>
                <span className="font-mono font-bold text-slate-900">{deleteConfirm.jamMasuk || '-'} WIB</span>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 rounded-lg text-amber-900 text-[11px] border border-amber-200">
              ℹ️ <strong>Informasi:</strong> Setelah dihapus, pegawai dapat langsung membuka kembali menu absensi di aplikasinya dan melakukan check-in ulang.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteAttendance}
                disabled={isDeleting}
                className="px-4 py-2 font-bold text-white bg-red-700 hover:bg-red-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Data Absensi'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Export Filtered Attendance PDF Modal */}
      <ExportFilteredAttendanceModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        defaultDate={selectedDate}
        defaultSubBagian={selectedSubBagian}
      />

      {/* Manual Attendance Input Modal */}
      <ManualAttendanceModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSuccess={() => {
          fetchMonitoring();
        }}
      />

      {/* Modal Detail Absensi Pegawai & Verifikasi Titik Koordinat Google Maps */}
      <AttendanceLocationDetailModal
        isOpen={Boolean(selectedLocationRecord)}
        onClose={() => setSelectedLocationRecord(null)}
        record={selectedLocationRecord}
        office={officeData}
      />
    </div>
  );
};
