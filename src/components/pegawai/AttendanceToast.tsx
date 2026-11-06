import React, { useEffect } from 'react';
import { CheckCircle2, X, AlertTriangle, ArrowRight } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'info';
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
}

interface AttendanceToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  duration?: number;
}

export const AttendanceToast: React.FC<AttendanceToastProps> = ({
  toast,
  onDismiss,
  duration = 7000
}) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, duration, onDismiss]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
      <div
        className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
          toast.type === 'success'
            ? 'bg-emerald-900/95 text-white border-emerald-500/60 shadow-emerald-950/40'
            : toast.type === 'warning'
            ? 'bg-amber-900/95 text-white border-amber-500/60 shadow-amber-950/40'
            : 'bg-slate-900/95 text-white border-slate-700 shadow-slate-950/40'
        }`}
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white shadow-md'
              : toast.type === 'warning'
              ? 'bg-amber-500 text-amber-950 shadow-md'
              : 'bg-sky-500 text-white shadow-md'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <h4 className="font-extrabold text-xs tracking-wide leading-tight">
            {toast.title}
          </h4>
          <p className="text-[11px] text-slate-200 mt-0.5 leading-relaxed">
            {toast.message}
          </p>

          {toast.actionText && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                onDismiss();
              }}
              className="mt-2 text-[11px] font-bold text-emerald-200 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{toast.actionText}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
          aria-label="Tutup notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
