import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { LeaveBalance } from '../../types';

interface LeaveExpiryReminderBannerProps {
  balance: LeaveBalance | null;
  onNavigate?: (page: string) => void;
}

export const LeaveExpiryReminderBanner: React.FC<LeaveExpiryReminderBannerProps> = ({
  balance,
  onNavigate
}) => {
  const [simulateExpiringSoon, setSimulateExpiringSoon] = useState(false);

  const currentYear = new Date().getFullYear();
  const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);
  const today = new Date();
  const realDaysLeft = Math.max(0, Math.ceil((endOfYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // If simulation is active, use 18 days left to demonstrate the <= 30 days trigger
  const daysLeft = simulateExpiringSoon ? 18 : realDaysLeft;
  const isExpiringWithin30Days = daysLeft <= 30;

  const totalLeave = balance?.total ?? 0;
  const n2Leave = balance?.n_2 ?? 0;
  const n1Leave = balance?.n_1 ?? 0;
  const nLeave = balance?.n ?? 0;

  // Don't show if employee has no remaining leave days and not simulating
  if (totalLeave === 0 && !simulateExpiringSoon) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* 1. URGENT ALERT BANNER: Only shown when <= 30 days left until expiration */}
      {isExpiringWithin30Days ? (
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-amber-500 via-orange-500 to-rose-600 p-0.5 shadow-md shadow-amber-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-slate-900/90 backdrop-blur-md rounded-[14px] p-4 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-sans">
                      Kedaluwarsa dlm {daysLeft} Hari!
                    </span>
                    <span className="text-[11px] text-amber-200/90 font-medium">
                      Batas Akhir: 31 Desember {currentYear}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-white mt-1">
                    Peringatan: Sisa Jatah Cuti Tahunan Segera Hangus ({totalLeave} Hari)
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Anda masih memiliki hak cuti tahunan yang belum digunakan. Berdasarkan regulasi kepegawaian KPU, sisa hak cuti tahun berjalan yang tidak diambil akan hangus saat tahun anggaran berakhir.
                  </p>

                  {/* Breakdown pill badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-white/10 text-[10.5px]">
                    <span className="text-slate-300">Rincian Hak Cuti:</span>
                    {n2Leave > 0 && (
                      <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md font-bold">
                        N-2: {n2Leave} Hari (Wajib Hangus)
                      </span>
                    )}
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-semibold">
                      N-1: {n1Leave} Hari
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md font-semibold">
                      N (Thn Ini): {nLeave} Hari
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0">
                <button
                  type="button"
                  id="btn-ajukan-cuti-expiry"
                  onClick={() => onNavigate && onNavigate('pegawai-ajukan-cuti')}
                  className="w-full sm:w-auto px-4 py-2.5 bg-linear-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Ajukan Cuti Sekarang</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {simulateExpiringSoon && (
                  <button
                    type="button"
                    onClick={() => setSimulateExpiringSoon(false)}
                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Kembali ke Status Riil
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 2. REGULAR STATUS CARD: Displays remaining balance and countdown towards 30-day window */
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs text-slate-800">
                  Status Sisa Jatah Cuti Tahunan
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Tersedia {totalLeave} Hari
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 mt-0.5">
                Kedaluwarsa pada 31 Des {currentYear} • <span className="font-bold text-slate-700">{realDaysLeft} hari lagi</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Simulation button so user can test the 30-day alert state at any time of year */}
            <button
              type="button"
              onClick={() => setSimulateExpiringSoon(true)}
              className="px-2.5 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
              title="Simulasikan tampilan saat memasuki batas 30 hari sebelum kedaluwarsa"
            >
              Simulasi &le; 30 Hari
            </button>

            <button
              type="button"
              onClick={() => onNavigate && onNavigate('pegawai-ajukan-cuti')}
              className="px-3 py-1.5 text-xs font-bold text-teal-800 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Ajukan Cuti</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
