import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { RolloverLog } from '../../types';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  FileText,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Modal } from '../../components/Modal';

export const RolloverCutiTahunan: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [logs, setLogs] = useState<RolloverLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetYear, setTargetYear] = useState<number>(currentYear);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState<RolloverLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getRolloverLogs();
      setLogs(res.logs || []);
    } catch (e) {
      console.error('Error fetching rollover logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleExecuteRollover = async () => {
    try {
      setIsProcessing(true);
      const res = await api.runManualRollover(targetYear);
      setShowConfirmModal(false);
      await fetchLogs();
      alert(`Rollover Cuti Tahunan untuk tahun ${targetYear} berhasil diproses untuk ${res.count} pegawai!`);
    } catch (err: any) {
      alert(err.message || 'Gagal menjalankan rollover cuti tahunan.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isCurrentYearRolledOver = logs.some(
    l => l.tahun_proses === currentYear && l.status === 'SUCCESS'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Manajemen Rollover Cuti Tahunan Pegawai
          </h2>
          <p className="text-xs text-slate-500">
            Eksekusi dan riwayat pergeseran saldo cuti tahunan antar periode kalender (N-2, N-1, N)
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Segarkan Log</span>
        </button>
      </div>

      {/* Mechanism Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Status Tahun {currentYear}
              </span>
              {isCurrentYearRolledOver ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Sudah Diproses
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> Belum Diproses
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              {isCurrentYearRolledOver
                ? `Rollover ${currentYear} Aktif`
                : `Menunggu Jadwal Rollover ${currentYear}`}
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Otomatisasi terjadwal berjalan setiap tanggal <strong>1 Januari pukul 00:05 WIB</strong>.
              Sistem dilindungi fitur <em>idempotency</em> sehingga tidak akan memproses ganda dalam satu tahun kalender.
            </p>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              id="btn-open-rollover-modal"
              onClick={() => setShowConfirmModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-linear-to-r from-emerald-800 via-teal-700 to-sky-700 hover:opacity-95 rounded-xl shadow-xs transition-opacity cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Jalankan Rollover Manual</span>
            </button>
          </div>
        </div>

        {/* Technical Formula Diagram */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Formula Baku Pergeseran Saldo Cuti KPU
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-[10px] font-bold text-rose-800 uppercase block">1. Sisa N-2</span>
              <span className="text-sm font-black text-rose-900 block mt-1">Hangus (0)</span>
              <span className="text-[10px] text-rose-700 leading-tight block mt-1">
                Hak cuti 2 tahun sebelumnya kedaluwarsa sesuai peraturan.
              </span>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <span className="text-[10px] font-bold text-indigo-800 uppercase block">2. Sisa N-1</span>
              <span className="text-sm font-black text-indigo-900 block mt-1">&rarr; Menjadi N-2</span>
              <span className="text-[10px] text-indigo-700 leading-tight block mt-1">
                Sisa 1 tahun lalu bergeser menjadi kuota cadangan terakhir.
              </span>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">3. Sisa N</span>
              <span className="text-sm font-black text-emerald-900 block mt-1">&rarr; Menjadi N-1</span>
              <span className="text-[10px] text-emerald-700 leading-tight block mt-1">
                Sisa tahun berjalan digeser ke slot saldo tahun kemarin.
              </span>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[10px] font-bold text-blue-800 uppercase block">4. Kuota Baru</span>
              <span className="text-sm font-black text-blue-900 block mt-1">N = 12 Hari</span>
              <span className="text-[10px] text-blue-700 leading-tight block mt-1">
                Diberikan hak penuh cuti tahunan baru tahun berjalan.
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic">
            * Setiap pergeseran dicatat permanen dalam <code>leave_balance_transactions</code> dan{' '}
            <code>audit_logs</code> dengan cap waktu presisi.
          </p>
        </div>
      </div>

      {/* Rollover Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Histori & Log Eksekusi Rollover
          </h4>
          <span className="text-xs text-slate-500">{logs.length} Log Tercatat</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Tahun Diproses</th>
                <th className="px-4 py-3 font-semibold">Waktu Eksekusi</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-center">Jumlah Pegawai</th>
                <th className="px-4 py-3 font-semibold">Dipicu Oleh</th>
                <th className="px-4 py-3 font-semibold">Rincian Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Memuat catatan log rollover...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Belum ada log eksekusi rollover.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      Tahun {log.tahun_proses}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-800">
                      {log.jumlah_pegawai_diproses} Pegawai
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                        {log.triggered_by}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedLogDetail(log)}
                        className="text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                      >
                        Lihat Rincian JSON
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowConfirmModal(false)}
          title="Konfirmasi Eksekusi Rollover Cuti Tahunan"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Peringatan Eksekusi Database</span>
              </div>
              <p>
                Tindakan ini akan menggeser saldo cuti seluruh pegawai aktif untuk tahun kalender terpilih.
                Sisa saldo N-2 akan hangus dan kuota baru akan disematkan.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pilih Tahun Kalender Target:
              </label>
              <select
                value={targetYear}
                onChange={e => setTargetYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
              >
                <option value={currentYear}>Tahun Ini ({currentYear})</option>
                <option value={currentYear + 1}>Tahun Depan ({currentYear + 1})</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-rollover"
                type="button"
                disabled={isProcessing}
                onClick={handleExecuteRollover}
                className="px-4 py-2 font-semibold text-white bg-linear-to-r from-emerald-800 via-teal-700 to-sky-700 hover:opacity-95 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'Memproses Rollover...' : 'Jalankan Rollover Sekarang'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* JSON DETAIL MODAL */}
      {selectedLogDetail && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLogDetail(null)}
          title={`Detail Log Rollover Tahun ${selectedLogDetail.tahun_proses}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
              <span>Waktu: {new Date(selectedLogDetail.timestamp).toLocaleString('id-ID')}</span>
              <span>Diproses: {selectedLogDetail.jumlah_pegawai_diproses} Pegawai</span>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] overflow-x-auto max-h-72 font-mono">
              {JSON.stringify(JSON.parse(selectedLogDetail.detail_perubahan || '[]'), null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLogDetail(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
