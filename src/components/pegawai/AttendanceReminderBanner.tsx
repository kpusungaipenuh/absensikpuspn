import React from 'react';
import { BellRing, X, ArrowRight, Clock } from 'lucide-react';
import { useAttendanceReminder } from '../../context/AttendanceReminderContext';

export const AttendanceReminderBanner: React.FC<{ onAction?: () => void }> = ({ onAction }) => {
  const { activeAlert, dismissAlert } = useAttendanceReminder();

  if (!activeAlert) return null;

  return (
    <div className="mx-4 mt-3 mb-2 p-3.5 bg-linear-to-r from-amber-600 via-orange-600 to-teal-700 text-white rounded-2xl shadow-lg border border-amber-400/50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-start justify-between gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 mt-0.5">
          <BellRing className="w-4 h-4 text-white animate-bounce" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-black tracking-wide flex items-center gap-1.5">
            <span>{activeAlert.title}</span>
          </h4>
          <p className="text-[11px] text-amber-50 mt-0.5 leading-snug">
            {activeAlert.message}
          </p>

          <div className="flex items-center gap-2 mt-2">
            {onAction && activeAlert.type !== 'TEST' && (
              <button
                type="button"
                onClick={() => {
                  dismissAlert();
                  onAction();
                }}
                className="px-3 py-1.5 bg-white text-amber-900 font-extrabold text-[11px] rounded-xl shadow-xs hover:bg-amber-50 flex items-center gap-1 cursor-pointer transition active:scale-95"
              >
                <span>Buka Presensi Sekarang</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={dismissAlert}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-medium text-[11px] rounded-xl transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismissAlert}
          className="p-1 text-white/70 hover:text-white rounded-lg transition cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
