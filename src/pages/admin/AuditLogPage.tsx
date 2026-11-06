import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { AuditLog } from '../../types';
import {
  Shield,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Eye,
  Activity
} from 'lucide-react';
import { Modal } from '../../components/Modal';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs({
        limit: 100,
        module: moduleFilter !== 'ALL' ? moduleFilter : undefined,
        action: actionFilter !== 'ALL' ? actionFilter : undefined
      });
      setLogs(res.logs || []);
    } catch (e) {
      console.error('Error fetching audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter, actionFilter]);

  const filteredLogs = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.user_nama?.toLowerCase().includes(q) ||
      l.username?.toLowerCase().includes(q) ||
      l.employee_nama?.toLowerCase().includes(q) ||
      l.employee_nip?.toLowerCase().includes(q) ||
      l.keterangan?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.module?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Audit Trail & Log Aktivitas Sistem
          </h2>
          <p className="text-xs text-slate-500">
            Rekam jejak setiap perubahan data penting, mutasi saldo cuti, approval, dan aktivitas administratif
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 text-slate-600 hover:text-teal-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari user / aksi / keterangan..."
            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
          />
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 bg-slate-50"
          >
            <option value="ALL">Semua Modul</option>
            <option value="AUTH">AUTH (Autentikasi)</option>
            <option value="CUTI">CUTI (Pengajuan & Saldo)</option>
            <option value="ABSENSI">ABSENSI (Kehadiran)</option>
            <option value="PEGAWAI">PEGAWAI (Master Data)</option>
            <option value="SISTEM">SISTEM (Pengaturan)</option>
          </select>
        </div>

        <div>
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 bg-slate-50"
          >
            <option value="ALL">Semua Tipe Aksi</option>
            <option value="LOGIN">LOGIN</option>
            <option value="APPROVE_LEAVE">APPROVE_LEAVE</option>
            <option value="REJECT_LEAVE">REJECT_LEAVE</option>
            <option value="ADJUST_BALANCE">ADJUST_BALANCE</option>
            <option value="ROLLOVER_MANUAL">ROLLOVER_MANUAL</option>
            <option value="CREATE_EMPLOYEE">CREATE_EMPLOYEE</option>
            <option value="UPDATE_EMPLOYEE">UPDATE_EMPLOYEE</option>
            <option value="RESET_PASSWORD">RESET_PASSWORD</option>
            <option value="UPDATE_SETTINGS">UPDATE_SETTINGS</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Waktu Kejadian</th>
                <th className="px-4 py-3 font-semibold">Pengguna (Aktor)</th>
                <th className="px-4 py-3 font-semibold">Modul</th>
                <th className="px-4 py-3 font-semibold">Aksi</th>
                <th className="px-4 py-3 font-semibold">Rincian Aktivitas</th>
                <th className="px-4 py-3 font-semibold">IP Address</th>
                <th className="px-4 py-3 font-semibold text-center">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Memuat log audit...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada catatan aktivitas audit.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {new Date(l.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{l.user_nama || l.username}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {l.employee_nip ? (
                          <span className="text-[10px] text-slate-500 font-mono">NIP: {l.employee_nip}</span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">user: {l.username}</span>
                        )}
                        {l.user_role && l.user_role !== 'pegawai' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                            {l.user_role.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                        {l.module}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                      {l.action}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                      {l.keterangan}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {l.ip_address || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(l.old_value || l.new_value) && (
                        <button
                          onClick={() => setSelectedLog(l)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                          title="Lihat Data Perubahan (Diff)"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Detail Log Audit: ${selectedLog.action}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-slate-600">Aktor / Pelaku:</span>
                <div className="text-right">
                  <div className="font-bold text-slate-900">{selectedLog.user_nama || selectedLog.username}</div>
                  {selectedLog.employee_nip && (
                    <div className="text-[11px] font-mono text-slate-500">NIP: {selectedLog.employee_nip}</div>
                  )}
                  {selectedLog.user_role && (
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                      {selectedLog.user_role.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-600">Waktu:</span>
                <span className="font-mono">{new Date(selectedLog.timestamp).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-600">Keterangan:</span>
                <span>{selectedLog.keterangan}</span>
              </div>
            </div>

            {selectedLog.old_value && (
              <div>
                <span className="font-semibold text-rose-700 block mb-1">Nilai Lama (Old Value):</span>
                <pre className="p-2.5 bg-rose-50 border border-rose-200 text-rose-950 rounded-xl font-mono text-[11px] overflow-x-auto max-h-40">
                  {selectedLog.old_value}
                </pre>
              </div>
            )}

            {selectedLog.new_value && (
              <div>
                <span className="font-semibold text-emerald-700 block mb-1">Nilai Baru (New Value):</span>
                <pre className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl font-mono text-[11px] overflow-x-auto max-h-40">
                  {selectedLog.new_value}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
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
