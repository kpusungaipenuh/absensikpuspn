import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSubBagianList } from '../../utils/subBagian';
import {
  FileSpreadsheet,
  Filter,
  RefreshCw,
  BarChart3,
  Calendar,
  Layers
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { ExportButtons } from '../../components/ExportButtons';

export const RekapPenggunaanCuti: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const subBagianList = useSubBagianList();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchRekap = async () => {
    try {
      setLoading(true);
      const res = await api.getRekapPenggunaanCuti({
        year: selectedYear,
        unit: unitFilter !== 'ALL' ? unitFilter : undefined
      });
      setData(res);
    } catch (e) {
      console.error('Error fetching rekap penggunaan cuti:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRekap();
  }, [selectedYear, unitFilter]);

  const { rows = [], summaryByType = {}, monthlyUsage = [] } = data || {};

  const exportColumns = [
    { header: 'Nama Pegawai', key: 'nama_lengkap' },
    { header: 'NIP/NIK', key: 'nip_nik' },
    { header: 'Sub Bagian', key: 'unit_kerja' },
    { header: 'Jabatan', key: 'jabatan' },
    { header: 'Cuti Tahunan (Hari)', key: 'cuti_tahunan' },
    { header: 'Cuti Besar (Hari)', key: 'cuti_besar' },
    { header: 'Cuti Sakit (Hari)', key: 'cuti_sakit' },
    { header: 'Cuti Melahirkan (Hari)', key: 'cuti_melahirkan' },
    { header: 'Cuti Alasan Penting (Hari)', key: 'cuti_alasan_penting' },
    { header: 'Cuti Luar Tanggungan (Hari)', key: 'cuti_luar_tanggungan' },
    { header: 'Total Penggunaan (Hari)', key: 'total_penggunaan' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Rekapitulasi Penggunaan Cuti Pegawai
          </h2>
          <p className="text-xs text-slate-500">
            Analisis penggunaan hak cuti di 6 kategori cuti resmi KPU Kota Sungai Penuh Tahun {selectedYear}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ExportButtons
            title={`REKAPITULASI PENGGUNAAN CUTI PEGAWAI KPU KOTA SUNGAI PENUH TAHUN ${selectedYear}`}
            filename={`Rekap_Penggunaan_Cuti_${selectedYear}`}
            columns={exportColumns}
            data={rows}
          />
          <button
            onClick={fetchRekap}
            className="p-2 text-slate-600 hover:text-red-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-4 text-xs">
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
          <span className="font-semibold text-slate-700">Sub Bagian:</span>
          <select
            value={unitFilter}
            onChange={e => setUnitFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 bg-slate-50"
          >
            <option value="ALL">Semua Sub Bagian</option>
            {subBagianList.map(sub => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards by 6 Leave Types */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-700">Cuti Tahunan</div>
          <div className="text-xl font-bold text-blue-900 mt-1">{summaryByType.cuti_tahunan || 0}</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Hari terpakai</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs">
          <div className="text-[11px] font-semibold text-purple-700">Cuti Besar</div>
          <div className="text-xl font-bold text-purple-900 mt-1">{summaryByType.cuti_besar || 0}</div>
          <div className="text-[10px] text-purple-600 mt-0.5">Hari terpakai</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-700">Cuti Sakit</div>
          <div className="text-xl font-bold text-amber-900 mt-1">{summaryByType.cuti_sakit || 0}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Hari terpakai</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-pink-200 bg-pink-50/20 shadow-xs">
          <div className="text-[11px] font-semibold text-pink-700">Cuti Melahirkan</div>
          <div className="text-xl font-bold text-pink-900 mt-1">{summaryByType.cuti_melahirkan || 0}</div>
          <div className="text-[10px] text-pink-600 mt-0.5">Hari terpakai</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-teal-200 bg-teal-50/20 shadow-xs">
          <div className="text-[11px] font-semibold text-teal-700">Cuti Alasan Penting</div>
          <div className="text-xl font-bold text-teal-900 mt-1">{summaryByType.cuti_alasan_penting || 0}</div>
          <div className="text-[10px] text-teal-600 mt-0.5">Hari terpakai</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-700">Luar Tanggungan</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{summaryByType.cuti_luar_tanggungan || 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Hari terpakai</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-red-300 bg-red-50/30 shadow-xs">
          <div className="text-[11px] font-bold text-red-700 uppercase">Grand Total</div>
          <div className="text-xl font-bold text-red-700 mt-1">{summaryByType.grand_total || 0}</div>
          <div className="text-[10px] text-red-600 font-semibold mt-0.5">Hari Seluruh Cuti</div>
        </div>
      </div>

      {/* Monthly Distribution Chart */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h4 className="text-sm font-bold text-slate-800 mb-1">
          Distribusi Penggunaan Cuti Per Bulan (Tahun {selectedYear})
        </h4>
        <p className="text-xs text-slate-500 mb-4">Total akumulasi hari cuti yang diambil per bulan</p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyUsage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
              <Bar dataKey="total" fill="#dc2626" name="Total Hari Cuti" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Rincian Penggunaan Cuti Per Pegawai
          </h4>
          <span className="text-xs text-slate-500">{rows.length} Pegawai Aktif</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Nama Pegawai & NIP</th>
                <th className="px-4 py-3 font-semibold">Sub Bagian</th>
                <th className="px-3 py-3 font-semibold text-center text-blue-700">Tahunan</th>
                <th className="px-3 py-3 font-semibold text-center text-purple-700">Besar</th>
                <th className="px-3 py-3 font-semibold text-center text-amber-700">Sakit</th>
                <th className="px-3 py-3 font-semibold text-center text-pink-700">Melahirkan</th>
                <th className="px-3 py-3 font-semibold text-center text-teal-700">Alasan Penting</th>
                <th className="px-3 py-3 font-semibold text-center text-slate-600">Luar Tanggungan</th>
                <th className="px-4 py-3 font-semibold text-center bg-slate-100 text-red-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Memuat rekapitulasi...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada data pegawai.
                  </td>
                </tr>
              ) : (
                rows.map((row: any) => (
                  <tr key={row.employee_id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <div>{row.nama_lengkap}</div>
                      <div className="text-[11px] font-mono text-slate-400 font-normal">{row.nip_nik}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.unit_kerja}</td>
                    <td className="px-3 py-3 text-center font-medium text-blue-700">{row.cuti_tahunan}</td>
                    <td className="px-3 py-3 text-center font-medium text-purple-700">{row.cuti_besar}</td>
                    <td className="px-3 py-3 text-center font-medium text-amber-700">{row.cuti_sakit}</td>
                    <td className="px-3 py-3 text-center font-medium text-pink-700">{row.cuti_melahirkan}</td>
                    <td className="px-3 py-3 text-center font-medium text-teal-700">{row.cuti_alasan_penting}</td>
                    <td className="px-3 py-3 text-center font-medium text-slate-600">{row.cuti_luar_tanggungan}</td>
                    <td className="px-4 py-3 text-center font-bold bg-slate-50 text-red-700">
                      {row.total_penggunaan} Hari
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
