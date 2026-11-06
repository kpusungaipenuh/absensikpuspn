import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { AttendanceRecord } from '../../types';
import {
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Database,
  Wifi,
  WifiOff,
  HardDrive,
  ShieldCheck,
  Info
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { ExportButtons } from '../../components/ExportButtons';
import {
  getAttendanceStorageStats,
  getAttendanceHistoryFromIndexedDB
} from '../../services/attendanceOfflineDb';

export const RiwayatAbsensiPegawai: React.FC = () => {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoModal, setPhotoModal] = useState<{ title: string; url: string } | null>(null);

  // Offline State Persistence using IndexedDB
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [storageStats, setStorageStats] = useState<{ totalRecords: number; lastSync: number | null; isSupported: boolean } | null>(null);
  const [showStorageModal, setShowStorageModal] = useState(false);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const checkStorage = async () => {
    try {
      const stats = await getAttendanceStorageStats();
      setStorageStats(stats);
      if (stats.lastSync && !lastSync) {
        setLastSync(stats.lastSync);
      }
    } catch (e) {
      console.warn('Storage check warning:', e);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const [res, todayRes] = await Promise.all([
        api.getMyAttendanceHistory(selectedYear, selectedMonth),
        api.getTodayAttendance().catch(() => null)
      ]);
      let list = [...(res.history || [])];
      if (todayRes?.attendance) {
        const todayAtt = todayRes.attendance;
        const [tYear, tMonth] = (todayAtt.tanggal || '').split('-').map(Number);
        if (tYear === selectedYear && tMonth === selectedMonth) {
          const idx = list.findIndex(r => r.tanggal === todayAtt.tanggal);
          if (idx >= 0) {
            list[idx] = todayAtt;
          } else {
            list.unshift(todayAtt);
          }
        }
      }
      setRecords(list);
      setIsOffline(Boolean(res.isOffline) || !navigator.onLine);
      if (res.lastSync) {
        setLastSync(res.lastSync);
      }
      await checkStorage();
    } catch (e) {
      console.error('Error fetching my attendance, loading from IndexedDB:', e);
      setIsOffline(true);
      const offline = await getAttendanceHistoryFromIndexedDB({ year: selectedYear, month: selectedMonth });
      setRecords(offline.records || []);
      if (offline.lastSync) setLastSync(offline.lastSync);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedMonth, selectedYear]);

  // Online / Offline connection listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchHistory();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    checkStorage();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const totalHadir = records.filter(r => r.status === 'Hadir').length;
  const totalTerlambat = records.filter(r => r.status === 'Terlambat').length;

  const exportColumns = [
    { header: 'Tanggal', key: 'tanggal' },
    { header: 'Status', key: 'status' },
    { header: 'Jam Masuk', key: 'jam_masuk' },
    { header: 'Jam Pulang', key: 'jam_pulang' },
    { header: 'Metode', key: 'metode_kerja' },
    { header: 'Keterlambatan (Mnt)', key: 'keterlambatan_menit' },
    { header: 'Status Ganti Jam', key: 'status_ganti_jam' },
    { header: 'Jarak GPS (Meter)', key: 'jarak_dari_kantor' },
  ];

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Riwayat Absensi & Kehadiran Saya
            </h2>
            {isOffline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <WifiOff className="w-3 h-3 text-amber-700" />
                <span>Mode Offline (IndexedDB)</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowStorageModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                title="Klik untuk melihat status penyimpanan IndexedDB offline"
              >
                <Database className="w-3 h-3 text-emerald-600" />
                <span>IndexedDB Tersinkron</span>
                {storageStats && storageStats.totalRecords > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] font-mono bg-emerald-200 text-emerald-900 rounded font-bold">
                    {storageStats.totalRecords}
                  </span>
                )}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Log presensi masuk dan pulang lengkap dengan catatan GPS dan foto selfie Anda
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-300 font-medium bg-slate-50"
            >
              {monthNames.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-300 font-semibold bg-slate-50"
            >
              <option value={today.getFullYear()}>{today.getFullYear()}</option>
              <option value={today.getFullYear() - 1}>{today.getFullYear() - 1}</option>
            </select>
          </div>

          <ExportButtons
            title={`Rekap Kehadiran Pegawai - ${monthNames[selectedMonth - 1]} ${selectedYear}`}
            filename={`rekap_kehadiran_${selectedYear}_${String(selectedMonth).padStart(2, '0')}`}
            columns={exportColumns}
            data={records}
          />

          <button
            onClick={handlePrintSlip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 transition-colors cursor-pointer"
            title="Cetak Slip Presensi Bulanan"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Cetak Slip</span>
          </button>

          <button
            onClick={fetchHistory}
            className="p-2 text-slate-600 hover:text-red-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Muat ulang riwayat (Sinkronkan ulang)"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-red-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* OFFLINE STATE PERSISTENCE BANNER */}
      {isOffline && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300/90 rounded-2xl p-4 shadow-xs text-amber-950">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                <WifiOff className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-amber-900">
                    Koneksi Internet Terputus (Mode Offline Aktif)
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                    <Database className="w-3 h-3 text-amber-800" />
                    IndexedDB State Persistence
                  </span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Anda tetap dapat meninjau seluruh data riwayat presensi yang telah tersimpan di IndexedDB peramban Anda tanpa gangguan koneksi.
                  {lastSync && (
                    <span className="block font-medium mt-0.5 text-amber-900">
                      Sinkronisasi terakhir: {new Date(lastSync).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })} WIB
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setShowStorageModal(true)}
                className="px-3 py-1.5 bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Info className="w-3.5 h-3.5 text-amber-700" />
                <span>Info Cache</span>
              </button>
              <button
                type="button"
                onClick={fetchHistory}
                disabled={loading}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Coba Sinkron Ulang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 block">Total Hari Hadir</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{records.length} Hari</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <span className="text-xs text-emerald-700 font-medium block">Tepat Waktu</span>
          <span className="text-2xl font-bold text-emerald-800 mt-1 block">{totalHadir} Hari</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <span className="text-xs text-amber-700 font-medium block">Terlambat</span>
          <span className="text-2xl font-bold text-amber-800 mt-1 block">{totalTerlambat} Hari</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <span className="text-xs text-blue-700 font-medium block">Kepatuhan WFO/WFH</span>
          <span className="text-2xl font-bold text-blue-800 mt-1 block">100%</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Tanggal</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold font-mono">Jam Masuk</th>
                <th className="px-4 py-3 font-semibold font-mono">Jam Pulang</th>
                <th className="px-4 py-3 font-semibold">Ganti Jam Keterlambatan</th>
                <th className="px-4 py-3 font-semibold text-center">Metode</th>
                <th className="px-4 py-3 font-semibold">Jarak & Validasi GPS</th>
                <th className="px-4 py-3 font-semibold text-center">Foto Masuk/Pulang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Memuat riwayat absensi...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada catatan absensi pada periode bulan ini.
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-900 font-mono">
                      {r.tanggal}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'Hadir'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      {r.jam_masuk || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-700">
                      {r.jam_pulang || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {r.keterlambatan_menit && r.keterlambatan_menit > 0 ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-amber-700">
                            Terlambat +{r.keterlambatan_menit} mnt
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Min: {r.jam_pulang_wajib ? r.jam_pulang_wajib.substring(0, 5) : '-'} WIB
                          </div>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              r.status_ganti_jam === 'terpenuhi' || r.jam_pulang
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.status_ganti_jam === 'terpenuhi' || r.jam_pulang ? 'Terpenuhi' : 'Menunggu'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Tepat Waktu</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          r.metode_kerja === 'WFO'
                            ? 'bg-blue-100 text-blue-800'
                            : r.metode_kerja === 'WFH'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {r.metode_kerja}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-red-500" />
                        <span>{r.jarak_dari_kantor ? `${r.jarak_dari_kantor} meter` : 'Lokasi Terverifikasi'}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{r.status_validasi_lokasi}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {r.foto_masuk && (
                          <button
                            onClick={() =>
                              setPhotoModal({
                                title: `Foto Masuk: ${r.tanggal} (${r.jam_masuk})`,
                                url: r.foto_masuk!
                              })
                            }
                            className="p-1 hover:bg-slate-100 rounded-md cursor-pointer"
                            title="Lihat Foto Masuk"
                          >
                            <img
                              src={r.foto_masuk}
                              alt="In"
                              className="w-7 h-7 rounded-md object-cover ring-1 ring-slate-200"
                            />
                          </button>
                        )}
                        {r.foto_pulang && (
                          <button
                            onClick={() =>
                              setPhotoModal({
                                title: `Foto Pulang: ${r.tanggal} (${r.jam_pulang})`,
                                url: r.foto_pulang!
                              })
                            }
                            className="p-1 hover:bg-slate-100 rounded-md cursor-pointer"
                            title="Lihat Foto Pulang"
                          >
                            <img
                              src={r.foto_pulang}
                              alt="Out"
                              className="w-7 h-7 rounded-md object-cover ring-1 ring-slate-200"
                            />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

      {/* STORAGE PERSISTENCE DETAILS MODAL */}
      {showStorageModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowStorageModal(false)}
          title="Status Penyimpanan Offline (IndexedDB)"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950">
              <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-900">State Persistence Aktif</h4>
                <p className="text-emerald-800 text-[11px] mt-0.5">
                  Data riwayat presensi disimpan ke IndexedDB browser agar tetap dapat dibuka saat perangkat kehilangan sinyal internet.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden">
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Nama Database:</span>
                <span className="font-mono font-semibold text-slate-800">absensi_kpu_offline_db</span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Koneksi Jaringan:</span>
                <span className={`font-semibold flex items-center gap-1 ${isOffline ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                  {isOffline ? 'Terputus (Offline)' : 'Terhubung (Online)'}
                </span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Total Catatan Tersimpan:</span>
                <span className="font-bold text-slate-900">
                  {storageStats?.totalRecords || records.length} Dokumen Absensi
                </span>
              </div>
              <div className="p-3 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Sinkronisasi Terakhir:</span>
                <span className="text-slate-700 font-medium">
                  {lastSync
                    ? new Date(lastSync).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) + ' WIB'
                    : 'Belum pernah'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Saat internet padam atau dalam perjalanan (WFA/Dinas luar), riwayat presensi, waktu jam masuk/pulang, dan catatan ganti jam tetap dapat diakses dengan cepat langsung dari memori perangkat.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  fetchHistory();
                  setShowStorageModal(false);
                }}
                className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Tutup & Sinkronkan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
