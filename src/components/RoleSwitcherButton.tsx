import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, Shield, User, ArrowRightLeft, Check, ChevronDown } from 'lucide-react';
import { Role } from '../types';

interface RoleSwitcherButtonProps {
  variant?: 'compact' | 'full' | 'banner';
  className?: string;
  onRoleSwitched?: (newRole: string) => void;
}

const ROLE_LABELS: Record<string, { label: string; desc: string; badgeColor: string }> = {
  pegawai: {
    label: 'Mode Pegawai',
    desc: 'Layanan presensi mandiri, pengajuan cuti, & profil pegawai',
    badgeColor: 'bg-emerald-500 text-white'
  },
  operator_sdm: {
    label: 'Operator SDM & Parmas',
    desc: 'Verifikasi cuti, persetujuan luar radius, saldo cuti, & WFH/WFA',
    badgeColor: 'bg-blue-600 text-white'
  },
  operator_keuangan: {
    label: 'Operator Keuangan',
    desc: 'Perhitungan tukin, rekap potongan kehadiran, & kelas jabatan',
    badgeColor: 'bg-amber-600 text-white'
  },
  operator_umum: {
    label: 'Operator Umum & SPPD',
    desc: 'Manajemen Surat Tugas perjalanan dinas & logistik',
    badgeColor: 'bg-teal-600 text-white'
  }
};

export const RoleSwitcherButton: React.FC<RoleSwitcherButtonProps> = ({
  variant = 'compact',
  className = '',
  onRoleSwitched
}) => {
  const { user, switchRole } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dedicated admin accounts do not switch to pegawai
  if (!user || !user.employeeId) {
    return null;
  }

  const assignedOp = (user.operator_role || user.assigned_operator_role || '').trim();
  if (!assignedOp || assignedOp === 'none') {
    return null;
  }

  // Calculate available roles for this employee
  const availableRoles: string[] = ['pegawai'];
  if (assignedOp === 'all_operator') {
    availableRoles.push('operator_sdm', 'operator_keuangan', 'operator_umum');
  } else {
    assignedOp.split(',').map(r => r.trim()).forEach(r => {
      if (r && !availableRoles.includes(r)) availableRoles.push(r);
    });
  }

  const currentRole = user.role;
  const isCurrentlyPegawai = currentRole === 'pegawai';

  const handleSwitch = async (targetRole: string) => {
    if (targetRole === currentRole) {
      setShowDropdown(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);
      await switchRole(targetRole);
      setShowDropdown(false);
      if (onRoleSwitched) {
        onRoleSwitched(targetRole);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengganti role.');
    } finally {
      setIsLoading(false);
    }
  };

  // Determine target role for single-click toggle when only 1 operator role is assigned
  const defaultOperatorRole = availableRoles.find(r => r !== 'pegawai') || 'operator_sdm';
  const quickTargetRole = isCurrentlyPegawai ? defaultOperatorRole : 'pegawai';
  const quickTargetInfo = ROLE_LABELS[quickTargetRole] || {
    label: quickTargetRole.replace('_', ' ').toUpperCase(),
    desc: '',
    badgeColor: 'bg-blue-600 text-white'
  };

  // 1. Banner Variant (e.g. inside DashboardPegawai or Admin Portal)
  if (variant === 'banner') {
    return (
      <div className={`p-4 rounded-2xl border shadow-sm transition-all ${
        isCurrentlyPegawai
          ? 'bg-gradient-to-r from-blue-900/90 via-indigo-900/90 to-slate-900 text-white border-blue-700/50'
          : 'bg-gradient-to-r from-emerald-900/90 via-teal-900/90 to-slate-900 text-white border-emerald-700/50'
      } ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${isCurrentlyPegawai ? 'bg-blue-600/30 text-blue-300' : 'bg-emerald-600/30 text-emerald-300'} border border-white/10 shrink-0`}>
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                  Ganti Hak Akses Terpasang
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/20 text-white">
                  Aktif: {ROLE_LABELS[currentRole]?.label || currentRole}
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                {isCurrentlyPegawai
                  ? `Anda ditugaskan sebagai ${ROLE_LABELS[defaultOperatorRole]?.label || 'Operator'}. Beralih ke Portal Operator untuk melakukan approval cuti & tugas operasional.`
                  : 'Saat ini Anda berada di Portal Operator. Klik tombol untuk kembali ke Mode Presensi Mandiri Pegawai.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {availableRoles.length <= 2 ? (
              <button
                type="button"
                onClick={() => handleSwitch(quickTargetRole)}
                disabled={isLoading}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                  isCurrentlyPegawai
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                } disabled:opacity-50`}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Ganti ke {quickTargetInfo.label}</span>
                  </>
                )}
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Pilih Mode Akses</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs">
                    {availableRoles.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleSwitch(r)}
                        className={`w-full text-left p-2 rounded-lg flex items-center justify-between transition-colors ${
                          currentRole === r
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{ROLE_LABELS[r]?.label || r}</div>
                          <div className="text-[10px] text-slate-400">{ROLE_LABELS[r]?.desc}</div>
                        </div>
                        {currentRole === r && <Check className="w-4 h-4 text-white shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-2 text-[11px] text-rose-300 font-medium">
            {errorMsg}
          </div>
        )}
      </div>
    );
  }

  // 2. Full Variant
  if (variant === 'full') {
    return (
      <div className={`relative inline-block ${className}`}>
        {availableRoles.length <= 2 ? (
          <button
            type="button"
            onClick={() => handleSwitch(quickTargetRole)}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-300/40 bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 text-xs font-semibold backdrop-blur-xs transition-colors cursor-pointer disabled:opacity-50"
            title={`Beralih ke ${quickTargetInfo.label}`}
          >
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-blue-300" />
            )}
            <span>Beralih ke {quickTargetInfo.label}</span>
          </button>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-300/40 bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 text-xs font-semibold backdrop-blur-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-300" />
              <span>Ganti Mode</span>
              <ChevronDown className="w-3 h-3 text-blue-300" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 text-slate-800 text-xs">
                {availableRoles.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleSwitch(r)}
                    className={`w-full text-left p-2 rounded-lg flex items-center justify-between transition-colors ${
                      currentRole === r
                        ? 'bg-blue-50 text-blue-900 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{ROLE_LABELS[r]?.label || r}</div>
                      <div className="text-[10px] text-slate-500">{ROLE_LABELS[r]?.desc}</div>
                    </div>
                    {currentRole === r && <Check className="w-4 h-4 text-blue-700 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3. Compact Variant (for top app bars / mobile headers)
  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {availableRoles.length <= 2 ? (
        <button
          type="button"
          onClick={() => handleSwitch(quickTargetRole)}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold backdrop-blur-xs transition-all border border-white/25 shadow-xs cursor-pointer disabled:opacity-50"
          title={`Klik untuk berganti ke ${quickTargetInfo.label}`}
        >
          {isLoading ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <ArrowRightLeft className="w-3.5 h-3.5 text-sky-200" />
          )}
          <span>
            {isCurrentlyPegawai ? `Mode Operator` : `Mode Pegawai`}
          </span>
        </button>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold backdrop-blur-xs transition-all border border-white/25 shadow-xs cursor-pointer disabled:opacity-50"
            title="Klik untuk memilih mode role"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-sky-200" />
            <span>Ganti Role</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 text-white rounded-xl shadow-2xl p-1.5 z-50 text-xs">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                Pilih Mode Akses
              </div>
              {availableRoles.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleSwitch(r)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                    currentRole === r
                      ? 'bg-blue-600 text-white font-bold'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <span>{ROLE_LABELS[r]?.label || r}</span>
                  {currentRole === r && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
