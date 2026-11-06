import React, { useState, useEffect } from 'react';
import { WalletCards, RefreshCw } from 'lucide-react';
import { SisaSaldoCutiTahunan } from './SisaSaldoCutiTahunan';
import { RolloverCutiTahunan } from './RolloverCutiTahunan';

interface SaldoRolloverHubProps {
  initialTab?: 'saldo' | 'rollover';
}

export const SaldoRolloverHub: React.FC<SaldoRolloverHubProps> = ({ initialTab = 'saldo' }) => {
  const [activeTab, setActiveTab] = useState<'saldo' | 'rollover'>(initialTab);

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
              Manajemen Saldo Cuti & Rollover Tahunan
            </h2>
            <p className="text-xs text-slate-500">
              Pengelolaan saldo cuti tahunan (N-2, N-1, N), penyesuaian manual, dan pelaksanaan rollover otomatis akhir tahun
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 w-fit">
          <button
            id="tab-saldo-cuti"
            onClick={() => setActiveTab('saldo')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'saldo'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <WalletCards className="w-4 h-4" />
            <span>1. Sisa Saldo Cuti Pegawai (N-2, N-1, N)</span>
          </button>

          <button
            id="tab-rollover-cuti"
            onClick={() => setActiveTab('rollover')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'rollover'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>2. Proses & Riwayat Rollover Tahunan</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === 'saldo' && <SisaSaldoCutiTahunan />}
        {activeTab === 'rollover' && <RolloverCutiTahunan />}
      </div>
    </div>
  );
};
