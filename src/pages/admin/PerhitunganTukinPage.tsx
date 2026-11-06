import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { TukinCalculationItem, TukinGrade } from '../../types';
import {
  Coins,
  Calculator,
  Calendar,
  Building2,
  TrendingDown,
  Users,
  Download,
  Printer,
  RefreshCw,
  Search,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Edit2,
  BarChart3,
  Award,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import { Modal } from '../../components/Modal';

export const PerhitunganTukinPage: React.FC = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [activeTab, setActiveTab] = useState<'rekap' | 'chart' | 'grades'>('rekap');
  const [chartMetric, setChartMetric] = useState<'nominal' | 'average' | 'discipline'>('nominal');

  const [loading, setLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Calculations state
  const [summary, setSummary] = useState({
    totalPegawai: 0,
    totalBruto: 0,
    totalPotongan: 0,
    totalNetto: 0
  });
  const [calculations, setCalculations] = useState<TukinCalculationItem[]>([]);

  // Grades state
  const [grades, setGrades] = useState<TukinGrade[]>([]);
  const [editingGrade, setEditingGrade] = useState<TukinGrade | null>(null);
  const [editBesaran, setEditBesaran] = useState<number>(0);
  const [editKeterangan, setEditKeterangan] = useState<string>('');
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  // Detail Modal
  const [selectedDetail, setSelectedDetail] = useState<TukinCalculationItem | null>(null);

  // Aggregated Tukin per Department for Bar Chart
  const departmentData = useMemo(() => {
    const map = new Map<string, {
      department: string;
      totalPegawai: number;
      totalBruto: number;
      totalPotongan: number;
      totalNetto: number;
      totalPotonganPersen: number;
    }>();

    for (const c of calculations) {
      const dept = c.unit_kerja?.trim() || 'Sekretariat';
      const existing = map.get(dept) || {
        department: dept,
        totalPegawai: 0,
        totalBruto: 0,
        totalPotongan: 0,
        totalNetto: 0,
        totalPotonganPersen: 0
      };
      existing.totalPegawai += 1;
      existing.totalBruto += (c.tukin_dasar || c.tukin_bruto || 0);
      existing.totalPotongan += (c.total_potongan_rupiah || 0);
      existing.totalNetto += (c.tukin_bersih || c.tukin_netto || 0);
      existing.totalPotonganPersen += (c.total_potongan_persen || 0);
      map.set(dept, existing);
    }

    return Array.from(map.values()).map(d => {
      let short = d.department;
      if (short.length > 20) {
        short = short
          .replace(/Sub\s*bagian\s*/i, '')
          .replace(/Bagian\s*/i, '')
          .replace(/Dan\s*/gi, '& ')
          .trim();
        if (short.length > 20) {
          short = short.substring(0, 18) + '...';
        }
      }

      return {
        department: d.department,
        shortName: short,
        totalPegawai: d.totalPegawai,
        totalBruto: d.totalBruto,
        totalPotongan: d.totalPotongan,
        totalNetto: d.totalNetto,
        avgNetto: d.totalPegawai > 0 ? Math.round(d.totalNetto / d.totalPegawai) : 0,
        avgPotonganPersen: d.totalPegawai > 0 ? Number((d.totalPotonganPersen / d.totalPegawai).toFixed(2)) : 0,
        persentasePencairan: d.totalBruto > 0 ? Number(((d.totalNetto / d.totalBruto) * 100).toFixed(1)) : 100
      };
    }).sort((a, b) => b.totalNetto - a.totalNetto);
  }, [calculations]);

  // Insights / highlights per department
  const highestDept = departmentData[0];
  const lowestPenaltyDept = departmentData.length > 0
    ? [...departmentData].sort((a, b) => a.avgPotonganPersen - b.avgPotonganPersen)[0]
    : null;

  const fetchCalculations = async () => {
    try {
      setLoading(true);
      const res = await api.getTukinCalculations(selectedMonth, selectedYear);
      setSummary(res.summary);
      setCalculations(res.calculations || []);
    } catch (err) {
      console.error('Error fetching tukin calculations:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGrades = async () => {
    try {
      const res = await api.getTukinGrades();
      setGrades(res.grades || []);
    } catch (err) {
      console.error('Error fetching tukin grades:', err);
    }
  };

  useEffect(() => {
    fetchCalculations();
    fetchGrades();
  }, [selectedMonth, selectedYear]);

  const handleRecalculate = async () => {
    try {
      setIsRecalculating(true);
      const res = await api.recalculateTukin(selectedMonth, selectedYear);
      setSummary(res.summary);
      setCalculations(res.calculations || []);
      alert(`Sinkronisasi Selesai!\n\n${res.message || 'Perhitungan Tukin berhasil diperbarui berdasarkan seluruh data presensi, keterlambatan, dan jam kerja pegawai.'}`);
    } catch (err: any) {
      alert(err.message || 'Gagal menghitung ulang Tukin.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleOpenEditGrade = (grade: TukinGrade) => {
    setEditingGrade(grade);
    setEditBesaran(grade.besaran_dasar);
    setEditKeterangan(grade.keterangan || '');
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGrade) return;
    try {
      setIsSavingGrade(true);
      await api.updateTukinGrade(editingGrade.id, {
        besaran_dasar: editBesaran,
        keterangan: editKeterangan
      });
      alert(`Standar Tukin untuk ${editingGrade.kategori} berhasil diperbarui.`);
      setEditingGrade(null);
      await fetchGrades();
      await fetchCalculations();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan perubahan grade.');
    } finally {
      setIsSavingGrade(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const header = 'NIP,Nama Pegawai,Jabatan,Kelas Jabatan,Tukin Dasar,Hari Kerja,Hadir,Dinas,Cuti,Alpa,Menit TL,Potongan TL (%),Menit PSW,Potongan PSW (%),Potongan TK (%),Total Potongan (%),Nilai Potongan (Rp),Tukin Bersih (Rp)\n';
    const rows = calculations.map(c =>
      `"${c.nip_nik || ''}","${c.nama_lengkap}","${c.jabatan}","${c.kelas_jabatan}","${c.tukin_dasar}","${c.hari_kerja_efektif}","${c.hari_hadir}","${c.hari_dinas}","${c.hari_cuti}","${c.hari_tk}","${c.total_tl_menit}","${c.potongan_tl_persen}","${c.total_psw_menit}","${c.potongan_psw_persen}","${c.potongan_tk_persen}","${c.total_potongan_persen}","${c.total_potongan_rupiah}","${c.tukin_bersih}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_tukin_kpu_${selectedMonth}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredCalculations = calculations.filter(c => {
    const q = searchTerm.toLowerCase();
    return (
      c.nama_lengkap.toLowerCase().includes(q) ||
      (c.nip_nik && c.nip_nik.toLowerCase().includes(q)) ||
      c.jabatan.toLowerCase().includes(q) ||
      c.unit_kerja.toLowerCase().includes(q)
    );
  });

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 mb-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>KPU Kota Sungai Penuh &bull; Subbagian Keuangan & SDM</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Perhitungan Tunjangan Kinerja (Tukin) ASN & PPNPN
          </h2>
          <p className="text-xs text-slate-500">
            Perhitungan otomatis potongan Tukin berdasarkan keterlambatan masuk (TL1-TL4), pulang cepat (PSW), dan tanpa keterangan (TK/Alpa).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            id="btn-hitung-ulang-tukin"
            type="button"
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Calculator className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span>{isRecalculating ? 'Menghitung...' : 'Hitung Ulang Tukin Otomatis'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={calculations.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-medium block">Total Pegawai Terhitung</span>
            <span className="text-xl font-bold text-slate-900 font-mono">{summary.totalPegawai} Orang</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-medium block">Total Tukin Bruto (Dasar)</span>
            <span className="text-lg font-bold text-slate-900 font-mono">
              Rp {summary.totalBruto.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-500 text-xs font-medium block">Total Potongan Disiplin</span>
            <span className="text-lg font-bold text-rose-700 font-mono">
              - Rp {summary.totalPotongan.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/30 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-emerald-900 text-xs font-medium block">Total Tukin Netto (Cair)</span>
            <span className="text-lg font-bold text-emerald-800 font-mono">
              Rp {summary.totalNetto.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('rekap')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rekap'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>1. Rekapitulasi Tukin Bulanan</span>
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'chart'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-teal-600" />
            <span>2. Diagram Tren per Departemen</span>
            <span className="px-1.5 py-0.2 bg-teal-100 text-teal-800 text-[10px] rounded-md font-bold">
              Recharts
            </span>
          </button>
          <button
            onClick={() => setActiveTab('grades')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'grades'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>3. Standar Grade & Tarif Dasar</span>
          </button>
        </div>

        {/* Month & Year Picker */}
        {(activeTab === 'rekap' || activeTab === 'chart') && (
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-700">Periode:</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="p-1.5 border border-slate-200 rounded-xl bg-slate-50 font-medium text-slate-800"
            >
              {monthNames.map((name, i) => (
                <option key={i} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="p-1.5 border border-slate-200 rounded-xl bg-slate-50 font-mono font-medium text-slate-800"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: REKAP TUKIN */}
      {activeTab === 'rekap' && (
        <div className="space-y-4">
          {/* Quick link banner to Bar Chart */}
          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-teal-950">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-teal-950">Diagram Batang Tukin per Departemen Siap Ditampilkan</h4>
                <p className="text-[11px] text-teal-800">
                  Visualisasikan perbandingan nominal bruto, potongan disiplin, dan netto cair antar {departmentData.length} departemen/subbagian.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('chart')}
              className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 self-end sm:self-center"
            >
              <span>Buka Diagram Batang Recharts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search box */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama pegawai, NIP, jabatan..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div className="text-slate-500">
              Menampilkan <strong className="text-slate-900 font-mono">{filteredCalculations.length}</strong> pegawai
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Pegawai & Jabatan</th>
                    <th className="px-4 py-3 font-semibold text-center">Kelas</th>
                    <th className="px-4 py-3 font-semibold text-right">Tukin Dasar</th>
                    <th className="px-4 py-3 font-semibold text-center">Hadir/Dinas/Cuti/TK</th>
                    <th className="px-4 py-3 font-semibold text-center">Pot. TL</th>
                    <th className="px-4 py-3 font-semibold text-center">Pot. PSW</th>
                    <th className="px-4 py-3 font-semibold text-center">Pot. TK</th>
                    <th className="px-4 py-3 font-semibold text-right">Total Potongan</th>
                    <th className="px-4 py-3 font-semibold text-right">Tukin Bersih</th>
                    <th className="px-4 py-3 font-semibold text-center">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                        Memuat data perhitungan Tukin...
                      </td>
                    </tr>
                  ) : filteredCalculations.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                        Belum ada kalkulasi Tukin pada periode ini. Klik tombol "Hitung Ulang Tukin Otomatis" di atas untuk memproses.
                      </td>
                    </tr>
                  ) : (
                    filteredCalculations.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{item.nama_lengkap}</div>
                          <div className="text-[11px] font-mono text-slate-400">{item.nip_nik || '-'}</div>
                          <div className="text-[10px] text-slate-600">{item.jabatan}</div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 font-mono">
                            Grade {item.kelas_jabatan}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                          Rp {Number(item.tukin_dasar).toLocaleString('id-ID')}
                        </td>

                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="font-mono text-[11px] text-slate-700 font-medium">
                            <span className="text-emerald-700 font-bold" title="Hadir">{item.hari_hadir}H</span> /{' '}
                            <span className="text-blue-700 font-bold" title="Dinas">{item.hari_dinas}D</span> /{' '}
                            <span className="text-purple-700 font-bold" title="Cuti">{item.hari_cuti}C</span> /{' '}
                            <span className="text-rose-700 font-bold" title="Alpa/TK">{item.hari_tk}TK</span>
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            dari {item.hari_kerja_efektif} hari kerja
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className={`font-mono font-bold ${item.potongan_tl_persen > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                            {item.potongan_tl_persen}%
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.total_tl_menit} mnt
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className={`font-mono font-bold ${item.potongan_psw_persen > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                            {item.potongan_psw_persen}%
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.total_psw_menit} mnt
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className={`font-mono font-bold ${item.potongan_tk_persen > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                            {item.potongan_tk_persen}%
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="font-mono font-bold text-rose-700">
                            - Rp {Number(item.total_potongan_rupiah).toLocaleString('id-ID')}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ({item.total_potongan_persen}%)
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="font-mono font-bold text-emerald-700 text-sm">
                            Rp {Number(item.tukin_bersih).toLocaleString('id-ID')}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedDetail(item)}
                            className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          >
                            Rincian
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DIAGRAM TREN TUKIN PER DEPARTEMEN (RECHARTS) */}
      {activeTab === 'chart' && (
        <div className="space-y-6">
          {/* Header & Metric Switcher */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Visualisasi Recharts
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Periode: <strong className="text-slate-800">{monthNames[selectedMonth - 1]} {selectedYear}</strong>
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight mt-1">
                Tren Tunjangan Kinerja (Tukin) per Departemen
              </h3>
              <p className="text-xs text-slate-500">
                Perbandingan alokasi Tukin bruto, pemotongan disiplin kehadiran, serta penerimaan netto antar subbagian kerja.
              </p>
            </div>

            {/* Metric Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start md:self-center">
              <button
                type="button"
                onClick={() => setChartMetric('nominal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  chartMetric === 'nominal'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nominal Tukin (Rp)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('average')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  chartMetric === 'average'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rata-Rata / Pegawai
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('discipline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  chartMetric === 'discipline'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Potongan Disiplin (%)
              </button>
            </div>
          </div>

          {/* Department Highlights */}
          {departmentData.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-slate-500 text-xs font-medium block">Total Departemen Terdata</span>
                  <span className="text-xl font-bold text-slate-900 font-mono block">
                    {departmentData.length} Subbagian
                  </span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Award className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-emerald-800 text-xs font-medium block">Alokasi Tukin Tertinggi</span>
                  <span className="text-sm font-bold text-slate-900 truncate block">
                    {highestDept ? highestDept.shortName : '-'}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700 font-semibold block">
                    Rp {highestDept ? highestDept.totalNetto.toLocaleString('id-ID') : '0'}
                  </span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-blue-200/80 bg-blue-50/20 shadow-xs flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-blue-800 text-xs font-medium block">Kepatuhan Disiplin Terbaik</span>
                  <span className="text-sm font-bold text-slate-900 truncate block">
                    {lowestPenaltyDept ? lowestPenaltyDept.shortName : '-'}
                  </span>
                  <span className="text-[11px] font-mono text-blue-700 font-semibold block">
                    Potongan: {lowestPenaltyDept ? `${lowestPenaltyDept.avgPotonganPersen}%` : '0%'}
                  </span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-xs flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Coins className="w-5 h-5" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-amber-900 text-xs font-medium block">Rata-Rata Tukin / Pegawai</span>
                  <span className="text-lg font-bold text-slate-900 font-mono block">
                    Rp {summary.totalPegawai > 0 ? Math.round(summary.totalNetto / summary.totalPegawai).toLocaleString('id-ID') : '0'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* DIAGRAM BATANG RECHARTS CONTAINER */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-slate-100 pb-4">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  {chartMetric === 'nominal' && 'Grafik Batang Perbandingan Tukin Bruto vs Potongan vs Netto per Departemen'}
                  {chartMetric === 'average' && 'Grafik Batang Rata-Rata Penerimaan Tukin Bersih per Pegawai per Departemen'}
                  {chartMetric === 'discipline' && 'Grafik Batang Rata-Rata Persentase Potongan Disiplin per Departemen'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Arahkan kursor (*hover*) pada diagram untuk melihat perincian lengkap nominal dan statistik pegawai.
                </p>
              </div>

              <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
                Satuan: {chartMetric === 'discipline' ? 'Persen (%)' : 'Rupiah (Rp)'}
              </div>
            </div>

            {departmentData.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                Belum ada data perhitungan Tukin pada periode ini. Klik "Hitung Ulang Tukin Otomatis" untuk memulai.
              </div>
            ) : (
              <div className="w-full h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData} margin={{ top: 20, right: 30, left: 15, bottom: 65 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="shortName"
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      height={65}
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => {
                        if (chartMetric === 'discipline') return `${v}%`;
                        if (v >= 1000000) return `${(v / 1000000).toFixed(0)} Jt`;
                        if (v >= 1000) return `${(v / 1000).toFixed(0)} Rb`;
                        return `${v}`;
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 text-xs min-w-[240px] space-y-2">
                              <div className="border-b border-slate-700 pb-1.5">
                                <div className="font-bold text-slate-100 text-sm leading-tight">{item.department}</div>
                                <div className="text-[11px] text-teal-400 font-mono mt-0.5">
                                  👥 {item.totalPegawai} Pegawai Terdata
                                </div>
                              </div>
                              <div className="space-y-1 text-[11px]">
                                <div className="flex justify-between items-center text-sky-300">
                                  <span>Tukin Bruto (Dasar):</span>
                                  <span className="font-mono font-bold">Rp {item.totalBruto.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between items-center text-rose-300">
                                  <span>Potongan Disiplin:</span>
                                  <span className="font-mono font-bold">- Rp {item.totalPotongan.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between items-center text-emerald-400 font-bold pt-1 border-t border-slate-800">
                                  <span>Tukin Netto (Cair):</span>
                                  <span className="font-mono text-sm">Rp {item.totalNetto.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800">
                                  <span>Rata-Rata Netto / Pegawai:</span>
                                  <span className="font-mono font-semibold">Rp {item.avgNetto.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between items-center text-amber-300">
                                  <span>Rata-Rata Potongan:</span>
                                  <span className="font-mono font-bold">{item.avgPotonganPersen}%</span>
                                </div>
                                <div className="flex justify-between items-center text-teal-300">
                                  <span>Rasio Realisasi:</span>
                                  <span className="font-mono font-bold">{item.persentasePencairan}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 10, fontSize: '12px' }} />

                    {chartMetric === 'nominal' && (
                      <>
                        <Bar dataKey="totalBruto" name="Tukin Bruto (Dasar)" fill="#0284C7" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="totalPotongan" name="Potongan Disiplin" fill="#E11D48" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="totalNetto" name="Tukin Netto (Cair)" fill="#059669" radius={[6, 6, 0, 0]} />
                      </>
                    )}

                    {chartMetric === 'average' && (
                      <Bar dataKey="avgNetto" name="Rata-Rata Netto / Pegawai" fill="#0D9488" radius={[8, 8, 0, 0]}>
                        {departmentData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={['#0D9488', '#0284C7', '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B'][index % 6]}
                          />
                        ))}
                      </Bar>
                    )}

                    {chartMetric === 'discipline' && (
                      <Bar dataKey="avgPotonganPersen" name="Rata-rata Potongan Disiplin (%)" fill="#F59E0B" radius={[8, 8, 0, 0]}>
                        {departmentData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.avgPotonganPersen > 5 ? '#E11D48' : entry.avgPotonganPersen > 2 ? '#F59E0B' : '#10B981'}
                          />
                        ))}
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* TABEL KOMPARASI DEPARTEMEN */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-900">Rincian Komparasi Tukin per Subbagian / Departemen</h4>
                <p className="text-[11px] text-slate-500">Urutan berdasarkan total Tukin Netto yang diterima</p>
              </div>
              <span className="text-xs font-semibold text-slate-600 font-mono">
                {departmentData.length} Departemen
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-center">No</th>
                    <th className="px-4 py-3">Departemen / Sub Bagian</th>
                    <th className="px-4 py-3 text-center">Jumlah Pegawai</th>
                    <th className="px-4 py-3 text-right">Tukin Bruto (Rp)</th>
                    <th className="px-4 py-3 text-right text-rose-700">Potongan Disiplin (Rp)</th>
                    <th className="px-4 py-3 text-right text-emerald-800">Tukin Netto (Rp)</th>
                    <th className="px-4 py-3 text-right">Rata-Rata / Pegawai</th>
                    <th className="px-4 py-3 text-center">Rata-Rata Potongan</th>
                    <th className="px-4 py-3 text-center">Realisasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departmentData.map((d, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{d.department}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                        {d.totalPegawai} Org
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                        Rp {d.totalBruto.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-rose-600">
                        - Rp {d.totalPotongan.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                        Rp {d.totalNetto.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        Rp {d.avgNetto.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.avgPotonganPersen > 5
                            ? 'bg-rose-100 text-rose-800'
                            : d.avgPotonganPersen > 2
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {d.avgPotonganPersen}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-teal-800">
                        {d.persentasePencairan}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-slate-900 uppercase tracking-wider text-[11px]">
                      TOTAL KESELURUHAN KPU
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-900">
                      {summary.totalPegawai} Org
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900">
                      Rp {summary.totalBruto.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-700">
                      - Rp {summary.totalPotongan.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-800 text-sm font-extrabold">
                      Rp {summary.totalNetto.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-900">
                      Rp {summary.totalPegawai > 0 ? Math.round(summary.totalNetto / summary.totalPegawai).toLocaleString('id-ID') : '0'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      {summary.totalBruto > 0 ? ((summary.totalPotongan / summary.totalBruto) * 100).toFixed(2) : 0}%
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-teal-800">
                      {summary.totalBruto > 0 ? ((summary.totalNetto / summary.totalBruto) * 100).toFixed(1) : 100}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STANDAR GRADE & TARIF TUKIN */}
      {activeTab === 'grades' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-900 leading-relaxed">
            ℹ️ <strong>Ketentuan Besaran Dasar Tunjangan Kinerja (Tukin):</strong> Besaran dasar disesuaikan dengan Keputusan KPU RI dan Kelas Jabatan struktural, fungsional, dan pelaksana pada Satker KPU Kota Sungai Penuh.
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Kelas Jabatan</th>
                  <th className="px-4 py-3 font-semibold">Kategori / Nomenklatur Jabatan</th>
                  <th className="px-4 py-3 font-semibold text-right">Besaran Dasar (Rp)</th>
                  <th className="px-4 py-3 font-semibold">Keterangan</th>
                  <th className="px-4 py-3 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grades.map(g => (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      Grade {g.kelas_jabatan}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {g.kategori}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800 text-sm">
                      Rp {Number(g.besaran_dasar).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {g.keterangan || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEditGrade(g)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1 mx-auto cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Tarif</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL EDIT GRADE */}
      {editingGrade && (
        <Modal
          isOpen={true}
          onClose={() => setEditingGrade(null)}
          title={`Ubah Standar Tukin Grade ${editingGrade.kelas_jabatan} (${editingGrade.kategori})`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveGrade} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kategori Jabatan:
              </label>
              <input
                type="text"
                disabled
                value={editingGrade.kategori}
                className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Besaran Dasar Tukin (Rp) <span className="text-red-600">*</span>:
              </label>
              <input
                type="number"
                required
                value={editBesaran}
                onChange={e => setEditBesaran(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Keterangan / Regulasi:
              </label>
              <textarea
                rows={2}
                value={editKeterangan}
                onChange={e => setEditKeterangan(e.target.value)}
                placeholder="Misal: Peraturan KPU RI No. 12 Tahun 2024"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingGrade(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingGrade}
                className="px-5 py-2 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs cursor-pointer"
              >
                {isSavingGrade ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL DETAIL BREAKDOWN */}
      {selectedDetail && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDetail(null)}
          title={`Rincian Potongan Tukin - ${selectedDetail.nama_lengkap}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="font-bold text-sm text-slate-900">{selectedDetail.nama_lengkap}</div>
              <div className="text-slate-500 font-mono">NIP: {selectedDetail.nip_nik || '-'}</div>
              <div className="text-slate-600">
                {selectedDetail.jabatan} &bull; <span className="font-bold text-amber-800">Grade {selectedDetail.kelas_jabatan}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              <div className="flex justify-between p-2.5 bg-slate-50 font-bold">
                <span>Komponen Tunjangan</span>
                <span>Nilai (Rp)</span>
              </div>
              <div className="flex justify-between p-2.5">
                <span>Tunjangan Kinerja Dasar (Bruto)</span>
                <span className="font-mono font-bold text-slate-900">
                  Rp {Number(selectedDetail.tukin_dasar).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between p-2.5 text-amber-900">
                <div>
                  <span>Keterlambatan Hadir (TL)</span>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Total: {selectedDetail.total_tl_menit} menit
                  </div>
                </div>
                <span className="font-mono font-bold">- {selectedDetail.potongan_tl_persen}%</span>
              </div>
              <div className="flex justify-between p-2.5 text-amber-900">
                <div>
                  <span>Pulang Sebelum Waktunya (PSW)</span>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Total: {selectedDetail.total_psw_menit} menit
                  </div>
                </div>
                <span className="font-mono font-bold">- {selectedDetail.potongan_psw_persen}%</span>
              </div>
              <div className="flex justify-between p-2.5 text-rose-900">
                <div>
                  <span>Tanpa Keterangan / Alpa (TK)</span>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Total: {selectedDetail.hari_tk} hari (3% per hari)
                  </div>
                </div>
                <span className="font-mono font-bold">- {selectedDetail.potongan_tk_persen}%</span>
              </div>
              <div className="flex justify-between p-2.5 bg-rose-50 text-rose-900 font-bold">
                <span>Total Akumulasi Potongan ({selectedDetail.total_potongan_persen}%)</span>
                <span className="font-mono">
                  - Rp {Number(selectedDetail.total_potongan_rupiah).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-emerald-50 text-emerald-950 font-bold text-sm">
                <span>Tukin Bersih Diterima (Netto)</span>
                <span className="font-mono text-emerald-800">
                  Rp {Number(selectedDetail.tukin_bersih).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
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
