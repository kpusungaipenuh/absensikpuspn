import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LeaveBalanceTransaction } from '../../types';
import {
  WalletCards,
  Search,
  Filter,
  Edit,
  History,
  Calendar,
  AlertCircle,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { ExportButtons } from '../../components/ExportButtons';
import { Modal } from '../../components/Modal';
import { useSubBagianList } from '../../utils/subBagian';

export const SisaSaldoCutiTahunan: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const subBagianList = useSubBagianList();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal state
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [formN2, setFormN2] = useState(0);
  const [formN1, setFormN1] = useState(0);
  const [formN, setFormN] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transaction history modal
  const [historyEmp, setHistoryEmp] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<LeaveBalanceTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminBalancesSummary(selectedYear, unitFilter, search);
      setRows(res.rows || []);
    } catch (e) {
      console.error('Error fetching balances summary:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [selectedYear, unitFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBalances();
  };

  const openEditModal = (emp: any) => {
    setEditingEmp(emp);
    setFormN2(emp.n_2 || 0);
    setFormN1(emp.n_1 || 0);
    setFormN(emp.n || 0);
    setAdjustReason('');
    setAdjustError(null);
  };

  const openHistoryModal = async (emp: any) => {
    setHistoryEmp(emp);
    try {
      setHistoryLoading(true);
      const res = await api.getEmployeeBalanceHistory(emp.id);
      setTransactions(res.transactions || []);
    } catch (e) {
      console.error('Error fetching transaction history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveAdjustment = async () => {
    if (!adjustReason.trim()) {
      setAdjustError('Alasan penyesuaian saldo wajib diisi untuk catatan audit.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.adjustLeaveBalance({
        employeeId: editingEmp.id,
        year: selectedYear,
        n_2: formN2,
        n_1: formN1,
        n: formN,
        reason: adjustReason.trim()
      });
      setEditingEmp(null);
      await fetchBalances();
      alert('Saldo cuti berhasil disesuaikan secara manual.');
    } catch (err: any) {
      setAdjustError(err.message || 'Gagal menyimpan penyesuaian saldo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportColumns = [
    { header: 'Nama Pegawai', key: 'nama_lengkap' },
    { header: 'NIP/NIK', key: 'nip_nik' },
    { header: 'Unit Kerja', key: 'unit_kerja' },
    { header: 'Jabatan', key: 'jabatan' },
    { header: `N-2 (${selectedYear - 2})`, key: 'n_2' },
    { header: `N-1 (${selectedYear - 1})`, key: 'n_1' },
    { header: `N (${selectedYear})`, key: 'n' },
    { header: 'Total Sisa Saldo', key: 'total' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Sisa Saldo Cuti Tahunan Pegawai
          </h2>
          <p className="text-xs text-slate-500">
            Daftar saldo cuti tahunan berjalan dengan skema sekuensial N-2, N-1, dan N Tahun {selectedYear}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ExportButtons
            title={`SISA SALDO CUTI TAHUNAN PEGAWAI KPU KOTA SUNGAI PENUH TAHUN ${selectedYear}`}
            filename={`Saldo_Cuti_Pegawai_${selectedYear}`}
            columns={exportColumns}
            data={rows}
          />
          <button
            onClick={fetchBalances}
            className="p-2 text-slate-600 hover:text-teal-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Card on Sekuensial Deduction & Rollover */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <span className="font-bold text-blue-950">Aturan Pengurangan Saldo Sekuensial & Rollover:</span>
          <p>
            Cuti tahunan yang diambil pegawai dipotong otomatis berurutan dari <strong>N-2</strong>{' '}
            (sisa 2 tahun lalu), jika habis dari <strong>N-1</strong> (sisa 1 tahun lalu), lalu{' '}
            <strong>N</strong> (tahun berjalan). Setiap 1 Januari sistem melakukan rollover otomatis: sisa
            N-2 hangus, N-1 menjadi N-2, N menjadi N-1, dan jatah N baru ditambahkan.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari Nama / NIP Pegawai..."
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-700">Tahun:</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800 bg-slate-50"
            >
              <option value={currentYear}>{currentYear}</option>
              <option value={currentYear - 1}>{currentYear - 1}</option>
              <option value={currentYear - 2}>{currentYear - 2}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 bg-slate-50"
            >
              <option value="ALL">Semua Sub Bagian</option>
              {subBagianList.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
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
                <th className="px-4 py-3 font-semibold">Nama Pegawai & NIP</th>
                <th className="px-4 py-3 font-semibold">Sub Bagian & Jabatan</th>
                <th className="px-4 py-3 font-semibold text-center text-amber-700 bg-amber-50/50">
                  N-2 ({selectedYear - 2})
                </th>
                <th className="px-4 py-3 font-semibold text-center text-indigo-700 bg-indigo-50/50">
                  N-1 ({selectedYear - 1})
                </th>
                <th className="px-4 py-3 font-semibold text-center text-emerald-700 bg-emerald-50/50">
                  N ({selectedYear})
                </th>
                <th className="px-4 py-3 font-bold text-center bg-slate-100 text-slate-900">
                  Total Sisa
                </th>
                <th className="px-4 py-3 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Memuat saldo cuti pegawai...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada pegawai ditemukan.
                  </td>
                </tr>
              ) : (
                rows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{row.nama_lengkap}</div>
                      <div className="text-[11px] font-mono text-slate-400">{row.nip_nik}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800">{row.sub_bagian || row.unit_kerja}</div>
                      <div className="text-[11px] text-slate-500">{row.jabatan}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-amber-700 bg-amber-50/20">
                      {row.n_2} Hari
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-indigo-700 bg-indigo-50/20">
                      {row.n_1} Hari
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-emerald-700 bg-emerald-50/20">
                      {row.n} Hari
                    </td>
                    <td className="px-4 py-3 text-center font-black text-sm bg-slate-50 text-slate-900">
                      {row.total} Hari
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:text-red-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Koreksi / Sesuaikan Saldo Manual"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Sesuaikan</span>
                        </button>
                        <button
                          onClick={() => openHistoryModal(row)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Lihat Histori Mutasi Saldo"
                        >
                          <History className="w-4 h-4" />
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

      {/* MODAL ADJUST SALDO */}
      {editingEmp && (
        <Modal
          isOpen={true}
          onClose={() => setEditingEmp(null)}
          title={`Penyesuaian Saldo Cuti Manual: ${editingEmp.nama_lengkap}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Tahun Kalender: {selectedYear}</span>
              <span className="font-bold text-slate-900 text-sm">{editingEmp.nama_lengkap}</span>
              <span className="block font-mono text-slate-500 text-[11px]">{editingEmp.nip_nik}</span>
            </div>

            {adjustError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-xl text-xs font-medium">
                {adjustError}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                  N-2 ({selectedYear - 2})
                </label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={formN2}
                  onChange={e => setFormN2(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-center focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-indigo-800 mb-1">
                  N-1 ({selectedYear - 1})
                </label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={formN1}
                  onChange={e => setFormN1(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-center focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-emerald-800 mb-1">
                  N ({selectedYear})
                </label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={formN}
                  onChange={e => setFormN(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-100 rounded-xl flex items-center justify-between font-semibold text-slate-800">
              <span>Total Saldo Baru:</span>
              <span className="text-sm font-black text-red-700">{formN2 + formN1 + formN} Hari</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Alasan Penyesuaian <span className="text-rose-600">*</span> (Wajib dicatat di Audit Log):
              </label>
              <textarea
                rows={3}
                required
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                placeholder="Contoh: Koreksi pembatalan tugas dinas, instruksi Sekretaris KPU No..."
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingEmp(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveAdjustment}
                className="px-4 py-2 text-xs font-semibold text-white bg-linear-to-r from-emerald-800 via-teal-700 to-sky-700 hover:opacity-95 rounded-xl shadow-xs transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL TRANSACTION HISTORY */}
      {historyEmp && (
        <Modal
          isOpen={true}
          onClose={() => setHistoryEmp(null)}
          title={`Histori Mutasi Saldo: ${historyEmp.nama_lengkap}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">{historyEmp.nama_lengkap}</span>
                <span className="font-mono text-slate-500 text-[11px]">{historyEmp.nip_nik}</span>
              </div>
              <span className="font-bold text-emerald-700 text-xs bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Saldo Aktif: {historyEmp.total} Hari
              </span>
            </div>

            {historyLoading ? (
              <div className="py-8 text-center text-slate-400">Memuat log transaksi saldo...</div>
            ) : transactions.length === 0 ? (
              <div className="py-8 text-center text-slate-400">Belum ada riwayat transaksi saldo.</div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2">
                {transactions.map(t => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                          t.type === 'DEDUCTION'
                            ? 'bg-rose-100 text-rose-800'
                            : t.type === 'ROLLOVER'
                            ? 'bg-purple-100 text-purple-800'
                            : t.type === 'ADJUSTMENT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {t.type}
                      </span>
                      <span className="text-slate-400 text-[10px] font-mono">
                        {new Date(t.timestamp).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <p className="text-slate-700 font-medium">{t.alasan}</p>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Sebelum:</span>
                        <span>
                          N-2: {t.n_2_sebelum} | N-1: {t.n_1_sebelum} | N: {t.n_sebelum} (Total: {t.total_sebelum})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Sesudah:</span>
                        <span className="font-semibold text-slate-900">
                          N-2: {t.n_2_sesudah} | N-1: {t.n_1_sesudah} | N: {t.n_sesudah} (Total: {t.total_sesudah})
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setHistoryEmp(null)}
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
