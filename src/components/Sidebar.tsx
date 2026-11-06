import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useFeatureLock } from '../context/FeatureLockContext';
import { RoleSwitcherButton } from './RoleSwitcherButton';
import {
  LayoutDashboard,
  CalendarCheck,
  CheckSquare,
  History,
  FileSpreadsheet,
  WalletCards,
  RefreshCw,
  Users,
  Laptop,
  ClipboardList,
  Eye,
  Settings,
  LogOut,
  Camera,
  CalendarDays,
  UserCheck,
  KeyRound,
  FilePlus,
  ShieldAlert,
  Briefcase,
  Coins,
  Lock,
  Smartphone
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpen,
  onClose
}) => {
  const { user, logout } = useAuth();
  const { isFeatureLocked, isFeatureLockedInSystem, features } = useFeatureLock();
  const lockedCount = features.filter(f => f.is_locked).length;

  const handleNavClick = (viewKey: string) => {
    onSelectView(viewKey);
    onClose();
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator Sistem';
      case 'operator_sdm':
        return 'Operator SDM & Kepegawaian';
      case 'operator_keuangan':
        return 'Operator Keuangan & Tukin';
      case 'operator_umum':
        return 'Operator Umum & Logistik';
      default:
        return user?.jabatan || 'Pegawai KPU';
    }
  };

  // 1. Navigation for Super Admin
  const adminNavItems = [
    { key: 'admin-dashboard', label: 'Dashboard & Analitik', icon: LayoutDashboard, section: 'Rilis Utama: Presensi & WFH/WFA' },
    { key: 'admin-presensi', label: 'Presensi & Approval Radius', icon: Eye },
    { key: 'admin-wfh-wfa', label: 'Penetapan WFH/WFA Masal', icon: Laptop },
    { key: 'admin-cuti', label: 'Persetujuan & Surat Cuti', icon: CheckSquare, section: 'Rilis Utama: Manajemen Cuti' },
    { key: 'admin-saldo', label: 'Saldo & Rollover Cuti', icon: WalletCards },
    { key: 'admin-rekap-penggunaan-cuti', label: 'Rekapitulasi Cuti Tahunan', icon: FileSpreadsheet },
    { key: 'admin-data-pegawai', label: 'Data Pegawai & Akun', icon: Users, section: 'Data Master' },
    { key: 'admin-pengaturan', label: 'Pengaturan Sistem', icon: Settings, section: 'Sistem & Keamanan' },
    { key: 'admin-kunci-fitur', label: 'Kunci & Rilis Fitur', icon: Lock },
    { key: 'admin-audit-log', label: 'Audit Log & Keamanan', icon: ShieldAlert },
    { key: 'pegawai-dashboard', label: '📱 Pratinjau SIAP Mobile', icon: Smartphone, section: 'Aplikasi Mobile Pegawai' },
    { key: 'admin-perjalanan-dinas', label: 'Perjalanan Dinas (SPPD)', icon: Briefcase, section: 'Modul Tahap 2 (Berikutnya)', badge: 'Tahap 2' },
    { key: 'admin-tukin', label: 'Perhitungan Tunjangan Kinerja', icon: Coins, badge: 'Tahap 2' },
  ];

  // 2. Navigation for Operator SDM
  const operatorSdmNavItems = [
    { key: 'admin-dashboard', label: 'Dashboard SDM', icon: LayoutDashboard, section: 'Rilis Utama: Presensi & WFH/WFA' },
    { key: 'admin-presensi', label: 'Presensi & Approval Radius', icon: Eye },
    { key: 'admin-wfh-wfa', label: 'Penetapan WFH/WFA Masal', icon: Laptop },
    { key: 'admin-cuti', label: 'Persetujuan Cuti Pegawai', icon: CheckSquare, section: 'Rilis Utama: Manajemen Cuti' },
    { key: 'admin-saldo', label: 'Saldo & Rollover Cuti', icon: WalletCards },
    { key: 'admin-rekap-penggunaan-cuti', label: 'Rekap Penggunaan Cuti', icon: FileSpreadsheet },
    { key: 'admin-data-pegawai', label: 'Data Pegawai & Akun', icon: Users, section: 'Data Master' },
    { key: 'admin-perjalanan-dinas', label: 'Perjalanan Dinas (SPPD)', icon: Briefcase, section: 'Modul Tahap 2 (Berikutnya)', badge: 'Tahap 2' },
    { key: 'admin-tukin', label: 'Rekapitulasi Tukin', icon: Coins, badge: 'Tahap 2' },
  ];

  // 3. Navigation for Operator Keuangan
  const operatorKeuanganNavItems = [
    { key: 'admin-dashboard', label: 'Dashboard Keuangan', icon: LayoutDashboard, section: 'Rilis Utama: Presensi' },
    { key: 'admin-presensi', label: 'Rekap Presensi Pegawai', icon: Eye },
    { key: 'admin-tukin', label: 'Perhitungan Tukin', icon: Coins, section: 'Modul Tahap 2 (Berikutnya)', badge: 'Tahap 2' },
    { key: 'admin-perjalanan-dinas', label: 'Anggaran Perjalanan Dinas', icon: Briefcase, badge: 'Tahap 2' },
  ];

  // 4. Navigation for Operator Umum
  const operatorUmumNavItems = [
    { key: 'admin-dashboard', label: 'Dashboard Umum & Logistik', icon: LayoutDashboard, section: 'Rilis Utama: Presensi & WFH/WFA' },
    { key: 'admin-presensi', label: 'Monitoring Presensi Harian', icon: Eye },
    { key: 'admin-wfh-wfa', label: 'Penetapan WFH/WFA', icon: Laptop },
    { key: 'admin-perjalanan-dinas', label: 'Perjalanan Dinas (SPPD)', icon: Briefcase, section: 'Modul Tahap 2 (Berikutnya)', badge: 'Tahap 2' },
  ];

  // 5. Navigation for Pegawai
  const pegawaiNavItems = [
    { key: 'pegawai-dashboard', label: 'Dashboard & Presensi', icon: LayoutDashboard, section: 'Rilis Utama: Presensi & WFH/WFA' },
    { key: 'pegawai-riwayat-absensi', label: 'Riwayat Presensi Mandiri', icon: CalendarCheck },
    { key: 'pegawai-ajukan-cuti', label: 'Pengajuan & Surat Cuti', icon: FilePlus, section: 'Rilis Utama: Layanan Cuti' },
    { key: 'pegawai-saldo-cuti', label: 'Saldo & Kalender Cuti', icon: WalletCards },
    { key: 'pegawai-profil', label: 'Profil & Keamanan Akun', icon: UserCheck, section: 'Pengaturan Akun' },
  ];

  const getNavItems = () => {
    switch (user?.role) {
      case 'admin':
        return adminNavItems;
      case 'operator_sdm':
        return operatorSdmNavItems;
      case 'operator_keuangan':
        return operatorKeuanganNavItems;
      case 'operator_umum':
        return operatorUmumNavItems;
      default:
        return pegawaiNavItems;
    }
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col border-r border-slate-800`}
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3 h-16 px-5 border-b border-slate-800 bg-slate-950/60">
          <img
            src="https://www.kpu.go.id/images/1627539868logo-kpu.png"
            alt="Logo KPU"
            className="w-8 h-8 object-contain shrink-0 drop-shadow-xs"
          />
          <div className="overflow-hidden">
            <h2 className="text-sm font-black text-white tracking-wider truncate flex items-center gap-1.5">
              <span>SITENANG</span>
            </h2>
            <p className="text-[10px] text-teal-400 font-semibold truncate">
              KPU KOTA SUNGAI PENUH
            </p>
          </div>
        </div>

        {/* User Info Bar */}
        <div className="px-5 py-3.5 bg-slate-850/60 border-b border-slate-800/80">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
            Masuk Sebagai:
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <div className="text-xs font-semibold text-white truncate">
              {user?.namaLengkap}
            </div>
          </div>
          <div className="text-[10px] text-slate-400 truncate mt-0.5">
            {getRoleLabel(user?.role)}
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentView === item.key;
            const isRestrictedForMe = isFeatureLocked(item.key);
            const isSystemLocked = isFeatureLockedInSystem(item.key);
            const isLocked = isRestrictedForMe || isSystemLocked;
            const isFeatureManager = item.key === 'admin-kunci-fitur';
            const showSection = item.section && (index === 0 || navItems[index - 1].section !== item.section);

            return (
              <React.Fragment key={item.key}>
                {showSection && (
                  <div className={`px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
                    item.section?.includes('Rilis Utama')
                      ? 'text-teal-400 font-extrabold'
                      : 'text-slate-400'
                  }`}>
                    <span>{item.section}</span>
                    {item.section?.includes('Rilis Utama') && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        Prioritas 1
                      </span>
                    )}
                  </div>
                )}

                <button
                  id={`nav-${item.key}`}
                  onClick={() => handleNavClick(item.key)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-linear-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7] text-white shadow-xs font-semibold'
                      : isLocked
                      ? 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive
                          ? 'text-white'
                          : isLocked
                          ? 'text-amber-400/90'
                          : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(item as any).badge && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                        {(item as any).badge}
                      </span>
                    )}

                    {isLocked && (
                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                        isRestrictedForMe
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-amber-500/10 text-amber-400/90 border-amber-500/30'
                      }`}>
                        <Lock className="w-2.5 h-2.5" />
                        Terkunci
                      </span>
                    )}

                    {isFeatureManager && lockedCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {lockedCount} Kunci
                      </span>
                    )}
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Footer with Role Switcher & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 space-y-2">
          <RoleSwitcherButton variant="full" onRoleSwitched={() => onClose()} />
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>
    </>
  );
};
