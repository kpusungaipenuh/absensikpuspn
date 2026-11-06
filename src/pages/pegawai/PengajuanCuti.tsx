import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LeaveBalance, LeaveRequest, LeaveType, Employee } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Calendar,
  Send,
  Upload,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Info,
  UserCheck,
  Printer,
  Sparkles
} from 'lucide-react';
import { CutiPrintModal } from '../../components/CutiPrintModal';

export const PengajuanCuti: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedTypeId, setSelectedTypeId] = useState<string>('lt_ct');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [durasiHari, setDurasiHari] = useState(1);
  const [alasan, setAlasan] = useState('');
  const [lampiranDokumen, setLampiranDokumen] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Document specific state for auto-generating official leave form
  const [alamatCuti, setAlamatCuti] = useState('Kota Sungai Penuh, Provinsi Jambi');
  const [teleponCuti, setTeleponCuti] = useState('');
  const [namaAtasan, setNamaAtasan] = useState('Kasubbag Keuangan, Umum dan Logistik');
  const [nipAtasan, setNipAtasan] = useState('-');
  const [jabatanAtasan, setJabatanAtasan] = useState('Atasan Langsung');

  // Print modal state
  const [printModalRequest, setPrintModalRequest] = useState<LeaveRequest | null>(null);
  const [submittedSuccessModal, setSubmittedSuccessModal] = useState<LeaveRequest | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBalanceForEmp = async (empId?: string) => {
    try {
      const balRes = await api.getMyLeaveBalance(undefined, empId);
      if (balRes?.balance) {
        setBalance(balRes.balance);
      }
    } catch (e: any) {
      console.warn('Notice loading leave balance:', e?.message || e);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      let targetEmpId = selectedEmpId;
      try {
        const empRes = await api.getEmployees({ status: 'aktif' });
        const emps = empRes.employees || [];
        setEmployees(emps);
        if (isAdmin && !targetEmpId && emps.length > 0) {
          targetEmpId = emps[0].id;
          setSelectedEmpId(targetEmpId);
        }
        if (!isAdmin && user?.employeeId) {
          const me = emps.find(e => e.id === user.employeeId);
          if (me) {
            if (me.nomor_hp) setTeleponCuti(prev => prev || me.nomor_hp || '');
            if (me.unit_kerja) setAlamatCuti(prev => prev || 'Kota Sungai Penuh, Provinsi Jambi');
          }
        }
      } catch (err) {
        console.warn('Notice loading employees list:', err);
      }

      const [balRes, reqRes, typesRes] = await Promise.all([
        api.getMyLeaveBalance(undefined, isAdmin && targetEmpId ? targetEmpId : undefined).catch(() => null),
        api.getMyLeaveRequests().catch(() => ({ requests: [] })),
        api.getLeaveTypes().catch(() => ({ types: [] }))
      ]);

      if (balRes?.balance) {
        setBalance(balRes.balance);
      }
      setMyRequests(reqRes?.requests || []);
      setLeaveTypes(typesRes?.types || []);
      if (typesRes?.types && typesRes.types.length > 0) {
        setSelectedTypeId(typesRes.types[0].id);
      }
    } catch (e: any) {
      console.warn('Notice fetching leave info:', e?.message || e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedEmpId(newId);
    fetchBalanceForEmp(newId);
  };

  // Calculate working days (Mon-Fri) between start and end date
  useEffect(() => {
    if (!tanggalMulai || !tanggalSelesai) {
      setDurasiHari(1);
      return;
    }

    const start = new Date(tanggalMulai);
    const end = new Date(tanggalSelesai);

    if (end < start) {
      setDurasiHari(0);
      return;
    }

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    setDurasiHari(Math.max(count, 1));
  }, [tanggalMulai, tanggalSelesai]);

  // Calculate sequential deduction breakdown for preview
  const calculateDeductionPreview = (days: number) => {
    if (!balance) return { n_2: 0, n_1: 0, n: 0, total: 0, valid: true };
    let remaining = days;

    const n_2_take = Math.min(balance.n_2, remaining);
    remaining -= n_2_take;

    const n_1_take = Math.min(balance.n_1, remaining);
    remaining -= n_1_take;

    const n_take = Math.min(balance.n, remaining);
    remaining -= n_take;

    const totalAvailable = balance.n_2 + balance.n_1 + balance.n;
    return {
      n_2: n_2_take,
      n_1: n_1_take,
      n: n_take,
      total: n_2_take + n_1_take + n_take,
      valid: days <= totalAvailable
    };
  };

  const deductionPreview = calculateDeductionPreview(durasiHari);
  const currentSelectedType = leaveTypes.find(t => t.id === selectedTypeId);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setLampiranDokumen(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Application
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (durasiHari <= 0) {
      setFormError('Rentang tanggal tidak valid. Tanggal selesai harus sama atau setelah tanggal mulai.');
      return;
    }

    if (currentSelectedType?.uses_balance && !deductionPreview.valid) {
      setFormError('Sisa saldo cuti tahunan Anda tidak mencukupi untuk durasi yang diajukan.');
      return;
    }

    if (currentSelectedType?.requires_attachment && !lampiranDokumen) {
      setFormError(`Jenis cuti "${currentSelectedType.nama}" mewajibkan dokumen/bukti lampiran.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.submitLeaveRequest({
        leaveTypeId: selectedTypeId,
        startDate: tanggalMulai,
        endDate: tanggalSelesai,
        reason: alasan,
        attachmentUrl: lampiranDokumen || undefined,
        employeeId: isAdmin ? selectedEmpId : undefined,
        alamat_cuti: alamatCuti,
        telepon_cuti: teleponCuti,
        nama_atasan: namaAtasan,
        nip_atasan: nipAtasan,
        jabatan_atasan: jabatanAtasan
      });

      // Reset form
      setAlasan('');
      setLampiranDokumen(null);
      setFileName(null);
      await fetchData();

      if (res?.request) {
        setSubmittedSuccessModal(res.request);
      } else {
        alert(
          isAdmin
            ? 'Permohonan cuti pegawai berhasil didaftarkan oleh Administrator.'
            : 'Permohonan cuti Anda berhasil dikirim dan menunggu verifikasi Admin / Pejabat Berwenang.'
        );
      }
    } catch (err: any) {
      setFormError(err.message || 'Gagal mengirim pengajuan cuti.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSaldoTahunan = (balance?.n_2 || 0) + (balance?.n_1 || 0) + (balance?.n || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Formulir Pengajuan Cuti Online Pegawai
        </h2>
        <p className="text-xs text-slate-500">
          Layanan mandiri permohonan cuti resmi ASN & Non-ASN KPU Kota Sungai Penuh
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: The Application Form */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Lengkapi Data Permohonan Cuti
            </h3>

            {formError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-xl font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Mode Admin: Pilih Pegawai */}
            {isAdmin && (
              <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <UserCheck className="w-4 h-4 text-amber-700" />
                  <span>Pilih Pegawai Pemohon (Mode Administrator):</span>
                </div>
                <select
                  id="admin-select-employee-leave"
                  value={selectedEmpId}
                  onChange={handleEmployeeChange}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white font-medium text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nama_lengkap} — NIP: {emp.nip_nik} ({emp.jabatan})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-amber-800">
                  Simulasi sisa saldo cuti N-2, N-1, N di panel sebelah kanan otomatis menampilkan data pegawai terpilih.
                </p>
              </div>
            )}

            {/* 1. Pilih Jenis Cuti */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Pilih Kategori Cuti <span className="text-red-600">*</span>:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {leaveTypes.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedTypeId(item.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedTypeId === item.id
                        ? 'border-red-600 bg-red-50/50 ring-2 ring-red-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{item.nama}</span>
                      <input
                        type="radio"
                        checked={selectedTypeId === item.id}
                        onChange={() => setSelectedTypeId(item.id)}
                        className="text-red-600"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">{item.keterangan}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* If Cuti Tahunan: Live Sequential Deduction Preview */}
            {currentSelectedType?.uses_balance === 1 && (
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  <span>Simulasi Pemotongan Sekuensial Saldo Cuti Tahunan:</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block">Potong N-2</span>
                    <span className="font-bold text-amber-700 text-sm">-{deductionPreview.n_2} Hari</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block">Potong N-1</span>
                    <span className="font-bold text-indigo-700 text-sm">-{deductionPreview.n_1} Hari</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block">Potong N</span>
                    <span className="font-bold text-emerald-700 text-sm">-{deductionPreview.n} Hari</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-200">
                    <span className="text-[10px] text-slate-500 block font-semibold">Total Terpotong</span>
                    <span className="font-black text-red-700 text-sm">{deductionPreview.total} Hari</span>
                  </div>
                </div>
                {!deductionPreview.valid && (
                  <p className="text-[11px] font-bold text-rose-700">
                    Perhatian: Durasi pengajuan ({durasiHari} hari) melebihi total sisa saldo Anda ({totalSaldoTahunan} hari).
                  </p>
                )}
              </div>
            )}

            {/* 2. Rentang Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tanggal Mulai <span className="text-red-600">*</span>:
                </label>
                <input
                  type="date"
                  required
                  value={tanggalMulai}
                  onChange={e => setTanggalMulai(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tanggal Selesai <span className="text-red-600">*</span>:
                </label>
                <input
                  type="date"
                  required
                  value={tanggalSelesai}
                  onChange={e => setTanggalSelesai(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Durasi Hari Kerja:
                </label>
                <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>{durasiHari} Hari Kerja</span>
                  <span className="text-[10px] text-slate-500 font-normal">(Senin-Jumat)</span>
                </div>
              </div>
            </div>

            {/* 3. Alasan Cuti */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Alasan Pengajuan Cuti <span className="text-red-600">*</span>:
              </label>
              <textarea
                rows={2}
                required
                value={alasan}
                onChange={e => setAlasan(e.target.value)}
                placeholder="Jelaskan keperluan cuti secara jelas dan lengkap..."
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>

            {/* 4. Lampiran Dokumen */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Unggah Dokumen Pendukung {currentSelectedType?.requires_attachment === 1 && <span className="text-red-600">* (Wajib Lampiran)</span>}:
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span className="font-semibold text-slate-700">Pilih Berkas (Foto/PDF)</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {fileName && (
                  <span className="text-slate-600 font-mono text-[11px] truncate max-w-xs">
                    {fileName}
                  </span>
                )}
              </div>
            </div>

            {/* 5. Kelengkapan Dokumen Permohonan & Formulir Cuti */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                  <FileText className="w-4 h-4 text-red-700" />
                  <span>Data Dokumen Surat Permohonan Cuti (Otomatis Masuk ke Lembar Cetak)</span>
                </div>
                <span className="text-[10px] text-red-700 bg-red-50 font-bold px-2 py-0.5 rounded-md border border-red-200 font-sans">
                  Format Resmi KPU Kota Sungai Penuh
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alamat Lengkap Selama Cuti:
                  </label>
                  <input
                    type="text"
                    value={alamatCuti}
                    onChange={e => setAlamatCuti(e.target.value)}
                    placeholder="Alamat domisili saat cuti"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Kontak / Telepon Aktif:
                  </label>
                  <input
                    type="text"
                    value={teleponCuti}
                    onChange={e => setTeleponCuti(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Atasan Langsung (Untuk TTD):
                  </label>
                  <input
                    type="text"
                    value={namaAtasan}
                    onChange={e => setNamaAtasan(e.target.value)}
                    placeholder="Nama Atasan Langsung"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NIP Atasan Langsung:
                  </label>
                  <input
                    type="text"
                    value={nipAtasan}
                    onChange={e => setNipAtasan(e.target.value)}
                    placeholder="NIP Atasan Langsung"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jabatan Atasan Langsung:
                  </label>
                  <input
                    type="text"
                    value={jabatanAtasan}
                    onChange={e => setJabatanAtasan(e.target.value)}
                    placeholder="Jabatan Atasan Langsung"
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-red-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Submit button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
              <button
                id="btn-submit-pengajuan-cuti"
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Mengirim...' : 'Kirim Permohonan Cuti'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Col: Current Balance Card & Guidelines */}
        <div className="space-y-4">
          {/* Sisa Saldo Widget */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {isAdmin ? 'Status Saldo Pegawai Terpilih' : 'Status Saldo Cuti Tahunan Anda'}
            </h4>

            <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-center">
              <span className="text-[11px] text-red-700 font-semibold block">Total Saldo Tersedia</span>
              <span className="text-3xl font-black text-red-800 mt-1 block">{totalSaldoTahunan} Hari</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg border border-amber-200">
                <span className="font-semibold text-amber-900">Sisa N-2 ({balance?.tahun ? balance.tahun - 2 : ''})</span>
                <span className="font-bold text-amber-900">{balance?.n_2 || 0} Hari</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-indigo-50 rounded-lg border border-indigo-200">
                <span className="font-semibold text-indigo-900">Sisa N-1 ({balance?.tahun ? balance.tahun - 1 : ''})</span>
                <span className="font-bold text-indigo-900">{balance?.n_1 || 0} Hari</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="font-semibold text-emerald-900">Sisa N ({balance?.tahun || ''})</span>
                <span className="font-bold text-emerald-900">{balance?.n || 0} Hari</span>
              </div>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Ketentuan Permohonan:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed text-slate-600">
              <li>Pengajuan cuti tahunan diajukan minimal 3 hari sebelum pelaksanaan.</li>
              <li>Approval dilakukan oleh Admin Kepegawaian / Sekretaris KPU.</li>
              <li>Jika ditolak atau dibatalkan, saldo cuti tidak akan terpotong.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* My Submitted Requests History */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Riwayat Permohonan Cuti Anda
          </h4>
          <span className="text-xs text-slate-500">{myRequests.length} Pengajuan</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Tgl Pengajuan</th>
                <th className="px-4 py-3 font-semibold">Jenis Cuti</th>
                <th className="px-4 py-3 font-semibold">Periode Cuti</th>
                <th className="px-4 py-3 font-semibold text-center">Durasi</th>
                <th className="px-4 py-3 font-semibold">Alasan</th>
                <th className="px-4 py-3 font-semibold text-center">Status</th>
                <th className="px-4 py-3 font-semibold">Catatan Admin</th>
                <th className="px-4 py-3 font-semibold text-center">Aksi / Cetak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Anda belum memiliki riwayat pengajuan cuti.
                  </td>
                </tr>
              ) : (
                myRequests.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {new Date(r.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.leave_type_name || r.leave_type_id}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.tanggal_mulai} s/d {r.tanggal_selesai}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">
                      {r.jumlah_hari} Hari
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{r.alasan}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'Disetujui'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'Ditolak'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 italic">
                      {r.catatan_admin || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setPrintModalRequest(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs shadow-2xs transition cursor-pointer"
                        title="Cetak Formulir Cuti & Surat Permohonan Resmi"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Cetak Dokumen</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP SUKSES SETELAH PENGAJUAN */}
      {submittedSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Permohonan Cuti Berhasil Diajukan!
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Data pengajuan cuti Anda telah otomatis terhubung ke template resmi <strong>Surat Permohonan Cuti KPU Kota Sungai Penuh</strong>. Anda dapat langsung mencetak surat untuk ditandatangani dan diproses.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor Registrasi:</span>
                <span className="font-mono font-bold text-slate-800">{submittedSuccessModal.nomor_pengajuan || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Durasi Hari Cuti:</span>
                <span className="font-bold text-slate-800">{submittedSuccessModal.jumlah_hari} Hari Kerja</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Periode:</span>
                <span className="text-slate-800">{submittedSuccessModal.tanggal_mulai} s/d {submittedSuccessModal.tanggal_selesai}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmittedSuccessModal(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintModalRequest(submittedSuccessModal);
                  setSubmittedSuccessModal(null);
                }}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Dokumen Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CETAK CUTI */}
      {printModalRequest && (
        <CutiPrintModal
          isOpen={!!printModalRequest}
          onClose={() => setPrintModalRequest(null)}
          request={printModalRequest}
          initialBalance={balance}
        />
      )}
    </div>
  );
};
