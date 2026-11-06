import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../services/api';
import { Employee } from '../../types';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Edit2,
  Trash2,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Database,
  Upload,
  Camera,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { ExcelEmployeeImportModal } from '../../components/ExcelEmployeeImportModal';
import { deleteEmployeeFromFirestore, clearEmployeesFromFirestore, updateEmployeeInFirestore } from '../../firebase';
import { useSubBagianList } from '../../utils/subBagian';

export const DataPegawai: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const subBagianList = useSubBagianList();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'original' | 'asc' | 'desc'>('original');

  // Excel bulk import modal
  const [showExcelModal, setShowExcelModal] = useState(false);

  // Modal create/edit
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [nipNik, setNipNik] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [tempatLahir, setTempatLahir] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [pangkatGolongan, setPangkatGolongan] = useState('');
  const [subBagian, setSubBagian] = useState('Subbag Teknis Penyelenggaraan Pemilu & Parhubmas');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [nomorHp, setNomorHp] = useState('');
  const [jabatan, setJabatan] = useState('Staf Pelaksana');
  const [unitKerja, setUnitKerja] = useState('Sekretariat KPU');
  const [statusPegawai, setStatusPegawai] = useState<'aktif' | 'nonaktif'>('aktif');
  const [tanggalMasuk, setTanggalMasuk] = useState(new Date().toISOString().split('T')[0]);
  const [role, setRole] = useState<'pegawai'>('pegawai');
  const [operatorRole, setOperatorRole] = useState<string>('');
  const [jatahCuti, setJatahCuti] = useState(12);
  const [fotoProfil, setFotoProfil] = useState('');
  const [defaultPassword, setDefaultPassword] = useState('kpu123');

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.getEmployees({
        search: search || undefined,
        unit: unitFilter !== 'ALL' ? unitFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        sort: sortOrder
      });
      setEmployees(res.employees || []);
    } catch (e) {
      console.error('Error fetching employees:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [unitFilter, statusFilter, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmployees();
  };

  const openCreateModal = () => {
    setEditingEmp(null);
    setNipNik('');
    setNamaLengkap('');
    setTempatLahir('');
    setTanggalLahir('');
    setPangkatGolongan('');
    setSubBagian('Subbag Teknis Penyelenggaraan Pemilu & Parhubmas');
    setUsername('');
    setEmail('');
    setNomorHp('');
    setJabatan('Staf Pelaksana');
    setUnitKerja('Sekretariat KPU');
    setStatusPegawai('aktif');
    setTanggalMasuk(new Date().toISOString().split('T')[0]);
    setRole('pegawai');
    setOperatorRole('');
    setJatahCuti(12);
    setFotoProfil('');
    setDefaultPassword('kpu123');
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setNipNik(emp.nip_nik);
    setNamaLengkap(emp.nama_lengkap);
    setTempatLahir(emp.tempat_lahir || '');
    setTanggalLahir(emp.tanggal_lahir || '');
    setPangkatGolongan(emp.pangkat_golongan || '');
    setSubBagian(emp.sub_bagian || emp.unit_kerja || 'Sekretariat KPU');
    setUsername(emp.username);
    setEmail(emp.email);
    setNomorHp(emp.nomor_hp || '');
    setJabatan(emp.jabatan);
    setUnitKerja(emp.unit_kerja);
    setStatusPegawai(emp.status_pegawai);
    setTanggalMasuk(emp.tanggal_masuk);
    setRole('pegawai');
    setOperatorRole(emp.operator_role || '');
    setJatahCuti(emp.jatah_cuti_tahunan || 12);
    setFotoProfil(emp.foto_profil || '');
    setFormError(null);
    setShowFormModal(true);
  };

  const handleImageFileChange = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const resultData = e.target?.result as string;
      if (!resultData) return;

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setFotoProfil(dataUrl);
            return;
          }
        } catch {
          // Fallback if canvas context fails
        }
        setFotoProfil(resultData);
      };
      img.onerror = () => {
        setFotoProfil(resultData);
      };
      img.src = resultData;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      setIsSubmitting(true);
      if (editingEmp) {
        await api.updateEmployee(editingEmp.id, {
          nip_nik: nipNik,
          nama_lengkap: namaLengkap,
          tempat_lahir: tempatLahir,
          tanggal_lahir: tanggalLahir,
          pangkat_golongan: pangkatGolongan,
          sub_bagian: subBagian,
          email,
          nomor_hp: nomorHp,
          jabatan,
          unit_kerja: subBagian || unitKerja,
          status_pegawai: statusPegawai,
          tanggal_masuk: tanggalMasuk,
          role: 'pegawai',
          operator_role: operatorRole || null,
          jatah_cuti_tahunan: jatahCuti,
          foto_profil: fotoProfil
        });

        // Also sync to Firestore cloud
        updateEmployeeInFirestore({
          id: editingEmp.id,
          nip_nik: nipNik,
          nama_lengkap: namaLengkap,
          tempat_lahir: tempatLahir,
          tanggal_lahir: tanggalLahir,
          pangkat_golongan: pangkatGolongan,
          sub_bagian: subBagian,
          email,
          nomor_hp: nomorHp,
          jabatan,
          unit_kerja: subBagian || unitKerja,
          status_pegawai: statusPegawai,
          role: 'pegawai',
          operator_role: operatorRole || null,
          foto_profil: fotoProfil
        }).catch(err => console.warn('Firestore update warning:', err));

        alert('Data pegawai berhasil diperbarui dan tersimpan permanen.');
      } else {
        const newEmpRes = await api.createEmployee({
          nip_nik: nipNik,
          nama_lengkap: namaLengkap,
          tempat_lahir: tempatLahir,
          tanggal_lahir: tanggalLahir,
          pangkat_golongan: pangkatGolongan,
          sub_bagian: subBagian,
          username,
          email,
          nomor_hp: nomorHp,
          jabatan,
          unit_kerja: subBagian || unitKerja,
          tanggal_masuk: tanggalMasuk,
          role: 'pegawai',
          operator_role: operatorRole || null,
          jatah_cuti_tahunan: jatahCuti,
          foto_profil: fotoProfil,
          password: defaultPassword
        });

        // Also sync to Firestore
        updateEmployeeInFirestore({
          id: newEmpRes?.employeeId,
          nip_nik: nipNik,
          nama_lengkap: namaLengkap,
          tempat_lahir: tempatLahir,
          tanggal_lahir: tanggalLahir,
          pangkat_golongan: pangkatGolongan,
          sub_bagian: subBagian,
          email,
          nomor_hp: nomorHp,
          jabatan,
          unit_kerja: subBagian || unitKerja,
          status_pegawai: 'aktif',
          role: 'pegawai',
          operator_role: operatorRole || null,
          foto_profil: fotoProfil
        }).catch(err => console.warn('Firestore create warning:', err));

        alert('Pegawai baru berhasil didaftarkan. Akun login dan saldo cuti otomatis dibuat.');
      }
      setShowFormModal(false);
      await fetchEmployees();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data pegawai.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (emp: Employee) => {
    if (confirm(`Reset password untuk ${emp.nama_lengkap} (${emp.username}) ke default 'kpu123'?`)) {
      try {
        const res = await api.resetPassword(emp.id, 'kpu123');
        alert(res.message);
      } catch (err: any) {
        alert(err.message || 'Gagal mereset password.');
      }
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    if (emp.role === 'admin' && emp.username === 'admin') {
      alert('Akun Administrator utama tidak dapat dihapus.');
      return;
    }

    if (
      confirm(
        `Hapus permanen pegawai "${emp.nama_lengkap}" (${emp.nip_nik})?\n\nPerhatian: Seluruh data akun login, riwayat, dan profil di database lokal maupun Google Firebase Firestore akan dihapus bersih.`
      )
    ) {
      try {
        await api.deleteEmployee(emp.id, true);
        // Also delete from Firestore if synced
        await deleteEmployeeFromFirestore(emp.id, emp.nip_nik);
        await fetchEmployees();
        alert(`Pegawai ${emp.nama_lengkap} berhasil dihapus permanen.`);
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus pegawai.');
      }
    }
  };

  const handleClearAllTemplate = async () => {
    const nonAdminCount = employees.filter(e => e.role !== 'admin' && e.username !== 'admin').length;
    if (nonAdminCount === 0) {
      alert('Tidak ada data pegawai uji coba. Database sudah bersih.');
      return;
    }

    if (
      confirm(
        `PERINGATAN: Apakah Anda yakin ingin menghapus seluruh (${nonAdminCount}) pegawai bawaan/uji coba?\n\nTindakan ini akan membersihkan database agar Anda dapat mengimpor data seluruh pegawai resmi KPU Kota Sungai Penuh melalui fitur Upload Excel. Akun Admin utama tetap aman.`
      )
    ) {
      try {
        setLoading(true);
        const res = await api.clearTemplateEmployees();
        if (res.deletedEmployeeIds && res.deletedEmployeeIds.length > 0) {
          await clearEmployeesFromFirestore(res.deletedEmployeeIds);
        }
        await fetchEmployees();
        alert(res.message || 'Data pegawai uji coba berhasil dibersihkan.');
      } catch (err: any) {
        alert(err.message || 'Gagal membersihkan data pegawai.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExportExcel = () => {
    if (employees.length === 0) {
      alert('Tidak ada data pegawai untuk diekspor.');
      return;
    }

    const exportRows = employees.map((emp, index) => ({
      'No': index + 1,
      'NAMA': emp.nama_lengkap,
      'TEMPAT LAHIR': emp.tempat_lahir || '-',
      'TANGGAL LAHIR': emp.tanggal_lahir || '-',
      'NIP/NIPPPK': emp.nip_nik,
      'PANGKAT GOLONGAN': emp.pangkat_golongan || '-',
      'JABATAN': emp.jabatan,
      'SUB BAGIAN': emp.sub_bagian || emp.unit_kerja,
      'no hp': emp.nomor_hp || '-',
      'email': emp.email,
      'Status': emp.status_pegawai.toUpperCase(),
      'Role': emp.role.toUpperCase()
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 28 }, // NAMA
      { wch: 18 }, // TEMPAT LAHIR
      { wch: 16 }, // TANGGAL LAHIR
      { wch: 24 }, // NIP/NIPPPK
      { wch: 28 }, // PANGKAT GOLONGAN
      { wch: 30 }, // JABATAN
      { wch: 35 }, // SUB BAGIAN
      { wch: 18 }, // no hp
      { wch: 36 }, // email
      { wch: 12 }, // Status
      { wch: 12 }  // Role
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pegawai KPU');
    XLSX.writeFile(wb, `Data_Pegawai_KPU_Sungai_Penuh_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Cloud Database Integration Status Banner */}
      <div className="bg-linear-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7] rounded-2xl p-4 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs text-amber-300">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Database Cloud Google Firebase Firestore</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[10px] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ONLINE & TERHUBUNG
              </span>
            </div>
            <p className="text-xs text-teal-100/90 mt-0.5">
              Data tersinkronisasi aman ke ekosistem Google Cloud Platform (Project: compact-objective-xt8c4). Mendukung impor massal Excel.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0 flex-wrap">
          <button
            id="btn-open-excel-import"
            onClick={() => setShowExcelModal(true)}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-950 bg-emerald-300 hover:bg-emerald-200 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-800" />
            <span>Upload Excel (Massal)</span>
          </button>
          <button
            id="btn-export-excel-data"
            onClick={handleExportExcel}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 rounded-xl border border-white/20 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-200" />
            <span>Ekspor Excel</span>
          </button>
          {employees.some(e => e.role !== 'admin' && e.username !== 'admin') && (
            <button
              id="btn-clear-dummy-employees"
              onClick={handleClearAllTemplate}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-200 bg-rose-950/60 hover:bg-rose-900/80 rounded-xl border border-rose-400/30 transition-colors cursor-pointer"
              title="Hapus seluruh pegawai contoh/uji coba bawaan agar siap diisi data riil dari Excel"
            >
              <Trash2 className="w-4 h-4 text-rose-300" />
              <span>Bersihkan Data Uji Coba</span>
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Data Kepegawaian KPU Kota Sungai Penuh
          </h2>
          <p className="text-xs text-slate-500">
            Total {employees.length} pegawai aktif & terdaftar. Kelola profil, akun login, jabatan, dan jatah cuti.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="btn-add-employee"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-linear-to-r from-emerald-800 via-teal-700 to-sky-700 hover:opacity-95 rounded-xl shadow-xs transition-opacity cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pegawai Manual</span>
          </button>
          <button
            onClick={fetchEmployees}
            title="Muat Ulang Data"
            className="p-2 text-slate-600 hover:text-teal-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative min-w-[240px]">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari Nama / NIP / Username..."
              className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
            />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 bg-slate-50"
            >
              <option value="ALL">Semua Sub Bagian</option>
              {subBagianList.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 bg-slate-50"
            >
              <option value="ALL">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Urutan:</span>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 bg-slate-50 focus:ring-2 focus:ring-red-600 focus:outline-hidden"
            >
              <option value="original">Sesuai Excel (Upload Asli)</option>
              <option value="asc">Abjad Nama (A - Z)</option>
              <option value="desc">Abjad Nama (Z - A)</option>
            </select>
          </div>
        </form>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Nama & Kelahiran</th>
                <th className="px-4 py-3 font-semibold">NIP/NIPPPK & Golongan</th>
                <th className="px-4 py-3 font-semibold">Jabatan</th>
                <th className="px-4 py-3 font-semibold">Sub Bagian</th>
                <th className="px-4 py-3 font-semibold">Kontak (HP / Email)</th>
                <th className="px-4 py-3 font-semibold text-center">Status</th>
                <th className="px-4 py-3 font-semibold text-center">Role</th>
                <th className="px-4 py-3 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Memuat data pegawai...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada pegawai ditemukan.
                  </td>
                </tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            emp.foto_profil ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
                          }
                          alt=""
                          className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200 shrink-0"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">{emp.nama_lengkap}</div>
                          <div className="text-[11px] text-slate-500">
                            {emp.tempat_lahir || emp.tanggal_lahir ? (
                              <span>{emp.tempat_lahir || '-'}{emp.tanggal_lahir ? `, ${emp.tanggal_lahir}` : ''}</span>
                            ) : (
                              <span>TMT: {emp.tanggal_masuk}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-slate-700 font-semibold">{emp.nip_nik}</div>
                      <div className="text-[11px] text-slate-500">
                        {emp.pangkat_golongan || <span className="text-slate-400 italic font-sans">user: {emp.username}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{emp.jabatan}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.sub_bagian || emp.unit_kerja}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700 font-mono text-[11px]">{emp.nomor_hp || '-'}</div>
                      <div className="text-[11px] text-slate-500">{emp.email}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          emp.status_pegawai === 'aktif'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {emp.status_pegawai}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
                          Pegawai
                        </span>
                        {emp.operator_role && emp.operator_role !== 'none' && (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                              emp.operator_role === 'operator_sdm'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : emp.operator_role === 'operator_keuangan'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : emp.operator_role === 'operator_umum'
                                ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                : 'bg-purple-100 text-purple-800 border border-purple-200'
                            }`}
                          >
                            {emp.operator_role === 'operator_sdm' && 'Operator SDM'}
                            {emp.operator_role === 'operator_keuangan' && 'Operator Keuangan'}
                            {emp.operator_role === 'operator_umum' && 'Operator Umum'}
                            {emp.operator_role === 'all_operator' && 'Semua Operator'}
                            {!['operator_sdm', 'operator_keuangan', 'operator_umum', 'all_operator'].includes(emp.operator_role) &&
                              emp.operator_role.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(emp)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Ubah Data Pegawai"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(emp)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Reset Password ke default (kpu123)"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Pegawai Permanen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM MODAL (CREATE / EDIT) */}
      {showFormModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowFormModal(false)}
          title={editingEmp ? `Edit Pegawai: ${editingEmp.nama_lengkap}` : 'Pendaftaran Pegawai Baru'}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSaveEmployee} className="space-y-4 text-xs">
            {formError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-xl font-medium">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  NIP / NIPPPK <span className="text-red-600">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={nipNik}
                  onChange={e => {
                    const val = e.target.value;
                    setNipNik(val);
                    if (!editingEmp) {
                      setUsername(val.replace(/\s+/g, ''));
                    }
                  }}
                  placeholder="Misal: 198507122010011005"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Lengkap & Gelar (NAMA) <span className="text-red-600">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={namaLengkap}
                  onChange={e => setNamaLengkap(e.target.value)}
                  placeholder="Nama lengkap pegawai"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tempat Lahir:</label>
                <input
                  type="text"
                  value={tempatLahir}
                  onChange={e => setTempatLahir(e.target.value)}
                  placeholder="Contoh: Sungai Penuh / Kerinci"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Lahir:</label>
                <input
                  type="text"
                  value={tanggalLahir}
                  onChange={e => setTanggalLahir(e.target.value)}
                  placeholder="YYYY-MM-DD atau DD-MM-YYYY"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pangkat Golongan:</label>
                <input
                  type="text"
                  value={pangkatGolongan}
                  onChange={e => setPangkatGolongan(e.target.value)}
                  placeholder="Contoh: Penata Muda / III/a"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jabatan:</label>
                <input
                  type="text"
                  required
                  value={jabatan}
                  onChange={e => setJabatan(e.target.value)}
                  placeholder="Kasubbag / Staf Pelaksana..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sub Bagian / Unit Kerja:</label>
                <input
                  type="text"
                  value={subBagian}
                  onChange={e => {
                    setSubBagian(e.target.value);
                    setUnitKerja(e.target.value);
                  }}
                  placeholder="Contoh: Subbag Teknis & Parhubmas"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              {!editingEmp && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Username Login <span className="text-red-600">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="username_pegawai"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alamat Email <span className="text-red-600">*</span>:
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nama@kpu.go.id"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">No HP / WhatsApp:</label>
                <input
                  type="text"
                  value={nomorHp}
                  onChange={e => setNomorHp(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tanggal Masuk (TMT):</label>
                <input
                  type="date"
                  required
                  value={tanggalMasuk}
                  onChange={e => setTanggalMasuk(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Hak Akses Operator (Ditugaskan oleh Admin):
                </label>
                <select
                  value={operatorRole}
                  onChange={e => setOperatorRole(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                >
                  <option value="">Pegawai Biasa (Bukan Operator)</option>
                  <option value="operator_sdm">Operator SDM & Parmas (Approval Cuti, WFH/WFA, Saldo Cuti)</option>
                  <option value="operator_keuangan">Operator Keuangan (Perhitungan Tukin & Potongan Kehadiran)</option>
                  <option value="operator_umum">Operator Umum (Manajemen Perjalanan Dinas / SPPD)</option>
                  <option value="all_operator">Semua Role Operator (SDM, Keuangan, & Umum)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                  * Admin memiliki username tersendiri (<span className="font-mono font-semibold text-red-700">admincutikpuspn</span>) dan tidak dapat dilekatkan pada pegawai. Pegawai yang diberi hak operator dapat beralih antara Mode Pegawai dan Mode Operator setelah login.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Pegawai:</label>
                <select
                  value={statusPegawai}
                  onChange={e => setStatusPegawai(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                >
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jatah Cuti Tahunan (Hari):</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={jatahCuti}
                  onChange={e => setJatahCuti(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block font-semibold text-slate-800 text-xs uppercase tracking-wider mb-2">
                  Foto Profil Pegawai:
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative shrink-0">
                    <img
                      src={
                        fotoProfil ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                      }
                      alt="Preview Foto Pegawai"
                      className="w-16 h-16 rounded-2xl object-cover ring-2 ring-slate-300 shadow-xs bg-white"
                    />
                    {fotoProfil && (
                      <button
                        type="button"
                        onClick={() => setFotoProfil('')}
                        title="Hapus / Reset Foto"
                        className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-xs transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition">
                        <Upload className="w-4 h-4 text-red-600" />
                        <span>Pilih Foto Pegawai (JPG / PNG / WebP)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageFileChange(e.target.files[0]);
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                      {fotoProfil && (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Foto terpasang
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={fotoProfil.startsWith('data:') ? '(Foto lokal dipilih dari perangkat)' : fotoProfil}
                      onChange={e => {
                        if (!fotoProfil.startsWith('data:')) {
                          setFotoProfil(e.target.value);
                        }
                      }}
                      disabled={fotoProfil.startsWith('data:')}
                      placeholder="Atau tempel tautan web foto (https://...)"
                      className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-teal-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {!editingEmp && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block font-semibold text-slate-700 mb-1">
                  Kata Sandi Awal Akun:
                </label>
                <input
                  type="text"
                  value={defaultPassword}
                  onChange={e => setDefaultPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Pegawai dapat mengubah password ini setelah login pertama kali.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-save-employee"
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 font-semibold text-white bg-linear-to-r from-emerald-800 to-teal-700 hover:opacity-95 rounded-xl shadow-xs transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Data Pegawai'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Excel Bulk Import Modal */}
      <ExcelEmployeeImportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        onSuccess={() => {
          fetchEmployees();
        }}
        existingNips={employees.map(e => e.nip_nik)}
      />
    </div>
  );
};
