import React, { useState, useEffect } from 'react';
import { CheckSquare, History, FilePlus, Sparkles } from 'lucide-react';
import { ApprovalCuti } from './ApprovalCuti';
import { RiwayatPengajuanCuti } from './RiwayatPengajuanCuti';
import { PengajuanCuti } from '../pegawai/PengajuanCuti';

interface ManajemenCutiHubProps {
  initialTab?: 'approval' | 'riwayat' | 'ajukan';
}

export const ManajemenCutiHub: React.FC<ManajemenCutiHubProps> = ({ initialTab = 'approval' }) => {
  const [activeTab, setActiveTab] = useState<'approval' | 'riwayat' | 'ajukan'>(initialTab);

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
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Persetujuan & Riwayat Pengajuan Cuti</span>
            </h2>
            <p className="text-xs text-slate-500">
              Pusat administrasi permohonan cuti pegawai KPU Kota Sungai Penuh
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 w-fit">
          <button
            id="tab-approval-cuti"
            onClick={() => setActiveTab('approval')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'approval'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>1. Menunggu Approval</span>
          </button>

          <button
            id="tab-riwayat-cuti"
            onClick={() => setActiveTab('riwayat')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'riwayat'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>2. Riwayat & Arsip Lengkap</span>
          </button>

          <button
            id="tab-ajukan-cuti"
            onClick={() => setActiveTab('ajukan')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'ajukan'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <FilePlus className="w-4 h-4" />
            <span>3. Input Pengajuan Cuti</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === 'approval' && <ApprovalCuti />}
        {activeTab === 'riwayat' && <RiwayatPengajuanCuti />}
        {activeTab === 'ajukan' && <PengajuanCuti />}
      </div>
    </div>
  );
};
