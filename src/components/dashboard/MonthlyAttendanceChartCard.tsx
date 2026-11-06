import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  TrendingUp,
  Filter,
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';
import { AttendanceRecord } from '../../types';
import { api } from '../../services/api';

interface MonthlyAttendanceChartCardProps {
  /**
   * Optional pre-loaded attendance history
   */
  history?: AttendanceRecord[];
  /**
   * Employee ID if fetching for specific employee
   */
  employeeId?: string;
  /**
   * Title of the card
   */
  title?: string;
  /**
   * Compact styling for mobile or widgets
   */
  compact?: boolean;
  /**
   * Mode: 'employee' for personal stats, 'admin' for organization stats
   */
  mode?: 'employee' | 'admin';
  /**
   * Extra container class name
   */
  className?: string;
}

const INDO_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const INDO_FULL_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MonthlyAttendanceChartCard: React.FC<MonthlyAttendanceChartCardProps> = ({
  history: propHistory,
  employeeId,
  title = 'Statistik Presensi Bulanan',
  compact = false,
  mode = 'employee',
  className = ''
}) => {
  const [internalHistory, setInternalHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [period, setPeriod] = useState<'3m' | '6m' | '12m'>('6m');
  const [activeMetricFilter, setActiveMetricFilter] = useState<'all' | 'hadir' | 'terlambat' | 'cuti'>('all');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);

  // Load history if not provided via props
  useEffect(() => {
    if (propHistory && propHistory.length > 0) {
      setInternalHistory(propHistory);
      return;
    }

    let isMounted = true;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await api.getMyAttendanceHistory();
        if (isMounted && res.history) {
          setInternalHistory(res.history);
        }
      } catch (err) {
        console.warn('Gagal memuat riwayat presensi untuk grafik:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [propHistory]);

  const activeHistory = propHistory && propHistory.length > 0 ? propHistory : internalHistory;

  // Process data for monthly bar chart
  const { chartData, totals, currentMonthStats } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    const monthCount = period === '3m' ? 3 : period === '6m' ? 6 : 12;

    // Generate list of target months back from now
    const targetMonths: { year: number; month: number; label: string; fullLabel: string; key: string }[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      targetMonths.push({
        year: y,
        month: m,
        label: `${INDO_MONTHS[m]}`,
        fullLabel: `${INDO_FULL_MONTHS[m]} ${y}`,
        key: `${y}-${String(m + 1).padStart(2, '0')}`
      });
    }

    // Initialize data map
    const dataMap = new Map<string, {
      monthKey: string;
      month: string;
      fullMonth: string;
      hadirTepatWaktu: number;
      terlambat: number;
      cutiIzin: number;
      tanpaKeterangan: number;
      totalHadir: number;
      totalKeterlambatanMenit: number;
      persentaseDisiplin: number;
    }>();

    targetMonths.forEach(tm => {
      dataMap.set(tm.key, {
        monthKey: tm.key,
        month: tm.label,
        fullMonth: tm.fullLabel,
        hadirTepatWaktu: 0,
        terlambat: 0,
        cutiIzin: 0,
        tanpaKeterangan: 0,
        totalHadir: 0,
        totalKeterlambatanMenit: 0,
        persentaseDisiplin: 100
      });
    });

    // Populate data from attendance history
    activeHistory.forEach(rec => {
      if (!rec.tanggal) return;
      const monthPrefix = rec.tanggal.substring(0, 7); // "YYYY-MM"
      const entry = dataMap.get(monthPrefix);
      if (!entry) return;

      const status = (rec.status || '').toLowerCase();
      const isLate = status.includes('terlambat') || (rec.keterlambatan_menit !== undefined && rec.keterlambatan_menit > 0);
      const isLeave = status.includes('cuti') || status.includes('izin') || status.includes('sakit') || status.includes('dinas');
      const isAbsent = status.includes('tidak hadir') || status.includes('tk') || status.includes('alpa');

      if (isLeave) {
        entry.cutiIzin++;
      } else if (isAbsent) {
        entry.tanpaKeterangan++;
      } else if (rec.jam_masuk) {
        entry.totalHadir++;
        if (isLate) {
          entry.terlambat++;
          entry.totalKeterlambatanMenit += rec.keterlambatan_menit || 0;
        } else {
          entry.hadirTepatWaktu++;
        }
      }
    });

    // Compute percentages
    const resultChartData = Array.from(dataMap.values()).map(item => {
      const totalRecorded = item.hadirTepatWaktu + item.terlambat + item.tanpaKeterangan;
      const persentase = totalRecorded > 0
        ? Math.round((item.hadirTepatWaktu / totalRecorded) * 100)
        : 100;
      return {
        ...item,
        persentaseDisiplin: persentase
      };
    });

    // Grand totals
    let grandTepatWaktu = 0;
    let grandTerlambat = 0;
    let grandCutiIzin = 0;
    let grandTK = 0;
    let grandLateMinutes = 0;

    resultChartData.forEach(item => {
      grandTepatWaktu += item.hadirTepatWaktu;
      grandTerlambat += item.terlambat;
      grandCutiIzin += item.cutiIzin;
      grandTK += item.tanpaKeterangan;
      grandLateMinutes += item.totalKeterlambatanMenit;
    });

    const totalDays = grandTepatWaktu + grandTerlambat + grandTK;
    const overallDisciplineRate = totalDays > 0
      ? Math.round((grandTepatWaktu / totalDays) * 100)
      : 100;

    const avgLate = grandTerlambat > 0 ? Math.round(grandLateMinutes / grandTerlambat) : 0;

    // Current Month's stats
    const thisMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const thisMonthEntry = dataMap.get(thisMonthKey) || {
      monthKey: thisMonthKey,
      month: INDO_MONTHS[currentMonth],
      fullMonth: `${INDO_FULL_MONTHS[currentMonth]} ${currentYear}`,
      hadirTepatWaktu: 0,
      terlambat: 0,
      cutiIzin: 0,
      tanpaKeterangan: 0,
      totalHadir: 0,
      totalKeterlambatanMenit: 0,
      persentaseDisiplin: 100
    };

    return {
      chartData: resultChartData,
      totals: {
        tepatWaktu: grandTepatWaktu,
        terlambat: grandTerlambat,
        cutiIzin: grandCutiIzin,
        tanpaKeterangan: grandTK,
        overallDisciplineRate,
        avgLateMinutes: avgLate
      },
      currentMonthStats: thisMonthEntry
    };
  }, [activeHistory, period]);

  // Selected or active month detail
  const activeMonthDetail = selectedMonthIndex !== null && chartData[selectedMonthIndex]
    ? chartData[selectedMonthIndex]
    : currentMonthStats;

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs text-white min-w-[190px]">
        <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-2">
          <span className="font-bold text-slate-200">{data.fullMonth}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {data.persentaseDisiplin}% Disiplin
          </span>
        </div>

        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Tepat Waktu:
            </span>
            <span className="font-bold text-white">{data.hadirTepatWaktu} hari</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              Terlambat:
            </span>
            <span className="font-bold text-white">{data.terlambat} hari</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
              Cuti / Izin / Dinas:
            </span>
            <span className="font-bold text-white">{data.cutiIzin} hari</span>
          </div>

          {data.tanpaKeterangan > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Tanpa Keterangan:
              </span>
              <span className="font-bold text-rose-300">{data.tanpaKeterangan} hari</span>
            </div>
          )}

          {data.terlambat > 0 && (
            <div className="pt-1 mt-1 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Akumulasi Terlambat:</span>
              <span className="font-semibold text-amber-300">{data.totalKeterlambatanMenit} menit</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`bg-white rounded-3xl p-4 md:p-5 shadow-xs border border-slate-200/90 relative overflow-hidden ${className}`}
    >
      {/* Background soft ambient accents */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-teal-700 to-emerald-600 text-white flex items-center justify-center shadow-xs">
            <BarChart3 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
                {title}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200/60">
                Recharts
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Tren kehadiran & ketepatan waktu bulanan KPU Kota Sungai Penuh
            </p>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200/70">
          {(['3m', '6m', '12m'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p);
                setSelectedMonthIndex(null);
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                period === p
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p === '3m' ? '3 Bulan' : p === '6m' ? '6 Bulan' : '1 Tahun'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {/* Card 1: Disiplin Kehadiran */}
        <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 p-2.5 rounded-2xl border border-emerald-100/90 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">
              Tingkat Disiplin
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-black text-emerald-700">
              {totals.overallDisciplineRate}%
            </span>
            <span className="text-[10px] text-emerald-600/80 font-medium">
              rata-rata
            </span>
          </div>
        </div>

        {/* Card 2: Tepat Waktu */}
        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Tepat Waktu
            </span>
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-black text-slate-800">
              {totals.tepatWaktu}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">hari</span>
          </div>
        </div>

        {/* Card 3: Terlambat */}
        <div className="bg-amber-50/60 p-2.5 rounded-2xl border border-amber-200/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">
              Terlambat
            </span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-black text-amber-700">
              {totals.terlambat}
            </span>
            <span className="text-[10px] text-amber-600 font-medium">
              hari ({totals.avgLateMinutes}m avg)
            </span>
          </div>
        </div>

        {/* Card 4: Cuti & Izin */}
        <div className="bg-sky-50/60 p-2.5 rounded-2xl border border-sky-200/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-sky-800 uppercase tracking-wider">
              Cuti / Izin
            </span>
            <FileText className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-black text-sky-700">
              {totals.cutiIzin}
            </span>
            <span className="text-[10px] text-sky-600 font-medium">hari</span>
          </div>
        </div>
      </div>

      {/* Main Recharts Bar Chart Area */}
      <div className="h-60 sm:h-64 w-full pt-1">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
            <span className="text-xs">Mengompilasi data grafik bulanan...</span>
          </div>
        ) : chartData.length === 0 || totals.tepatWaktu + totals.terlambat + totals.cutiIzin === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 text-center px-4">
            <Info className="w-8 h-8 text-slate-300" />
            <span className="text-xs font-semibold text-slate-600">
              Belum ada rekaman presensi pada periode {period === '3m' ? '3 bulan' : period === '6m' ? '6 bulan' : '1 tahun'} ini
            </span>
            <span className="text-[11px] text-slate-400">
              Lakukan presensi harian secara rutin agar grafik terisi otomatis.
            </span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              onClick={(state) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  setSelectedMonthIndex(state.activeTooltipIndex);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                formatter={(value) => {
                  if (value === 'hadirTepatWaktu') return <span className="text-slate-700 font-medium">Tepat Waktu</span>;
                  if (value === 'terlambat') return <span className="text-slate-700 font-medium">Terlambat</span>;
                  if (value === 'cutiIzin') return <span className="text-slate-700 font-medium">Cuti / Izin</span>;
                  if (value === 'tanpaKeterangan') return <span className="text-slate-700 font-medium">TK</span>;
                  return value;
                }}
              />
              <Bar
                dataKey="hadirTepatWaktu"
                name="hadirTepatWaktu"
                fill="#059669"
                stackId="attendance"
                radius={[0, 0, 0, 0]}
                maxBarSize={38}
              />
              <Bar
                dataKey="terlambat"
                name="terlambat"
                fill="#f59e0b"
                stackId="attendance"
                radius={[0, 0, 0, 0]}
                maxBarSize={38}
              />
              <Bar
                dataKey="cutiIzin"
                name="cutiIzin"
                fill="#0284c7"
                stackId="attendance"
                radius={[0, 0, 0, 0]}
                maxBarSize={38}
              />
              <Bar
                dataKey="tanpaKeterangan"
                name="tanpaKeterangan"
                fill="#f43f5e"
                stackId="attendance"
                radius={[4, 4, 0, 0]}
                maxBarSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Selected Month Drilldown Banner */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-teal-600" />
          <span>
            Bulan:{' '}
            <strong className="text-slate-700 font-semibold">
              {activeMonthDetail.fullMonth}
            </strong>{' '}
            (Tepat: {activeMonthDetail.hadirTepatWaktu}h, Lambat: {activeMonthDetail.terlambat}h, Cuti: {activeMonthDetail.cutiIzin}h)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
          <span className="font-semibold text-emerald-700">
            {activeMonthDetail.persentaseDisiplin}% Kehadiran
          </span>
        </div>
      </div>
    </div>
  );
};
