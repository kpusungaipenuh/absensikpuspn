import React from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  AlertTriangle,
  FileCheck2,
  X,
  UserCheck
} from 'lucide-react';
import { Modal } from '../Modal';

export interface AttendanceSuccessData {
  type: 'IN' | 'OUT';
  jam: string;
  tanggal: string;
  status: string;
  distanceMeters?: number | null;
  isInsideRadius?: boolean;
  isEmergency?: boolean;
  lateMinutes?: number;
  requiredOutStr?: string;
  isPotongTukin?: boolean;
  kurangMenit?: number;
  photo?: string | null;
  message?: string;
}

interface AttendanceSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AttendanceSuccessData | null;
}

export const AttendanceSuccessModal: React.FC<AttendanceSuccessModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  if (!isOpen || !data) return null;

  const isCheckIn = data.type === 'IN';
  const isEmergency = Boolean(data.isEmergency);
  const isLate = data.status === 'Terlambat' || (data.lateMinutes && data.lateMinutes > 0);
  const isTk = data.status === 'TK';

  // Format readable Indonesian Date
  const formatDateIndo = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="max-w-md"
    >
      <div className="text-center space-y-4 pt-1 pb-2">
        {/* Animated Celebration Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-linear-to-tr from-emerald-500/20 via-teal-500/20 to-sky-500/20 animate-pulse absolute inset-0 -m-1" />
          <div className="w-16 h-16 rounded-full bg-linear-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-700/30 relative z-10">
            {isEmergency ? (
              <FileCheck2 className="w-8 h-8 text-amber-200" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-white" />
            )}
          </div>
        </div>

        {/* Title and Confirmation Subtext */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full inline-block">
            Konfirmasi Presensi Instan
          </span>
          <h3 className="text-xl font-black text-slate-900 mt-2">
            {isEmergency
              ? 'Pengajuan Luar Radius Terkirim!'
              : isCheckIn
              ? 'Presensi Masuk Berhasil!'
              : 'Presensi Pulang Berhasil!'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            {isEmergency
              ? 'Data dan lampiran formulir alasan kendala Anda telah berhasil diteruskan ke Admin KPU Kota Sungai Penuh.'
              : 'Kehadiran fisik Anda telah diverifikasi oleh sistem geofencing dan pengenal swafoto SITENANG.'}
          </p>
        </div>

        {/* Status Badge */}
        <div>
          {isEmergency ? (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold shadow-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Menunggu Persetujuan SDM (Luar Radius)</span>
            </div>
          ) : isTk ? (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-100 text-rose-900 border border-rose-300 text-xs font-bold shadow-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Status: TK (Tanpa Keterangan - Lewat 08:29 WIB)</span>
            </div>
          ) : isLate ? (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold shadow-xs">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Terlambat {data.lateMinutes} Menit</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold shadow-xs">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Tepat Waktu &mdash; Status: Hadir</span>
            </div>
          )}
        </div>

        {/* Detailed Receipt Card */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-left space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-slate-500 font-medium">Jenis Presensi</span>
            <span className="font-extrabold text-slate-900">
              {isCheckIn ? 'Absen Masuk (Check-In)' : 'Absen Pulang (Check-Out)'}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-slate-500 font-medium">Waktu Tercatat</span>
            <span className="font-black text-teal-700 font-mono text-sm">
              {data.jam} WIB
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-slate-500 font-medium">Tanggal</span>
            <span className="font-semibold text-slate-800">
              {formatDateIndo(data.tanggal)}
            </span>
          </div>

          <div className="flex items-start justify-between pb-2 border-b border-slate-200/80">
            <span className="text-slate-500 font-medium">Lokasi Geofence</span>
            <div className="text-right">
              <span className="font-bold text-slate-800 block">
                {data.distanceMeters !== undefined && data.distanceMeters !== null
                  ? `${data.distanceMeters} meter dari kantor`
                  : 'Terverifikasi GPS'}
              </span>
              <span className={`text-[10px] font-bold ${data.isInsideRadius ? 'text-emerald-700' : 'text-amber-700'}`}>
                {data.isInsideRadius ? '✓ Dalam Radius Kantor KPU' : '⚠ Di Luar Batas Radius'}
              </span>
            </div>
          </div>

          {/* Additional note for Late arrival */}
          {isLate && data.requiredOutStr && (
            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] space-y-1">
              <span className="font-bold flex items-center gap-1 text-amber-950">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Ketentuan Jam Pengganti Keterlambatan:
              </span>
              <p className="leading-relaxed">
                Anda wajib menyelesaikan jam pengganti hari ini hingga pukul <strong>{data.requiredOutStr} WIB</strong> saat absen pulang agar tidak dikenakan pemotongan Tukin.
              </p>
            </div>
          )}

          {/* Additional note for Tukin cut on early checkout */}
          {data.isPotongTukin && (
            <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-[11px] space-y-1">
              <span className="font-bold flex items-center gap-1 text-rose-950">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Pemberitahuan Pemotongan Tukin:
              </span>
              <p className="leading-relaxed">
                Anda tercatat pulang sebelum jam wajib pengganti (kurang {data.kurangMenit || 0} menit). Sistem mencatat pemotongan Tunjangan Kinerja sesuai regulasi disiplin ASN.
              </p>
            </div>
          )}

          {/* Selfie Photo Preview (if available) */}
          {data.photo && (
            <div className="pt-2 flex items-center justify-between">
              <span className="text-slate-500 text-[11px]">Bukti Swafoto Terlampir:</span>
              <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-teal-600 shadow-xs">
                <img src={data.photo} alt="Bukti Selfie" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-linear-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7] hover:brightness-105 text-white font-bold rounded-2xl shadow-md text-xs cursor-pointer transition-all active:scale-[0.98]"
        >
          Tutup & Kembali ke Beranda
        </button>
      </div>
    </Modal>
  );
};
