import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeatureLockProvider, useFeatureLock } from './context/FeatureLockContext';
import { AttendanceReminderProvider } from './context/AttendanceReminderContext';
import { ThemeProvider } from './context/ThemeContext';
import { Login } from './pages/auth/Login';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LockedFeatureNotice } from './components/LockedFeatureNotice';
import { FeatureLockManager } from './components/admin/FeatureLockManager';

// Admin Pages
import { DashboardAdmin } from './pages/admin/DashboardAdmin';
import { ManajemenCutiHub } from './pages/admin/ManajemenCutiHub';
import { PresensiAdminHub } from './pages/admin/PresensiAdminHub';
import { SaldoRolloverHub } from './pages/admin/SaldoRolloverHub';
import { RekapPenggunaanCuti } from './pages/admin/RekapPenggunaanCuti';
import { DataPegawai } from './pages/admin/DataPegawai';
import { PengaturanWfhWfa } from './pages/admin/PengaturanWfhWfa';
import { PerjalananDinasPage } from './pages/admin/PerjalananDinasPage';
import { PerhitunganTukinPage } from './pages/admin/PerhitunganTukinPage';
import { PengaturanSistem } from './pages/admin/PengaturanSistem';
import { AuditLogPage } from './pages/admin/AuditLogPage';

// Pegawai Pages
import { DashboardPegawai } from './pages/pegawai/DashboardPegawai';
import { RiwayatAbsensiPegawai } from './pages/pegawai/RiwayatAbsensiPegawai';
import { PengajuanCuti } from './pages/pegawai/PengajuanCuti';
import { SaldoKalenderHub } from './pages/pegawai/SaldoKalenderHub';
import { ProfilPegawai } from './pages/pegawai/ProfilPegawai';
import { PegawaiMobileShell } from './components/pegawai/PegawaiMobileShell';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { isFeatureLocked, isFeatureLockedInSystem, getFeature, toggleAdminBypass, updateFeatureStatus, adminBypassList } = useFeatureLock();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<string>('');

  const isAdminOrOperator = ['admin', 'operator_sdm', 'operator_keuangan', 'operator_umum'].includes(
    user?.role || ''
  );

  // Set default view whenever user logs in or role changes
  useEffect(() => {
    if (user) {
      if (isAdminOrOperator) {
        if (user.role === 'operator_keuangan') {
          setCurrentView('admin-tukin');
        } else if (user.role === 'operator_umum') {
          setCurrentView('admin-perjalanan-dinas');
        } else {
          setCurrentView('admin-dashboard');
        }
      } else {
        setCurrentView('pegawai-dashboard');
      }
    }
  }, [user?.role]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-700 border-t-transparent" />
          <span className="text-xs font-semibold text-slate-600">
            Memuat Sistem Absensi & Cuti KPU Kota Sungai Penuh...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Handle navigation mapping between short names and full keys
  const handleNavigate = (page: string) => {
    if (page === 'pengajuan-cuti' || page === 'approval-cuti' || page === 'riwayat-cuti' || page === 'admin-approval-cuti') {
      setCurrentView(isAdminOrOperator ? 'admin-cuti' : 'pegawai-ajukan-cuti');
    } else if (page === 'riwayat-absensi') {
      setCurrentView(isAdminOrOperator ? 'admin-presensi' : 'pegawai-riwayat-absensi');
    } else if (page === 'monitoring-absensi' || page === 'rekap-hadir') {
      setCurrentView('admin-presensi');
    } else if (page === 'data-pegawai') {
      setCurrentView('admin-data-pegawai');
    } else if (page === 'saldo-cuti' || page === 'rollover') {
      setCurrentView(isAdminOrOperator ? 'admin-saldo' : 'pegawai-saldo-cuti');
    } else if (page === 'perjalanan-dinas') {
      setCurrentView('admin-perjalanan-dinas');
    } else if (page === 'tukin') {
      setCurrentView('admin-tukin');
    } else if (page === 'wfh-wfa') {
      setCurrentView('admin-wfh-wfa');
    } else {
      setCurrentView(page);
    }
  };

  const renderContent = () => {
    // Check if the current view is locked for the active user
    if (isFeatureLocked(currentView)) {
      const featureInfo = getFeature(currentView);
      return (
        <LockedFeatureNotice
          feature={featureInfo}
          onNavigateHome={() => handleNavigate(isAdminOrOperator ? 'admin-dashboard' : 'pegawai-dashboard')}
          onNavigateToSettings={() => handleNavigate('admin-kunci-fitur')}
          onAdminBypass={() => toggleAdminBypass(currentView)}
          onQuickUnlock={async () => {
            if (featureInfo) {
              await updateFeatureStatus(featureInfo.id, { is_locked: false });
            }
          }}
        />
      );
    }

    // Admin & Operator Views
    if (isAdminOrOperator) {
      switch (currentView) {
        case 'admin-dashboard':
          return <DashboardAdmin onNavigate={handleNavigate} />;
        case 'admin-cuti':
        case 'admin-approval-cuti':
          return <ManajemenCutiHub initialTab="approval" />;
        case 'admin-riwayat-cuti':
          return <ManajemenCutiHub initialTab="riwayat" />;
        case 'admin-pengajuan-cuti':
          return <ManajemenCutiHub initialTab="ajukan" />;
        case 'admin-presensi':
        case 'admin-monitoring':
          return <PresensiAdminHub initialTab="monitoring" />;
        case 'admin-rekap-hadir':
          return <PresensiAdminHub initialTab="rekap" />;
        case 'admin-approval-luar-radius':
          return <PresensiAdminHub initialTab="approval-emergency" />;
        case 'admin-saldo':
        case 'admin-saldo-cuti':
          return <SaldoRolloverHub initialTab="saldo" />;
        case 'admin-rollover':
          return <SaldoRolloverHub initialTab="rollover" />;
        case 'admin-rekap-penggunaan-cuti':
          return <RekapPenggunaanCuti />;
        case 'admin-data-pegawai':
          return <DataPegawai />;
        case 'admin-wfh-wfa':
          return <PengaturanWfhWfa />;
        case 'admin-perjalanan-dinas':
          return <PerjalananDinasPage />;
        case 'admin-tukin':
          return <PerhitunganTukinPage />;
        case 'admin-kunci-fitur':
          if (user?.role !== 'admin') {
            return <DashboardAdmin onNavigate={handleNavigate} />;
          }
          return <FeatureLockManager />;
        case 'admin-audit-log':
          if (user?.role !== 'admin') {
            return <DashboardAdmin onNavigate={handleNavigate} />;
          }
          return <AuditLogPage />;
        case 'admin-pengaturan':
          if (user?.role !== 'admin') {
            return <DashboardAdmin onNavigate={handleNavigate} />;
          }
          return <PengaturanSistem />;
        default:
          return <DashboardAdmin onNavigate={handleNavigate} />;
      }
    }

    // Pegawai Views
    switch (currentView) {
      case 'pegawai-dashboard':
      case 'pegawai-absensi':
        return <DashboardPegawai onNavigate={handleNavigate} />;
      case 'pegawai-riwayat-absensi':
        return <RiwayatAbsensiPegawai />;
      case 'pegawai-ajukan-cuti':
      case 'pegawai-riwayat-cuti':
        return <PengajuanCuti />;
      case 'pegawai-saldo-cuti':
        return <SaldoKalenderHub initialTab="saldo" />;
      case 'pegawai-kalender-cuti':
        return <SaldoKalenderHub initialTab="kalender" />;
      case 'pegawai-profil':
      case 'pegawai-ubah-password':
        return <ProfilPegawai />;
      default:
        return <DashboardPegawai onNavigate={handleNavigate} />;
    }
  };

  // If the user is a pegawai OR an admin previewing the pegawai mobile app:
  const isPegawaiMobileMode = !isAdminOrOperator || currentView.startsWith('pegawai-');

  if (isPegawaiMobileMode) {
    return (
      <PegawaiMobileShell
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenQuickAbsen={() => {
          if (currentView !== 'pegawai-dashboard') {
            setCurrentView('pegawai-dashboard');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('trigger-mobile-absen'));
            }, 100);
          } else {
            window.dispatchEvent(new CustomEvent('trigger-mobile-absen'));
          }
        }}
      >
        {isAdminOrOperator && (
          <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold shadow-xs">
            <span>Mode Pratinjau Mobile Pegawai</span>
            <button
              onClick={() => setCurrentView('admin-dashboard')}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[11px] transition-colors cursor-pointer"
            >
              Kembali ke Dashboard Admin
            </button>
          </div>
        )}
        {renderContent()}
      </PegawaiMobileShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 antialiased flex flex-col">
      {/* Fixed Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Layout with left margin on lg screens for sidebar */}
      <div className="flex-1 flex flex-col lg:pl-64 transition-all duration-200">
        <Navbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onNavigate={handleNavigate}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FeatureLockProvider>
          <AttendanceReminderProvider>
            <AppContent />
          </AttendanceReminderProvider>
        </FeatureLockProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};
export default App;
