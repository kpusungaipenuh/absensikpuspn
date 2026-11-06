import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LeaveBalance, LeaveBalanceTransaction, Employee } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  WalletCards,
  History,
  ShieldCheck,
  Calendar,
  RefreshCw,
  Clock,
  ArrowRight,
  UserCheck
} from 'lucide-react';

export const SaldoCutiPegawai: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [transactions, setTransactions] = useState<LeaveBalanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBalanceForEmp = async (empId?: string) => {
    try {
      const res = await api.getMyLeaveBalance(undefined, empId);
      if (res) {
        setBalance(res.balance || null);
        setTransactions(res.transactions || []);
      }
    } catch (e: any) {
      console.warn('Notice fetching leave balance & transactions:', e?.message || e);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      let targetEmpId = selectedEmpId;
      if (isAdmin) {
        try {
          const empRes = await api.getEmployees({ status: 'aktif' });
          const emps = empRes.employees || [];
          setEmployees(emps);
          if (!targetEmpId && emps.length > 0) {
            targetEmpId = emps[0].id;
            setSelectedEmpId(targetEmpId);
          }
        } catch (err) {
          console.warn('Notice loading employee list:', err);
        }
      }

      const res = await api.getMyLeaveBalance(undefined, isAdmin && targetEmpId ? targetEmpId : undefined).catch(() => null);
      if (res) {
        setBalance(res.balance || null);
        setTransactions(res.transactions || []);
      }
    } catch (e: any) {
      console.warn('Notice fetching my leave balance & transactions:', e?.message || e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedEmpId(newId);
    fetchBalanceForEmp(newId);
  };

  const totalSaldo = (balance?.n_2 || 0) + (balance?.n_1 || 0) + (balance?.n || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {isAdmin ? 'Informasi Saldo & Mutasi Cuti Pegawai' : 'Informasi Saldo & Mutasi Cuti Tahunan Anda'}
          </h2>
          <p className="text-xs text-slate-500">
            Rincian akumulasi hak cuti berjalan (Tahun {balance?.tahun || new Date().getFullYear()}) dengan catatan mutasi transparan
          </p>
        </div>

        <button
          onClick={fetchData}
          className="p-2 text-slate-600 hover:text-red-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Admin Employee Switcher */}
      {isAdmin && (
        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900 text-xs">
            <UserCheck className="w-4 h-4 text-amber-700" />
            <span>Pilih Pegawai untuk Melihat Rincian Saldo & Mutasi (Mode Administrator):</span>
          </div>
          <select
            id="admin-select-employee-saldo"
            value={selectedEmpId}
            onChange={handleEmployeeChange}
            className="w-full sm:w-auto min-w-[320px] px-3 py-2 border border-amber-300 rounded-lg bg-white font-medium text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          >
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.nama_lengkap} — NIP: {emp.nip_nik} ({emp.jabatan})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Saldo Cards (N-2, N-1, N, Total) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              N-2 ({balance?.tahun ? balance.tahun - 2 : ''})
            </span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              Hangus Akhir Tahun
            </span>
          </div>
          <div className="text-3xl font-black text-amber-900 pt-2">{balance?.n_2 || 0} Hari</div>
          <p className="text-[11px] text-amber-700 pt-1">
            Prioritas pemotongan pertama saat mengajukan cuti tahunan.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
              N-1 ({balance?.tahun ? balance.tahun - 1 : ''})
            </span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
              Sisa Thn Kemarin
            </span>
          </div>
          <div className="text-3xl font-black text-indigo-900 pt-2">{balance?.n_1 || 0} Hari</div>
          <p className="text-[11px] text-indigo-700 pt-1">
            Dipakai jika saldo N-2 telah habis, digeser ke N-2 pada 1 Januari berikutnya.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              N ({balance?.tahun || ''})
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              Tahun Berjalan
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-900 pt-2">{balance?.n || 0} Hari</div>
          <p className="text-[11px] text-emerald-700 pt-1">
            Jatah cuti pokok tahun berjalan (12 hari).
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-red-300 bg-red-50/30 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider">
              Total Sisa Saldo
            </span>
            <span className="text-[10px] font-bold text-white bg-red-700 px-2 py-0.5 rounded-full">
              Aktif
            </span>
          </div>
          <div className="text-3xl font-black text-red-700 pt-2">{totalSaldo} Hari</div>
          <p className="text-[11px] text-red-600 font-medium pt-1">
            Akumulasi hak cuti tahunan yang dapat Anda pergunakan.
          </p>
        </div>
      </div>

      {/* Audit Log / Transaction History */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-red-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Buku Mutasi Saldo Cuti Pegawai
            </h4>
          </div>
          <span className="text-xs text-slate-500">{transactions.length} Transaksi Tercatat</span>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Memuat mutasi saldo...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Belum ada catatan mutasi saldo.</div>
          ) : (
            transactions.map(t => (
              <div key={t.id} className="p-4 hover:bg-slate-50/70 transition-colors text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                        t.type === 'DEDUCTION'
                          ? 'bg-rose-100 text-rose-800'
                          : t.type === 'ROLLOVER'
                          ? 'bg-purple-100 text-purple-800'
                          : t.type === 'ADJUSTMENT'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {t.type}
                    </span>
                    <span className="font-semibold text-slate-900">{t.alasan}</span>
                  </div>

                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(t.timestamp).toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Saldo Sebelumnya:</span>
                    <span className="text-slate-700">
                      N-2: <strong>{t.n_2_sebelum}</strong> | N-1: <strong>{t.n_1_sebelum}</strong> | N:{' '}
                      <strong>{t.n_sebelum}</strong> (Total: {t.total_sebelum} Hari)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Saldo Sesudahnya:</span>
                    <span className="text-slate-900 font-semibold">
                      N-2: <strong>{t.n_2_sesudah}</strong> | N-1: <strong>{t.n_1_sesudah}</strong> | N:{' '}
                      <strong>{t.n_sesudah}</strong> (Total: {t.total_sesudah} Hari)
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
