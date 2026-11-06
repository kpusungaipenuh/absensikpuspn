import React, { useState, useEffect } from 'react';
import { WalletCards, CalendarDays } from 'lucide-react';
import { SaldoCutiPegawai } from './SaldoCutiPegawai';
import { KalenderCuti } from './KalenderCuti';

interface SaldoKalenderHubProps {
  initialTab?: 'saldo' | 'kalender';
}

export const SaldoKalenderHub: React.FC<SaldoKalenderHubProps> = ({ initialTab = 'saldo' }) => {
  const [activeTab, setActiveTab] = useState<'saldo' | 'kalender'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Saldo Cuti & Kalender Hari Libur
            </h2>
            <p className="text-xs text-slate-500">
              Informasi saldo hak cuti tahunan (N-2, N-1, N) dan jadwal libur nasional serta cuti bersama
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 w-fit">
          <button
            id="tab-pegawai-saldo"
            onClick={() => setActiveTab('saldo')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'saldo'
                ? 'bg-white text-red-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <WalletCards className="w-4 h-4" />
            <span>1. Rincian Saldo & Mutasi Cuti Saya</span>
          </button>

          <button
            id="tab-pegawai-kalender"
            onClick={() => setActiveTab('kalender')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'kalender'
                ? 'bg-white text-red-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>2. Kalender Libur & Cuti Bersama</span>
          </button>
        </div>
      </div>

      <div>
        {activeTab === 'saldo' && <SaldoCutiPegawai />}
        {activeTab === 'kalender' && <KalenderCuti />}
      </div>
    </div>
  );
};
