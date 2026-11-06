import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { AttendanceRecord } from '../../types';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  User,
  Building2,
  RefreshCw,
  Search,
  MessageSquare,
  ShieldAlert,
  FileCheck,
  Trash2
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { AttendanceLocationDetailModal } from '../../components/admin/AttendanceLocationDetailModal';

export const ApprovalLuarRadius: React.FC<{ onCountChange?: (count: number) => void }> = ({ onCountChange }) => {
  const [pendingList, setPendingList] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals for approve / reject
  const [selectedItem, setSelectedItem] = useState<AttendanceRecord | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  // Google Maps verification modal
  const [selectedMapRecord, setSelectedMapRecord] = useState<AttendanceRecord | null>(null);
  const [officeData, setOfficeData] = useState<any | null>(null);

  // Delete attendance state
  const [deleteConfirm, setDeleteConfirm] = useState<AttendanceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAttendance = async () => {
    if (!deleteConfirm) return;
    try {
      setIsDeleting(true);
      await api.deleteAttendance(deleteConfirm.id);
      alert(`Data absensi luar radius ${deleteConfirm.nama_lengkap} berhasil dihapus. Pegawai dapat melakukan absensi ulang.`);
      setDeleteConfirm(null);
      await fetchPending();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus data absensi');
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchPending = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPendingEmergencyAttendance();
      const list = res.list || [];
      setPendingList(list);
      if (onCountChange) onCountChange(list.length);
    } catch (err: any) {
      console.error('Error loading pending emergency attendance:', err);
      setError(err.message || 'Gagal memuat permohonan absensi luar radius.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    api.getSettings().then(res => {
      if (res?.office) setOfficeData(res.office);
    }).catch(err => {
      console.warn('Could not load office settings:', err);
    });
  }, []);

  const handleOpenAction = (item: AttendanceRecord, type: 'APPROVE' | 'REJECT') => {
    setSelectedItem(item);
    setActionType(type);
    setActionNote(type === 'APPROVE' ? 'Disetujui oleh Admin/SDM karena kendala terkonfirmasi.' : 'Tidak memenuhi syarat verifikasi absensi luar radius.');
  };

  const handleConfirmAction = async () => {
    if (!selectedItem || !actionType) return;
    try {
      setIsProcessing(true);
      if (actionType === 'APPROVE') {
        await api.approveEmergencyAttendance(selectedItem.id, actionNote);
        alert(`Absensi untuk ${selectedItem.nama_lengkap} berhasil DISETUJUI dan resmi tercatat.`);
      } else {
        await api.rejectEmergencyAttendance(selectedItem.id, actionNote);
        alert(`Pengajuan absensi untuk ${selectedItem.nama_lengkap} telah DITOLAK.`);
      }
      setSelectedItem(null);
      setActionType(null);
      setActionNote('');
      await fetchPending();
    } catch (err: any) {
      alert(err.message || 'Gagal memproses persetujuan.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = pendingList.filter(item => {
    const q = searchTerm.toLowerCase();
    return (
      (item.nama_lengkap && item.nama_lengkap.toLowerCase().includes(q)) ||
      (item.nip_nik && item.nip_nik.toLowerCase().includes(q)) ||
      (item.unit_kerja && item.unit_kerja.toLowerCase().includes(q)) ||
      (item.emergency_reason && item.emergency_reason.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Header Info Banner */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-950">
              Persetujuan Absensi Luar Radius (Kendala Halangan di Perjalanan)
            </h3>
            <p className="text-xs text-amber-800 mt-0.5">
              Daftar pegawai yang melakukan presensi di luar radius kantor akibat halangan di jalan (macet, kendaraan mogok, dll). <strong>Absensi belum resmi hadir sebelum disetujui Admin.</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-200 text-amber-900 border border-amber-300">
            {pendingList.length} Menunggu Persetujuan
          </span>
          <button
            type="button"
            onClick={fetchPending}
            disabled={loading}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer shadow-2xs transition"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama pegawai, NIP, unit kerja, atau kendala..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
          />
        </div>
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* Content List */}
      {loading ? (
        <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center space-y-2">
          <RefreshCw className="w-6 h-6 text-teal-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Memeriksa permohonan verifikasi absensi luar radius...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 bg-white rounded-2xl border border-slate-200/80 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">Tidak Ada Permohonan Tertunda</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Semua pegawai yang absen hari ini berada di dalam radius kantor KPU atau telah disetujui seluruhnya.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(item => (
            <div
              key={item.id}
              className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between gap-4"
            >
              <div>
                {/* Employee Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        item.foto_profil ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                      }
                      alt={item.nama_lengkap || 'Pegawai'}
                      className="w-11 h-11 rounded-xl object-cover ring-2 ring-slate-100"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {item.nama_lengkap}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono">
                        NIP: {item.nip_nik || '-'}
                      </p>
                      <p className="text-[11px] text-slate-600 font-medium">
                        {item.jabatan} &bull; <span className="text-teal-700">{item.unit_kerja}</span>
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                    Menunggu Verifikasi
                  </span>
                </div>

                {/* Attendance Details & Emergency Reason */}
                <div className="space-y-2.5 pt-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-slate-50 rounded-xl flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        Waktu: <strong className="font-mono text-slate-800">{item.jam_masuk} WIB</strong>
                      </span>
                    </div>
                    <div className="p-2 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-1.5 text-rose-800">
                      <MapPin className="w-3.5 h-3.5 text-rose-600" />
                      <span>
                        Jarak: <strong>{item.jarak_dari_kantor ? `${Math.round(item.jarak_dari_kantor)} m` : 'Luar Radius'}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Kendala / Alasan */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-900">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
                      <span>Alasan Kendala / Halangan di Jalan:</span>
                    </div>
                    <p className="text-slate-800 text-xs italic bg-white p-2 rounded-lg border border-amber-100 leading-relaxed">
                      "{item.emergency_reason || 'Pegawai melaporkan halangan perjalanan'}"
                    </p>
                  </div>

                  {/* Selfie Photo Preview */}
                  {item.foto_masuk && (
                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <img
                          src={item.foto_masuk}
                          alt="Selfie Check-in"
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                        />
                        <span className="text-[11px] text-slate-600 font-medium">Foto Bukti Selfie Masuk</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewPhoto(item.foto_masuk || null)}
                        className="px-2.5 py-1 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition cursor-pointer"
                      >
                        Lihat Foto
                      </button>
                    </div>
                  )}

                  {/* Google Maps Location Verification Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedMapRecord(item)}
                    className="w-full py-2 px-3 bg-teal-50 hover:bg-teal-100/90 text-teal-800 border border-teal-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-teal-700" />
                    <span>Verifikasi Titik Koordinat di Google Maps ({item.jarak_dari_kantor ? `${Math.round(item.jarak_dari_kantor)} m` : 'Lihat Lokasi'})</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(item)}
                  className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-xl cursor-pointer transition flex items-center gap-1"
                  title="Hapus data presensi agar pegawai bisa mengulang presensi"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus (Beri Kesempatan Ulang)</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAction(item, 'REJECT')}
                    className="px-3 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl cursor-pointer transition shadow-2xs flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Tolak</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAction(item, 'APPROVE')}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-xs flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Setujui Absensi</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ACTION MODAL */}
      {selectedItem && actionType && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedItem(null)}
          title={
            actionType === 'APPROVE'
              ? 'Konfirmasi Persetujuan Absensi Luar Radius'
              : 'Konfirmasi Penolakan Absensi Luar Radius'
          }
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div
              className={`p-3 rounded-xl border ${
                actionType === 'APPROVE'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <p className="leading-relaxed">
                {actionType === 'APPROVE'
                  ? `Dengan menyetujui, absensi untuk ${selectedItem.nama_lengkap} (NIP: ${selectedItem.nip_nik || '-'}) akan resmi tercatat sebagai Hadir pada tanggal ${selectedItem.tanggal}.`
                  : `Pengajuan absensi luar radius untuk ${selectedItem.nama_lengkap} akan ditolak dan status kehadiran tidak akan diakui sebagai kehadiran sah.`}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-slate-500 font-medium block">Kendala yang dilaporkan pegawai:</span>
              <span className="text-slate-900 font-semibold italic block">
                "{selectedItem.emergency_reason || '-'}"
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-slate-700 font-bold block">
                {actionType === 'APPROVE' ? 'Catatan Persetujuan (Opsional)' : 'Alasan Penolakan (Wajib Diisi)'}:
              </label>
              <textarea
                rows={3}
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
                placeholder={
                  actionType === 'APPROVE'
                    ? 'Tuliskan catatan persetujuan...'
                    : 'Jelaskan alasan mengapa permohonan ini ditolak...'
                }
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                disabled={isProcessing}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessing || (actionType === 'REJECT' && !actionNote.trim())}
                onClick={handleConfirmAction}
                className={`px-5 py-2 font-bold text-white rounded-xl shadow-xs cursor-pointer transition disabled:opacity-50 ${
                  actionType === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isProcessing
                  ? 'Memproses...'
                  : actionType === 'APPROVE'
                  ? 'Konfirmasi Setujui'
                  : 'Konfirmasi Tolak'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* VIEW PHOTO MODAL */}
      {viewPhoto && (
        <Modal isOpen={true} onClose={() => setViewPhoto(null)} title="Foto Selfie Bukti Kehadiran" maxWidth="max-w-md">
          <div className="space-y-3">
            <div className="w-full h-80 bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
              <img src={viewPhoto} alt="Selfie Bukti" className="w-full h-full object-contain" />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setViewPhoto(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE ATTENDANCE MODAL */}
      {deleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Konfirmasi Hapus Data Presensi Luar Radius"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-sm text-red-950">
                <Trash2 className="w-4 h-4 text-red-600" />
                Hapus Data Presensi Luar Radius
              </div>
              <p>
                Apakah Anda yakin ingin menghapus data pengajuan presensi luar radius ini?
              </p>
              <div className="bg-white p-2.5 rounded-lg border border-red-200 space-y-1 text-slate-800 font-medium">
                <div><strong>Pegawai:</strong> {deleteConfirm.nama_lengkap}</div>
                <div><strong>NIP:</strong> {deleteConfirm.nip_nik || '-'}</div>
                <div><strong>Tanggal & Jam:</strong> {deleteConfirm.tanggal} ({deleteConfirm.jam_masuk} WIB)</div>
                <div><strong>Alasan Diajukan:</strong> {deleteConfirm.emergency_reason || '-'}</div>
              </div>
              <p className="text-red-700 font-semibold pt-1">
                ⚠️ Setelah dihapus, riwayat presensi hari ini untuk pegawai bersangkutan akan dikosongkan sehingga pegawai dapat melakukan absensi ulang.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAttendance}
                className="px-4 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Data Presensi'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Detail & Peta Verifikasi Koordinat Google Maps */}
      <AttendanceLocationDetailModal
        isOpen={Boolean(selectedMapRecord)}
        onClose={() => setSelectedMapRecord(null)}
        record={selectedMapRecord}
        office={officeData}
      />
    </div>
  );
};
