import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Laptop,
  Building2,
  MapPin,
  Filter,
  RefreshCw,
  TrendingUp,
  Image as ImageIcon,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Activity,
  Briefcase,
  ChevronRight,
  ShieldCheck,
  Coins,
  AlertTriangle,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  Radio,
  UserCheck,
  Zap,
  Send,
  FileDown,
  UserX,
  Bell,
  PlusCircle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Modal } from '../../components/Modal';
import { useSubBagianList } from '../../utils/subBagian';
import { getWibDateStr } from '../../utils/dateUtils';
import { ExportFilteredAttendanceModal } from '../../components/admin/ExportFilteredAttendanceModal';
import { ManualAttendanceModal } from '../../components/admin/ManualAttendanceModal';
import { StatistikAbsensiBulananCard } from '../../components/dashboard/StatistikAbsensiBulananCard';
import { AttendanceLocationDetailModal } from '../../components/admin/AttendanceLocationDetailModal';

interface DashboardAdminProps {
  onNavigate: (view: string) => void;
}

export const DashboardAdmin: React.FC<DashboardAdminProps> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => getWibDateStr());
  const subBagianList = useSubBagianList();

  // Quick Actions Card States
  const [showExportModal, setShowExportModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [quickStatusTab, setQuickStatusTab] = useState<'active' | 'late' | 'absent'>('active');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastToast, setBroadcastToast] = useState<string | null>(null);
  const [disciplineChartMode, setDisciplineChartMode] = useState<'all' | 'discipline' | 'volume'>('all');

  // Attendance Detail & Google Maps Coordinate Verification Modal State
  const [selectedLocationRecord, setSelectedLocationRecord] = useState<any | null>(null);
  const [officeData, setOfficeData] = useState<any | null>(null);

  // Filters for today list
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');

  // Photo viewer modal
  const [viewPhoto, setViewPhoto] = useState<{ title: string; url: string } | null>(null);

  // Delete attendance state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    nama: string;
    nip: string;
    jamMasuk: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAttendance = async () => {
    if (!deleteConfirm) return;
    try {
      setIsDeleting(true);
      await api.deleteAttendance(deleteConfirm.id);
      alert(`Data absensi ${deleteConfirm.nama} berhasil dihapus. Pegawai dapat melakukan absensi ulang.`);
      setDeleteConfirm(null);
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus data absensi');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBroadcastReminder = async (type: 'masuk' | 'pulang') => {
    try {
      setIsBroadcasting(true);
      const res = await api.broadcastAttendanceReminder(type);
      setBroadcastToast(res.message || `Pengingat presensi ${type} berhasil disiarkan.`);
      setTimeout(() => setBroadcastToast(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyiarkan pengingat presensi');
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Advanced Reporting Analytics State
  const [periodFilter, setPeriodFilter] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('6m');
  const [advancedReport, setAdvancedReport] = useState<any>(null);
  const [loadingAdvanced, setLoadingAdvanced] = useState(false);

  const fetchAdvancedReport = async (period: string) => {
    try {
      setLoadingAdvanced(true);
      const res = await api.getAdvancedReports({ period });
      setAdvancedReport(res);
    } catch (err) {
      console.error('Error fetching advanced reports:', err);
    } finally {
      setLoadingAdvanced(false);
    }
  };

  useEffect(() => {
    fetchAdvancedReport(periodFilter);
  }, [periodFilter]);

  useEffect(() => {
    api.getSettings().then(res => {
      if (res?.office) {
        setOfficeData(res.office);
      }
    }).catch(err => {
      console.warn('Could not load office settings for maps verification:', err);
    });
  }, []);

  const [isLiveSync, setIsLiveSync] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchDashboard = async (showLoadingSpinner: boolean = true) => {
    try {
      if (showLoadingSpinner && !data) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setFetchError(null);
      const res = await api.getAdminDashboardStats(selectedDate);
      setData(res);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching admin dashboard:', err);
      if (!data) {
        setFetchError(err?.message || 'Gagal memuat statistik dashboard. Periksa koneksi ke server.');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard(true);
  }, [selectedDate]);

  // Real-time auto-refresh polling every 15 seconds
  useEffect(() => {
    if (!isLiveSync) return;

    const interval = setInterval(() => {
      fetchDashboard(false);
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isLiveSync) {
        fetchDashboard(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLiveSync, selectedDate]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Memuat statistik dashboard...</span>
        </div>
      </div>
    );
  }

  if (fetchError && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-3 shadow-xs">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Gagal Memuat Dashboard</h3>
        <p className="text-xs text-slate-600 max-w-md mb-4">{fetchError}</p>
        <button
          type="button"
          onClick={() => fetchDashboard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Coba Muat Ulang</span>
        </button>
      </div>
    );
  }

  const { leaveStats = {}, attendanceStats = {}, travelStats = {}, monthlyAttendance = [] } = data || {};
  const attendances = attendanceStats.attendancesToday || [];

  // Filter attendance table
  const filteredAttendances = attendances.filter((a: any) => {
    if (unitFilter !== 'ALL' && a.unit_kerja !== unitFilter && a.sub_bagian !== unitFilter) return false;
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    if (methodFilter !== 'ALL' && a.metode_kerja !== methodFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Dashboard Utama Administrator
          </h2>
          <p className="text-xs text-slate-500">
            Monitoring Absensi, Pengajuan Cuti, dan Aktivitas Pegawai KPU Kota Sungai Penuh
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
            id="btn-manual-attendance-dashboard"
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-linear-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
            title="Tambah absensi pegawai secara manual (jika pegawai lupa absen)"
          >
            <PlusCircle className="w-3.5 h-3.5 text-teal-200" />
            <span>+ Presensi Manual</span>
          </button>
          <button
            onClick={() => fetchDashboard(false)}
            disabled={isRefreshing}
            className="p-2 text-slate-600 hover:text-teal-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ==================== A. RINGKASAN REAL-TIME EKSEKUTIF ==================== */}
      <div className="space-y-3">
        {/* Real-time Indicator Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-1 rounded-xl text-xs font-bold">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${isLiveSync ? '' : 'hidden'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isLiveSync ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
              </span>
              <span>{isLiveSync ? 'Ringkasan Real-Time Aktif' : 'Real-Time Dijeda'}</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Sinkronisasi otomatis setiap 15 detik • Terakhir diperbarui:{' '}
              <strong className="text-slate-700">
                {lastUpdated
                  ? lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '-'}{' '}
                WIB
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsLiveSync(!isLiveSync)}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-colors cursor-pointer border flex items-center gap-1.5 ${
                isLiveSync
                  ? 'bg-emerald-100/70 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
              }`}
              title={isLiveSync ? 'Klik untuk menjeda auto-refresh' : 'Klik untuk mengaktifkan auto-refresh'}
            >
              <Radio className={`w-3.5 h-3.5 ${isLiveSync ? 'text-emerald-700 animate-pulse' : 'text-slate-400'}`} />
              <span>{isLiveSync ? 'Live Sync On' : 'Live Sync Off'}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchDashboard(false)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold transition-colors cursor-pointer shadow-2xs"
              title="Perbarui data sekarang"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-700 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Memperbarui...' : 'Segarkan Data'}</span>
            </button>
          </div>
        </div>

        {/* 3 Real-time Executive Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KARTU 1: JUMLAH PEGAWAI HADIR HARI INI */}
          <div
            onClick={() => onNavigate('admin-monitoring')}
            className="group relative bg-white p-5 rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Pegawai Hadir Hari Ini
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Live
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-3.5xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
                    {attendanceStats.sudahAbsen ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    / {attendanceStats.totalPegawai ?? 0} Pegawai
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Tingkat Kehadiran:</span>
                <span className="font-extrabold text-emerald-700">{attendanceStats.persentaseKehadiran || 0}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-linear-to-r from-emerald-500 to-teal-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, attendanceStats.persentaseKehadiran || 0)}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md font-semibold border border-emerald-200/70">
                  ✓ {attendanceStats.tepatWaktu ?? attendanceStats.sudahAbsen ?? 0} Tepat Waktu
                </span>
                {(attendanceStats.terlambat ?? 0) > 0 && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md font-semibold border border-amber-200/70">
                    ⏱ {attendanceStats.terlambat} Terlambat
                  </span>
                )}
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                  {attendanceStats.countWFO || 0} WFO • {attendanceStats.countWFH || 0} WFH
                </span>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
              <span>Buka Monitoring Kehadiran Pegawai</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>

          {/* KARTU 2: PENGAJUAN CUTI TERTUNDA */}
          <div
            onClick={() => onNavigate('admin-approval-cuti')}
            className={`group relative bg-white p-5 rounded-2xl border-2 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between ${
              (leaveStats.totalPending ?? 0) > 0
                ? 'border-amber-300 hover:border-amber-500 bg-gradient-to-b from-amber-50/40 via-white to-white'
                : 'border-slate-200 hover:border-slate-400'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Pengajuan Cuti Tertunda
                  </span>
                  {(leaveStats.totalPending ?? 0) > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300 animate-pulse">
                      Perlu Tindakan
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Selesai
                    </span>
                  )}
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className={`text-3.5xl sm:text-4xl font-black tracking-tight font-mono ${
                    (leaveStats.totalPending ?? 0) > 0 ? 'text-amber-950' : 'text-slate-900'
                  }`}>
                    {leaveStats.totalPending ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Berkas Menunggu
                  </span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-all shadow-xs ${
                (leaveStats.totalPending ?? 0) > 0
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 group-hover:bg-amber-600 group-hover:text-white'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 group-hover:bg-slate-700 group-hover:text-white'
              }`}>
                <Clock className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
              <p className="text-xs text-slate-600 leading-relaxed min-h-[36px]">
                {(leaveStats.totalPending ?? 0) > 0
                  ? `${leaveStats.totalPending} pengajuan cuti pegawai menunggu telaah dan persetujuan pejabat/admin.`
                  : 'Semua berkas pengajuan cuti telah ditindaklanjuti. Tidak ada antrean tertunda.'}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-md font-semibold border border-blue-200/70">
                  🏖 {leaveStats.totalSedangCuti || 0} Sedang Cuti Hari Ini
                </span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                  {leaveStats.totalApproved || 0} Disetujui Thn Ini
                </span>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-800 group-hover:text-amber-900">
              <span>Buka Persetujuan Cuti Pegawai</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>

          {/* KARTU 3: PERJALANAN DINAS BERLANGSUNG */}
          <div
            onClick={() => onNavigate('admin-perjalanan-dinas')}
            className="group relative bg-white p-5 rounded-2xl border-2 border-blue-200 hover:border-blue-500 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                    Perjalanan Dinas Berlangsung
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                    SPPD Aktif
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-3.5xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
                    {travelStats?.ongoingDuties ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Surat Tugas Aktif
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200/80 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                <Briefcase className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Personel Bertugas:</span>
                <span className="font-extrabold text-blue-900 font-mono">
                  {travelStats?.totalEmployeesOnTravel ?? 0} Pegawai
                </span>
              </div>

              {travelStats?.activeTravelDuties && travelStats.activeTravelDuties.length > 0 ? (
                <div className="space-y-1.5 min-h-[36px]">
                  {travelStats.activeTravelDuties.slice(0, 2).map((duty: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] bg-blue-50/70 px-2.5 py-1 rounded-lg text-blue-950 border border-blue-100">
                      <span className="truncate max-w-[170px] font-medium">
                        📍 {duty.kota_tujuan || duty.tempat_tujuan || 'Dalam Kota'}
                      </span>
                      <span className="text-[10px] text-blue-700 font-mono font-semibold shrink-0">
                        {duty.participant_count || 1} org
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 min-h-[36px] flex items-center">
                  Tidak ada penugasan perjalanan dinas aktif pada tanggal ini.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-md font-semibold border border-blue-200/70">
                  ✈ Tugas Dinas SPPD
                </span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium">
                  Luar & Dalam Kota
                </span>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-700 group-hover:text-blue-800">
              <span>Buka Manajemen Perjalanan Dinas (SPPD)</span>
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* ==================== B. QUICK ACTIONS & STATUS INDIKATOR PRESENSI HARI INI ==================== */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Quick Actions & Status Pegawai Real-Time
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  Hari Ini
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Aksi kilat & pantauan status presensi pegawai aktif, terlambat, dan belum presensi berdasarkan log absensi harian KPU
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-quick-export-pdf"
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-linear-to-r from-red-700 to-rose-700 hover:from-red-800 hover:to-rose-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
              title="Ekspor laporan daftar hadir hari ini ke format PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Ekspor PDF Presensi</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('admin-monitoring')}
              className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Monitoring Lengkap</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Broadcast Toast Feedback if triggered */}
        {broadcastToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{broadcastToast}</span>
            </div>
            <button onClick={() => setBroadcastToast(null)} className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer">✕</button>
          </div>
        )}

        {/* 4 Interactive Status Indicators Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Status: Aktif Bekerja (Currently Active) */}
          <div
            onClick={() => setQuickStatusTab('active')}
            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              quickStatusTab === 'active'
                ? 'bg-emerald-50/90 border-emerald-500 shadow-xs'
                : 'bg-slate-50/70 border-slate-200 hover:border-emerald-300 hover:bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-800 block">
                  Pegawai Aktif Saat Ini
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {attendanceStats.hadirToday || 0}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Pegawai</span>
                </div>
              </div>
              <span className="flex h-2.5 w-2.5 relative mt-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>

            <div className="mt-2.5 pt-2 border-t border-emerald-100 flex items-center justify-between text-[10.5px]">
              <span className="text-emerald-900 font-medium">
                {attendanceStats.countWFO || 0} WFO • {attendanceStats.countWFH || 0} WFH • {attendanceStats.countWFA || 0} WFA
              </span>
              <span className="font-bold text-emerald-700 underline text-[10px]">Lihat Log</span>
            </div>
          </div>

          {/* 2. Status: Terlambat (Late) */}
          <div
            onClick={() => setQuickStatusTab('late')}
            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              quickStatusTab === 'late'
                ? 'bg-amber-50/90 border-amber-500 shadow-xs'
                : 'bg-slate-50/70 border-slate-200 hover:border-amber-300 hover:bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-800 block">
                  Terlambat Hari Ini
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-amber-950 font-mono">
                    {attendanceStats.terlambat || 0}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Pegawai</span>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1" />
            </div>

            <div className="mt-2.5 pt-2 border-t border-amber-100 flex items-center justify-between text-[10.5px]">
              <span className="text-amber-900 font-medium truncate">
                Lewat dari pukul 07.30 WIB
              </span>
              <span className="font-bold text-amber-700 underline text-[10px]">Lihat Log</span>
            </div>
          </div>

          {/* 3. Status: Belum Presensi / Absent */}
          <div
            onClick={() => setQuickStatusTab('absent')}
            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              quickStatusTab === 'absent'
                ? 'bg-rose-50/90 border-rose-500 shadow-xs'
                : 'bg-slate-50/70 border-slate-200 hover:border-rose-300 hover:bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-800 block">
                  Belum Presensi / TK
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-rose-950 font-mono">
                    {attendanceStats.belumAbsen || 0}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Pegawai</span>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1" />
            </div>

            <div className="mt-2.5 pt-2 border-t border-rose-100 flex items-center justify-between text-[10.5px]">
              <span className="text-rose-900 font-medium truncate">
                Belum tercatat check-in
              </span>
              <span className="font-bold text-rose-700 underline text-[10px]">Lihat Log</span>
            </div>
          </div>

          {/* 4. Status: Izin Resmi (Cuti & SPPD) */}
          <div
            onClick={() => onNavigate('admin-cuti')}
            className="p-3.5 rounded-2xl border-2 border-slate-200 hover:border-blue-300 bg-slate-50/70 hover:bg-white transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-800 block">
                  Izin Resmi (Cuti & SPPD)
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-blue-950 font-mono">
                    {(leaveStats?.totalSedangCuti || 0) + (travelStats?.totalEmployeesOnTravel || 0)}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Pegawai</span>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1" />
            </div>

            <div className="mt-2.5 pt-2 border-t border-blue-100 flex items-center justify-between text-[10.5px]">
              <span className="text-blue-900 font-medium">
                {leaveStats?.totalSedangCuti || 0} Cuti • {travelStats?.totalEmployeesOnTravel || 0} Dinas
              </span>
              <span className="font-bold text-blue-700 text-[10px] flex items-center">Buka Cuti →</span>
            </div>
          </div>
        </div>

        {/* Tab Preview: Display top employees matching currently selected quick indicator */}
        <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200">
          <div className="flex items-center justify-between mb-2.5 text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              {quickStatusTab === 'active' && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Daftar Log Presensi Aktif Hari Ini (Terbaru)</span>
                </>
              )}
              {quickStatusTab === 'late' && (
                <>
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Daftar Pegawai Tercatat Terlambat Hari Ini</span>
                </>
              )}
              {quickStatusTab === 'absent' && (
                <>
                  <UserX className="w-4 h-4 text-rose-600" />
                  <span>Ringkasan Pegawai Belum Melakukan Presensi Hari Ini</span>
                </>
              )}
            </span>

            <button
              type="button"
              onClick={() => onNavigate('admin-monitoring')}
              className="text-[11px] font-bold text-teal-800 hover:text-teal-900 hover:underline cursor-pointer"
            >
              Buka Semua di Monitoring Presensi →
            </button>
          </div>

          {/* Quick List Render */}
          {quickStatusTab === 'active' && (
            attendances.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">Belum ada pegawai yang melakukan presensi masuk hari ini.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {attendances.slice(0, 6).map((att: any, idx: number) => (
                  <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200/90 flex items-center justify-between text-xs shadow-2xs">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-slate-900 truncate text-[11.5px]">{att.nama_lengkap}</div>
                      <div className="text-[10px] text-slate-500 truncate">{att.unit_kerja || att.sub_bagian || 'KPU Kota Sungai Penuh'}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-emerald-700 text-[11px] block">{att.jam_masuk || '-'} WIB</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">{att.metode_kerja || 'WFO'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {quickStatusTab === 'late' && (
            attendances.filter((a: any) => a.status === 'Terlambat' || (a.keterlambatan_menit && a.keterlambatan_menit > 0)).length === 0 ? (
              <div className="p-3 text-center text-xs text-emerald-800 bg-emerald-50 rounded-xl font-medium border border-emerald-200">
                ✓ Luar biasa! Seluruh pegawai yang telah presensi hari ini hadir tepat waktu (sebelum 07.30 WIB).
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {attendances.filter((a: any) => a.status === 'Terlambat' || (a.keterlambatan_menit && a.keterlambatan_menit > 0)).slice(0, 6).map((att: any, idx: number) => (
                  <div key={idx} className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between text-xs shadow-2xs">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-slate-900 truncate text-[11.5px]">{att.nama_lengkap}</div>
                      <div className="text-[10px] text-amber-700 font-medium truncate">Terlambat {att.keterlambatan_menit || 0} menit</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-amber-900 text-[11px] block">{att.jam_masuk} WIB</span>
                      <span className="text-[9px] text-slate-500 font-medium">Ganti Jam Kerja</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {quickStatusTab === 'absent' && (
            <div className="p-3 bg-white rounded-xl border border-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-0.5">
                <span className="font-bold text-rose-950 flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{attendanceStats.belumAbsen || 0} Pegawai Belum Tercatat Presensi Hari Ini</span>
                </span>
                <p className="text-[11px] text-slate-600">
                  Kirimkan siaran pengingat presensi sekarang ke seluruh perangkat pegawai agar segera melakukan absensi sebelum batas waktu 08.30 WIB berakhir.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  id="btn-broadcast-reminder-quick"
                  onClick={() => handleBroadcastReminder('masuk')}
                  disabled={isBroadcasting}
                  className="px-3 py-2 bg-linear-to-r from-rose-700 to-red-700 hover:from-rose-800 hover:to-red-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isBroadcasting ? 'Mengirim...' : 'Siarkan Pengingat Masuk'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Action Shortcuts Toolbar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 text-[11px] font-semibold">Pintasan Aksi Kilat Admin:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleBroadcastReminder('masuk')}
              disabled={isBroadcasting}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-xl border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <Bell className="w-3.5 h-3.5 text-emerald-600" />
              <span>Broadcast Presensi Masuk</span>
            </button>
            <button
              type="button"
              onClick={() => handleBroadcastReminder('pulang')}
              disabled={isBroadcasting}
              className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 font-semibold rounded-xl border border-sky-200 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <Bell className="w-3.5 h-3.5 text-sky-600" />
              <span>Broadcast Presensi Pulang</span>
            </button>
            <button
              type="button"
              id="btn-export-pdf-bottom"
              onClick={() => setShowExportModal(true)}
              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 font-semibold rounded-xl border border-red-200 transition-colors cursor-pointer flex items-center gap-1"
            >
              <FileDown className="w-3.5 h-3.5 text-red-600" />
              <span>Cetak / Ekspor PDF Hari Ini</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODUL UTAMA & PINTASAN CEPAT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onNavigate('admin-approval-luar-radius')}
          className="p-3.5 bg-teal-50 hover:bg-teal-100/80 border border-teal-200 rounded-2xl flex items-center gap-3 text-left transition cursor-pointer shadow-2xs group"
        >
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-teal-700 to-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[11px] font-bold text-teal-950 block truncate">Approval Luar Radius</span>
            <span className="text-[10px] text-teal-700 block truncate">Validasi kendala jalan/mogok</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('admin-wfh-wfa')}
          className="p-3.5 bg-sky-50 hover:bg-sky-100/80 border border-sky-200 rounded-2xl flex items-center gap-3 text-left transition cursor-pointer shadow-2xs group"
        >
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-sky-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <Laptop className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[11px] font-bold text-sky-950 block truncate">Penugasan WFH/WFA</span>
            <span className="text-[10px] text-sky-700 block truncate">Input Masal & Upload Excel</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('admin-perjalanan-dinas')}
          className="p-3.5 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 rounded-2xl flex items-center gap-3 text-left transition cursor-pointer shadow-2xs group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <Briefcase className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[11px] font-bold text-blue-900 block truncate">Perjalanan Dinas (SPPD)</span>
            <span className="text-[10px] text-blue-700 block truncate">Dalam kota & luar kota</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('admin-tukin')}
          className="p-3.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 rounded-2xl flex items-center gap-3 text-left transition cursor-pointer shadow-2xs group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <Coins className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <span className="text-[11px] font-bold text-amber-900 block truncate">Perhitungan Tukin</span>
            <span className="text-[10px] text-amber-700 block truncate">Potongan disiplin kehadiran</span>
          </div>
        </button>
      </div>

      {/* A. STATISTIK ABSENSI HARI INI */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            B. Statistik Absensi Hari Ini ({selectedDate})
          </h3>
          <span className="text-xs font-medium text-slate-500">
            Tingkat Kehadiran: <strong className="text-slate-800">{attendanceStats.persentaseKehadiran || 0}%</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500">Total Pegawai</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{attendanceStats.totalPegawai || 0}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Pegawai aktif</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
            <div className="text-[11px] font-semibold text-emerald-700">Sudah Absen</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{attendanceStats.sudahAbsen || 0}</div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Masuk kerja</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-xs">
            <div className="text-[11px] font-semibold text-amber-700">Belum Absen</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{attendanceStats.belumAbsen || 0}</div>
            <div className="text-[10px] text-amber-600 mt-0.5">Belum check-in</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-blue-200/80 bg-blue-50/20 shadow-xs">
            <div className="text-[11px] font-semibold text-blue-700">WFO</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{attendanceStats.countWFO || 0}</div>
            <div className="text-[10px] text-blue-600 mt-0.5">Di kantor KPU</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-purple-200/80 bg-purple-50/20 shadow-xs">
            <div className="text-[11px] font-semibold text-purple-700">WFH</div>
            <div className="text-2xl font-bold text-purple-700 mt-1">{attendanceStats.countWFH || 0}</div>
            <div className="text-[10px] text-purple-600 mt-0.5">Work from home</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-teal-200/80 bg-teal-50/20 shadow-xs">
            <div className="text-[11px] font-semibold text-teal-700">WFA</div>
            <div className="text-2xl font-bold text-teal-700 mt-1">{attendanceStats.countWFA || 0}</div>
            <div className="text-[10px] text-teal-600 mt-0.5">Anywhere</div>
          </div>
        </div>
      </div>

      {/* A. STATISTIK CUTI */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            A. Statistik Pengajuan Cuti
          </h3>
          <button
            onClick={() => onNavigate('admin-approval-cuti')}
            className="text-xs text-teal-700 hover:text-teal-800 font-semibold cursor-pointer"
          >
            Lihat Antrean Approval &rarr;
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500">Total Pengajuan</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{leaveStats.totalRequests || 0}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Seluruh periode</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-300 bg-amber-50/40 shadow-xs cursor-pointer hover:border-amber-400 transition-colors"
            onClick={() => onNavigate('admin-approval-cuti')}
          >
            <div className="text-[11px] font-semibold text-amber-800">Menunggu Approval</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{leaveStats.totalPending || 0}</div>
            <div className="text-[10px] text-amber-600 font-semibold mt-0.5">Perlu diverifikasi &rarr;</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
            <div className="text-[11px] font-semibold text-emerald-700">Disetujui</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{leaveStats.totalApproved || 0}</div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Cuti resmi aktif</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs">
            <div className="text-[11px] font-semibold text-rose-700">Ditolak</div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{leaveStats.totalRejected || 0}</div>
            <div className="text-[10px] text-rose-600 mt-0.5">Tidak disetujui</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-xs">
            <div className="text-[11px] font-semibold text-indigo-700">Sedang Cuti Hari Ini</div>
            <div className="text-2xl font-bold text-indigo-700 mt-1">{leaveStats.totalSedangCuti || 0}</div>
            <div className="text-[10px] text-indigo-600 mt-0.5">Pegawai tidak hadir cuti</div>
          </div>
        </div>
      </div>

      {/* C. LIST PEGAWAI SEDANG CUTI HARI INI */}
      {leaveStats.currentlyOnLeave && leaveStats.currentlyOnLeave.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                C. List Pegawai Sedang Cuti Hari Ini
              </h4>
            </div>
            <span className="text-xs bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
              {leaveStats.currentlyOnLeave.length} Pegawai
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Nama Pegawai</th>
                  <th className="px-4 py-2.5 font-semibold">NIP/NIK</th>
                  <th className="px-4 py-2.5 font-semibold">Jenis Cuti</th>
                  <th className="px-4 py-2.5 font-semibold">Tanggal Mulai</th>
                  <th className="px-4 py-2.5 font-semibold">Tanggal Selesai</th>
                  <th className="px-4 py-2.5 font-semibold">Lama Cuti</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveStats.currentlyOnLeave.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-800">{item.nama_lengkap}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{item.nip_nik}</td>
                    <td className="px-4 py-3 text-slate-700">{item.leave_type_name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.tanggal_mulai}</td>
                    <td className="px-4 py-3 text-slate-600">{item.tanggal_selesai}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{item.jumlah_hari} Hari</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* C. PELAPORAN LANJUTAN & VISUALISASI DATA DENGAN FILTER PERIODE */}
      <div className="space-y-4">
        {/* Header & Filter Periode */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-100 text-red-700 rounded-lg">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                  C. Pelaporan Lanjutan & Visualisasi Tren
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Visualisasi tren absensi, distribusi cuti, dan proporsi metode kerja (WFO/WFH/WFA)
                {advancedReport?.startDate && (
                  <span className="font-medium text-slate-700"> &bull; Periode: {advancedReport.startDate} s/d {advancedReport.endDate}</span>
                )}
              </p>
            </div>

            {/* Filter Periode Waktu */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-semibold text-slate-500 px-2 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Periode:
              </span>
              {[
                { id: '1m', label: '30 Hari' },
                { id: '3m', label: '3 Bulan' },
                { id: '6m', label: '6 Bulan' },
                { id: '1y', label: 'Tahun 2026' },
                { id: 'all', label: 'Semua' }
              ].map(p => (
                <button
                  key={p.id}
                  id={`btn-period-${p.id}`}
                  onClick={() => setPeriodFilter(p.id as any)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    periodFilter === p.id
                      ? 'bg-white text-red-700 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Metrics for the selected period */}
          {advancedReport?.kpi && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">Tingkat Tepat Waktu</div>
                <div className="text-xl font-bold text-emerald-700 mt-0.5">
                  {advancedReport.kpi.persentaseTepatWaktu}%
                </div>
                <div className="text-[10px] text-slate-400">
                  {advancedReport.kpi.totalHadir} dari {advancedReport.kpi.totalAbsen} absen
                </div>
              </div>

              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">Keterlambatan</div>
                <div className="text-xl font-bold text-amber-600 mt-0.5">
                  {advancedReport.kpi.totalTerlambat}
                </div>
                <div className="text-[10px] text-slate-400">Total catatan terlambat</div>
              </div>

              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">Total Hari Cuti</div>
                <div className="text-xl font-bold text-blue-700 mt-0.5">
                  {advancedReport.kpi.totalCutiDays} <span className="text-xs font-normal">Hari</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {advancedReport.kpi.totalCutiRequests} permohonan disetujui
                </div>
              </div>

              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">Rasio WFO vs Remote</div>
                <div className="text-xl font-bold text-slate-800 mt-0.5">
                  {advancedReport.kpi.persentaseWFO}% <span className="text-xs font-normal">WFO</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {advancedReport.kpi.totalWFH + advancedReport.kpi.totalWFA} sesi WFH/WFA
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* GRAFIK 1: GRAFIK BATANG - TREN ABSENSI BULANAN */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                    Grafik Batang: Tren Absensi Bulanan
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                    <span className="w-2.5 h-2.5 bg-emerald-600 rounded-xs" /> Hadir
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-amber-700">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs" /> Terlambat
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Komparasi presensi tepat waktu vs terlambat berdasarkan periode waktu yang dipilih
              </p>
            </div>

            <div className="h-64 w-full">
              {loadingAdvanced ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-400" /> Memperbarui grafik batang...
                </div>
              ) : (advancedReport?.monthlyAttendanceTrend?.length || 0) === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Tidak ada data absensi pada periode ini
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={advancedReport?.monthlyAttendanceTrend || []}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '11px',
                        border: 'none'
                      }}
                      formatter={(value: any, name: any) => [
                        `${value} sesi`,
                        name === 'hadir' ? 'Hadir Tepat Waktu' : 'Terlambat'
                      ]}
                    />
                    <Bar dataKey="hadir" fill="#059669" name="hadir" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="terlambat" fill="#f59e0b" name="terlambat" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* GRAFIK 2: GRAFIK PIE - DISTRIBUSI JENIS CUTI */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <PieChartIcon className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                    Grafik Pie: Distribusi Jenis Cuti
                  </h4>
                </div>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  Total {advancedReport?.kpi?.totalCutiDays || 0} Hari
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Persentase pemanfaatan hak cuti berdasarkan 6 klasifikasi peraturan kepegawaian
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="h-60 w-full sm:w-1/2">
                {loadingAdvanced ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-400" /> Memuat pie chart...
                  </div>
                ) : (advancedReport?.leaveDistribution?.length || 0) === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Tidak ada cuti terpakai pada periode ini
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={advancedReport?.leaveDistribution || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {(advancedReport?.leaveDistribution || []).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill || '#cbd5e1'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '11px',
                          border: 'none'
                        }}
                        formatter={(val: any, name: any, item: any) => [
                          `${val} Hari (${item.payload.requestsCount} pengajuan)`,
                          item.payload.name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Pie Breakdown Legend */}
              <div className="w-full sm:w-1/2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {(advancedReport?.leaveDistribution || []).map((item: any) => {
                  const totalDays = advancedReport?.kpi?.totalCutiDays || 1;
                  const pct = Math.round((item.value / totalDays) * 100) || 0;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 text-xs border border-transparent hover:border-slate-100"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span className="text-slate-700 font-medium truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2 font-mono">
                        <span className="font-bold text-slate-800">{item.value}h</span>
                        <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* GRAFIK GARIS UTAMA: TREN KEHADIRAN BULANAN & KOMPARASI TINGKAT KEDISIPLINAN PEGAWAI */}
        {/* ========================================================================= */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
          {/* Header & Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-linear-to-br from-teal-600 to-emerald-700 text-white rounded-xl shadow-xs">
                  <LineChartIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Grafik Garis: Tren Kehadiran Bulanan & Komparasi Kedisiplinan Pegawai</span>
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-extrabold px-2 py-0.5 rounded-full border border-teal-200 uppercase">
                      Analisis Kedisiplinan
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Visualisasi pergerakan volume kehadiran dan perbandingan tingkat kedisiplinan (persentase hadir tepat waktu) antar bulan
                  </p>
                </div>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setDisciplineChartMode('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  disciplineChartMode === 'all'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Semua Indikator (Dual-Axis)
              </button>
              <button
                type="button"
                onClick={() => setDisciplineChartMode('discipline')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  disciplineChartMode === 'discipline'
                    ? 'bg-teal-700 text-white font-bold shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Tingkat Kedisiplinan (%)
              </button>
              <button
                type="button"
                onClick={() => setDisciplineChartMode('volume')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  disciplineChartMode === 'volume'
                    ? 'bg-blue-700 text-white font-bold shadow-xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Volume Presensi (Sesi)
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar Antar Bulan */}
          {(() => {
            const trendData: any[] = advancedReport?.monthlyAttendanceTrend || [];
            const avgDiscipline = trendData.length > 0
              ? Math.round(trendData.reduce((acc, curr) => acc + (curr.disiplinRate || curr.persentaseTepat || 0), 0) / trendData.length)
              : 100;
            const peakMonth = [...trendData].sort((a, b) => (b.disiplinRate || b.persentaseTepat || 0) - (a.disiplinRate || a.persentaseTepat || 0))[0];
            const latestMonth = trendData[trendData.length - 1];
            const prevMonth = trendData.length > 1 ? trendData[trendData.length - 2] : null;
            const latestDelta = latestMonth && prevMonth
              ? (latestMonth.disiplinRate || latestMonth.persentaseTepat || 0) - (prevMonth.disiplinRate || prevMonth.persentaseTepat || 0)
              : 0;
            const totalSesi = trendData.reduce((acc, curr) => acc + (curr.total || 0), 0);

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-teal-50/70 border border-teal-200/90 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10.5px] uppercase font-extrabold text-teal-800 tracking-wider">
                    Rata-Rata Kedisiplinan
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-teal-950 font-mono">{avgDiscipline}%</span>
                    <span className="text-[10.5px] font-bold text-teal-700">Tepat Waktu</span>
                  </div>
                  <span className="text-[10px] text-teal-800/80 mt-1">Seluruh bulan terpilih</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10.5px] uppercase font-extrabold text-slate-700 tracking-wider">
                    Bulan Paling Disiplin
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-slate-900 truncate">
                      {peakMonth?.month || '-'}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 font-mono">
                      ({peakMonth?.disiplinRate || peakMonth?.persentaseTepat || 100}%)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">Tingkat kepatuhan tertinggi</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10.5px] uppercase font-extrabold text-slate-700 tracking-wider">
                    Tren vs Bulan Lalu
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    {latestDelta > 0 ? (
                      <>
                        <ArrowUpRight className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="text-xl font-black text-emerald-700 font-mono">+{latestDelta}%</span>
                        <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">Meningkat</span>
                      </>
                    ) : latestDelta < 0 ? (
                      <>
                        <ArrowDownRight className="w-5 h-5 text-rose-600 shrink-0" />
                        <span className="text-xl font-black text-rose-700 font-mono">{latestDelta}%</span>
                        <span className="text-[10px] text-rose-800 font-bold bg-rose-100 px-1.5 py-0.5 rounded">Menurun</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl font-black text-slate-800 font-mono">0%</span>
                        <span className="text-[10px] text-slate-600 font-bold bg-slate-200 px-1.5 py-0.5 rounded">Stabil</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">Perbandingan antar bulan</span>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200/90 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10.5px] uppercase font-extrabold text-blue-800 tracking-wider">
                    Total Sesi Presensi
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-blue-950 font-mono">{totalSesi}</span>
                    <span className="text-[10.5px] font-bold text-blue-700">Sesi Log</span>
                  </div>
                  <span className="text-[10px] text-blue-800/80 mt-1">Total kehadiran & terlambat</span>
                </div>
              </div>
            );
          })()}

          {/* Line Chart Canvas */}
          <div className="h-72 w-full pt-2">
            {loadingAdvanced ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-400" /> Memuat grafik tren kedisiplinan...
              </div>
            ) : (advancedReport?.monthlyAttendanceTrend?.length || 0) === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada data presensi pada rentang waktu ini
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={advancedReport?.monthlyAttendanceTrend || []}
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                  
                  {/* Left YAxis for Session Counts */}
                  <YAxis
                    yAxisId="left"
                    stroke="#64748b"
                    fontSize={11}
                    allowDecimals={false}
                    label={{ value: 'Sesi', angle: -90, position: 'insideLeft', offset: 15, fontSize: 10, fill: '#94a3b8' }}
                  />

                  {/* Right YAxis for Discipline Percentage */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#0d9488"
                    fontSize={11}
                    domain={[50, 100]}
                    unit="%"
                    label={{ value: 'Kedisiplinan', angle: 90, position: 'insideRight', offset: 15, fontSize: 10, fill: '#0d9488' }}
                  />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                      border: 'none',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
                    }}
                    formatter={(val: any, name: any, item: any) => {
                      if (name === 'disiplinRate') {
                        const delta = item.payload.deltaPrevMonth;
                        const deltaStr = delta > 0 ? ` (+${delta}% vs bln lalu)` : delta < 0 ? ` (${delta}% vs bln lalu)` : '';
                        return [`${val}%${deltaStr}`, 'Tingkat Kedisiplinan'];
                      }
                      if (name === 'hadir') return [`${val} sesi`, 'Hadir Tepat Waktu'];
                      if (name === 'terlambat') return [`${val} sesi`, 'Terlambat'];
                      return [val, name];
                    }}
                  />

                  {/* Line 1: Tingkat Kedisiplinan (%) */}
                  {(disciplineChartMode === 'all' || disciplineChartMode === 'discipline') && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="disiplinRate"
                      name="disiplinRate"
                      stroke="#0d9488"
                      strokeWidth={3.5}
                      dot={{ r: 4.5, stroke: '#0d9488', strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 7, stroke: '#042f2e', strokeWidth: 2 }}
                    />
                  )}

                  {/* Line 2: Hadir Tepat Waktu (Sesi) */}
                  {(disciplineChartMode === 'all' || disciplineChartMode === 'volume') && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="hadir"
                      name="hadir"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#2563eb' }}
                      activeDot={{ r: 5 }}
                    />
                  )}

                  {/* Line 3: Terlambat (Sesi) */}
                  {(disciplineChartMode === 'all' || disciplineChartMode === 'volume') && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="terlambat"
                      name="terlambat"
                      stroke="#e11d48"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: '#e11d48' }}
                      activeDot={{ r: 5 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend and MoM Analysis Table */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 font-medium">
                <span className="flex items-center gap-1.5 text-teal-800 font-bold">
                  <span className="w-3.5 h-1 bg-teal-600 rounded-full" /> Tingkat Kedisiplinan (%)
                </span>
                <span className="flex items-center gap-1.5 text-blue-700">
                  <span className="w-3.5 h-1 bg-blue-600 rounded-full" /> Hadir Tepat Waktu (Sesi)
                </span>
                <span className="flex items-center gap-1.5 text-rose-700">
                  <span className="w-3.5 h-1 bg-rose-500 rounded-full border-b border-dashed border-rose-600" /> Terlambat (Sesi)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                *Tingkat kedisiplinan dihitung dari rasio kehadiran tepat waktu terhadap total absensi
              </span>
            </div>

            {/* MoM Detailed Comparison Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10px] font-extrabold uppercase text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Bulan</th>
                    <th className="py-2 px-3 text-right">Tepat Waktu</th>
                    <th className="py-2 px-3 text-right">Terlambat</th>
                    <th className="py-2 px-3 text-right">Total Presensi</th>
                    <th className="py-2 px-3 text-right">Kedisiplinan (%)</th>
                    <th className="py-2 px-3 text-right">Perubahan vs Bln Lalu</th>
                    <th className="py-2 px-3 text-center">Predikat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {(advancedReport?.monthlyAttendanceTrend || []).map((m: any, idx: number) => {
                    const rate = m.disiplinRate || m.persentaseTepat || 0;
                    const delta = m.deltaPrevMonth || 0;
                    return (
                      <tr key={m.key || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-bold text-slate-800">{m.month}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">{m.hadir} sesi</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-700 font-semibold">{m.terlambat} sesi</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">{m.total} sesi</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-teal-900">{rate}%</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {idx === 0 ? (
                            <span className="text-slate-400">-</span>
                          ) : delta > 0 ? (
                            <span className="text-emerald-600 font-bold">▲ +{delta}%</span>
                          ) : delta < 0 ? (
                            <span className="text-rose-600 font-bold">▼ {delta}%</span>
                          ) : (
                            <span className="text-slate-500 font-bold">0%</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rate >= 95
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                              : rate >= 90
                              ? 'bg-teal-100 text-teal-900 border border-teal-200'
                              : rate >= 80
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-rose-100 text-rose-900 border border-rose-200'
                          }`}>
                            {rate >= 95 ? 'Sangat Baik' : rate >= 90 ? 'Baik' : rate >= 80 ? 'Cukup' : 'Perlu Evaluasi'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* GRAFIK 3: GRAFIK GARIS - TREN PEGAWAI WFH / WFA / WFO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <LineChartIcon className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                  Grafik Garis: Tren Jumlah Pegawai WFH / WFA / WFO
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Fluktuasi harian jumlah pegawai yang bekerja di kantor (WFO), rumah (WFH), dan lokasi fleksibel (WFA)
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-blue-700">
                <span className="w-3 h-0.5 bg-blue-600 rounded-full" /> WFO (Kantor)
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="w-3 h-0.5 bg-emerald-600 rounded-full" /> WFH (Rumah)
              </span>
              <span className="flex items-center gap-1.5 text-purple-700">
                <span className="w-3 h-0.5 bg-purple-600 rounded-full" /> WFA (Fleksibel)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {loadingAdvanced ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-400" /> Memuat grafik tren WFH/WFA/WFO...
              </div>
            ) : (advancedReport?.workMethodTrends?.length || 0) === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Belum ada data presensi metode kerja pada periode ini
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={advancedReport?.workMethodTrends || []}
                  margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px',
                      border: 'none'
                    }}
                    labelFormatter={(_, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullDate;
                      }
                      return '';
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="wfo"
                    name="WFO"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="wfh"
                    name="WFH"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="wfa"
                    name="WFA"
                    stroke="#9333ea"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* STATISTIK ABSENSI BULANAN DENGAN GRAFIK BATANG RECHARTS */}
        <StatistikAbsensiBulananCard
          title="Statistik Absensi Bulanan Kantor (Grafik Batang Recharts)"
        />
      </div>

      {/* D. LIST ABSENSI HARI INI */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-800 tracking-tight">
              D. List Absensi Hari Ini
            </h4>
            <p className="text-xs text-slate-500">
              Menampilkan {filteredAttendances.length} catatan absensi masuk dan pulang pegawai
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-slate-500 font-medium mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>

            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="ALL">Semua Sub Bagian</option>
              {subBagianList.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="ALL">Semua Status</option>
              <option value="Hadir">Hadir</option>
              <option value="Terlambat">Terlambat</option>
              <option value="TK">TK (Tanpa Keterangan)</option>
            </select>

            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="ALL">Semua Metode</option>
              <option value="WFO">WFO</option>
              <option value="WFH">WFH</option>
              <option value="WFA">WFA</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Nama Pegawai</th>
                <th className="px-4 py-3 font-semibold">NIP/NIK</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Jam Masuk</th>
                <th className="px-4 py-3 font-semibold">Jam Pulang</th>
                <th className="px-4 py-3 font-semibold">Metode Kerja</th>
                <th className="px-4 py-3 font-semibold">Lokasi & Jarak</th>
                <th className="px-4 py-3 font-semibold text-center">Foto Selfie</th>
                <th className="px-4 py-3 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-xs">
                    Belum ada pegawai yang absen pada filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredAttendances.map((a: any) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        {a.foto_profil ? (
                          <img
                            src={a.foto_profil}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-linear-to-tr from-emerald-700 to-teal-700 text-white text-[10px] font-bold flex items-center justify-center">
                            {a.nama_lengkap ? a.nama_lengkap.charAt(0) : 'P'}
                          </div>
                        )}
                        <span>{a.nama_lengkap}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{a.nip_nik}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          a.status === 'Hadir'
                            ? 'bg-emerald-100 text-emerald-800'
                            : a.status === 'Terlambat'
                            ? 'bg-amber-100 text-amber-800'
                            : a.status === 'TK'
                            ? 'bg-rose-100 text-rose-800 font-bold border border-rose-200'
                            : a.status === 'Menunggu Persetujuan'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-700">
                      {a.jam_masuk || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-700">
                      {a.jam_pulang || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          a.metode_kerja === 'WFO'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : a.metode_kerja === 'WFH'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-teal-50 text-teal-700 border border-teal-200'
                        }`}
                      >
                        {a.metode_kerja}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <button
                        onClick={() => setSelectedLocationRecord(a)}
                        className="flex items-center gap-1.5 text-[11px] hover:text-teal-700 text-left cursor-pointer group transition-colors"
                        title="Verifikasi titik koordinat kehadiran di Google Maps"
                      >
                        <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-slate-700 group-hover:text-teal-700 underline decoration-slate-300 group-hover:decoration-teal-600 underline-offset-2">
                          {a.jarak_dari_kantor ? `${Math.round(a.jarak_dari_kantor)} m` : 'Lihat Titik GPS'}
                        </span>
                      </button>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        ({a.status_validasi_lokasi})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {a.foto_masuk ? (
                          <button
                            onClick={() =>
                              setViewPhoto({
                                title: `Foto Masuk - ${a.nama_lengkap} (${a.jam_masuk})`,
                                url: a.foto_masuk
                              })
                            }
                            className="p-1 text-slate-500 hover:text-red-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Lihat foto selfie masuk"
                          >
                            <img
                              src={a.foto_masuk}
                              alt="Masuk"
                              className="w-7 h-7 rounded-md object-cover ring-1 ring-slate-200"
                            />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}

                        {a.foto_pulang && (
                          <button
                            onClick={() =>
                              setViewPhoto({
                                title: `Foto Pulang - ${a.nama_lengkap} (${a.jam_pulang})`,
                                url: a.foto_pulang
                              })
                            }
                            className="p-1 text-slate-500 hover:text-red-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Lihat foto selfie pulang"
                          >
                            <img
                              src={a.foto_pulang}
                              alt="Pulang"
                              className="w-7 h-7 rounded-md object-cover ring-1 ring-slate-200"
                            />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedLocationRecord(a)}
                          title="Verifikasi titik koordinat kehadiran di Google Maps"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-teal-700 hover:text-white bg-teal-50 hover:bg-teal-700 border border-teal-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Peta</span>
                        </button>
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              id: a.id,
                              nama: a.nama_lengkap,
                              nip: a.nip_nik,
                              jamMasuk: a.jam_masuk || '-'
                            })
                          }
                          title="Hapus data absensi agar pegawai bisa mengulang absen"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-red-700 hover:text-white bg-red-50 hover:bg-red-700 border border-red-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
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

      {/* Modal Foto Selfie */}
      {viewPhoto && (
        <Modal
          isOpen={true}
          onClose={() => setViewPhoto(null)}
          title={viewPhoto.title}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col items-center">
            <img
              src={viewPhoto.url}
              alt="Selfie absensi"
              className="w-full h-80 object-cover rounded-xl shadow-md border border-slate-200"
            />
            <button
              onClick={() => setViewPhoto(null)}
              className="mt-4 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-900 cursor-pointer"
            >
              Tutup Foto
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Konfirmasi Hapus Absensi */}
      {deleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Konfirmasi Hapus Data Presensi"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-sm text-red-900">
                <Trash2 className="w-4 h-4 text-red-600" />
                Hapus Data Absensi Pegawai
              </div>
              <p>
                Anda akan menghapus data kehadiran untuk:
              </p>
              <div className="bg-white p-2.5 rounded-lg border border-red-200 space-y-1 text-slate-800">
                <div><strong>Nama:</strong> {deleteConfirm.nama}</div>
                <div><strong>NIP:</strong> {deleteConfirm.nip}</div>
                <div><strong>Jam Masuk:</strong> {deleteConfirm.jamMasuk} WIB</div>
              </div>
              <p className="text-red-700 font-semibold pt-1">
                ⚠️ Setelah dihapus, status presensi pegawai akan kembali kosong dan pegawai dapat melakukan absensi ulang di perangkatnya.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAttendance}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
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
      />

      {/* Manual Attendance Input Modal */}
      <ManualAttendanceModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSuccess={() => {
          fetchDashboard(false);
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
