import React, { useState, useEffect } from 'react';
import { Eye, ClipboardList, ShieldAlert, FileDown, PlusCircle } from 'lucide-react';
import { MonitoringAbsensi } from './MonitoringAbsensi';
import { RekapDaftarHadir } from './RekapDaftarHadir';
import { ApprovalLuarRadius } from './ApprovalLuarRadius';
import { ExportFilteredAttendanceModal } from '../../components/admin/ExportFilteredAttendanceModal';
import { ManualAttendanceModal } from '../../components/admin/ManualAttendanceModal';
import { api } from '../../services/api';

interface PresensiAdminHubProps {
  initialTab?: 'monitoring' | 'rekap' | 'approval';
}

export const PresensiAdminHub: React.FC<PresensiAdminHubProps> = ({ initialTab = 'monitoring' }) => {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'rekap' | 'approval'>(initialTab);
  const [pendingEmergencyCount, setPendingEmergencyCount] = useState<number>(0);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const fetchEmergencyCount = async () => {
    try {
      const res = await api.getPendingEmergencyAttendance();
      setPendingEmergencyCount(res.list?.length || 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchEmergencyCount();
    const interval = setInterval(fetchEmergencyCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="space-y-5">
      {/* Consolidated Header & Tab Navigation */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Monitoring, Rekapitulasi & Persetujuan Presensi
            </h2>
            <p className="text-xs text-slate-500">
              Pemantauan absensi real-time, persetujuan kendala luar radius, dan rekapitulasi daftar hadir pegawai KPU Kota Sungai Penuh
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-manual-attendance"
              onClick={() => setShowManualModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-linear-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-teal-200" />
              <span>+ Input Presensi Manual</span>
            </button>

            <button
              type="button"
              id="btn-export-pdf-hub"
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-linear-to-r from-red-700 to-rose-700 hover:from-red-800 hover:to-rose-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Ekspor PDF / Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 w-fit">
          <button
            id="tab-monitoring-live"
            onClick={() => setActiveTab('monitoring')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'monitoring'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>1. Monitoring Live Hari Ini</span>
          </button>

          <button
            id="tab-approval-emergency"
            onClick={() => setActiveTab('approval')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'approval'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>2. Persetujuan Luar Radius</span>
            {pendingEmergencyCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-extrabold animate-pulse">
                {pendingEmergencyCount}
              </span>
            )}
          </button>

          <button
            id="tab-rekap-hadir"
            onClick={() => setActiveTab('rekap')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'rekap'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>3. Rekapitulasi & Cetak Daftar Hadir</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === 'monitoring' && <MonitoringAbsensi />}
        {activeTab === 'approval' && (
          <ApprovalLuarRadius onCountChange={cnt => setPendingEmergencyCount(cnt)} />
        )}
        {activeTab === 'rekap' && <RekapDaftarHadir />}
      </div>

      {/* Export Filtered Attendance PDF Modal */}
      <ExportFilteredAttendanceModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      {/* Manual Attendance Input Modal for Admin */}
      <ManualAttendanceModal
        key={refreshKey}
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSuccess={() => {
          setRefreshKey(prev => prev + 1);
          fetchEmergencyCount();
        }}
      />
    </div>
  );
};
