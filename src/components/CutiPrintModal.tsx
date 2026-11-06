import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  FileText,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  ExternalLink,
  Layers
} from 'lucide-react';
import { LeaveRequest, LeaveBalance, Employee } from '../types';
import { resolveLeaveHierarchy } from '../utils/leaveHierarchy';
import { printElementById, openPrintInNewTab } from '../utils/printHelper';

interface CutiPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: LeaveRequest;
  currentEmployee?: Employee | null;
  initialBalance?: LeaveBalance | null;
  allEmployees?: Employee[];
}

// Konversi angka ke terbilang bahasa Indonesia (1 - 100)
const angkaKeTerbilang = (n: number): string => {
  const bilangan = [
    '',
    'satu',
    'dua',
    'tiga',
    'empat',
    'lima',
    'enam',
    'tujuh',
    'delapan',
    'sembilan',
    'sepuluh',
    'sebelas'
  ];
  if (n <= 11) return bilangan[n] || String(n);
  if (n < 20) return `${bilangan[n - 10]} belas`;
  if (n < 100) {
    const sisa = n % 10;
    return `${bilangan[Math.floor(n / 10)]} puluh ${sisa ? bilangan[sisa] : ''}`.trim();
  }
  return String(n);
};

export const CutiPrintModal: React.FC<CutiPrintModalProps> = ({
  isOpen,
  onClose,
  request,
  currentEmployee,
  initialBalance,
  allEmployees
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'page1' | 'page2' | 'surat'>('all');

  // Format tanggal Indonesia e.g. "19 September 2026"
  const formatDateIndo = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const resolved = resolveLeaveHierarchy(
    {
      nama_lengkap: request?.nama_lengkap || currentEmployee?.nama_lengkap,
      jabatan: request?.jabatan || currentEmployee?.jabatan,
      sub_bagian:
        request?.sub_bagian ||
        (request as any)?.unit_kerja ||
        currentEmployee?.sub_bagian ||
        currentEmployee?.unit_kerja,
      unit_kerja: (request as any)?.unit_kerja || currentEmployee?.unit_kerja,
      nip_nik: request?.nip_nik || currentEmployee?.nip_nik
    },
    allEmployees as any
  );

  const currentYear = new Date().getFullYear();
  const durasiHari = request?.jumlah_hari || 1;
  const durasiTerbilang = angkaKeTerbilang(durasiHari);

  // State Data Surat & Formulir
  const [nomorSurat, setNomorSurat] = useState(
    request?.nomor_pengajuan || `CUTI/${String(request?.id || '001').slice(-4)}/${currentYear}`
  );
  const [tanggalSurat, setTanggalSurat] = useState(
    formatDateIndo(request?.tanggal_pengajuan || request?.created_at) ||
      formatDateIndo(new Date().toISOString())
  );
  const [namaPegawai, setNamaPegawai] = useState(
    request?.nama_lengkap || currentEmployee?.nama_lengkap || ''
  );
  const [nipPegawai, setNipPegawai] = useState(
    request?.nip_nik || currentEmployee?.nip_nik || '-'
  );
  const [pangkatGolongan, setPangkatGolongan] = useState(
    request?.pangkat_golongan ||
      (request as any)?.emp_pangkat_golongan ||
      currentEmployee?.pangkat_golongan ||
      'Penata Muda / III.a'
  );
  const [jabatanPegawai, setJabatanPegawai] = useState(
    request?.jabatan || currentEmployee?.jabatan || 'Pelaksana'
  );
  const [masaKerja, setMasaKerja] = useState(
    (currentEmployee as any)?.masa_kerja || '05 Tahun 02 Bulan'
  );
  const [unitKerja, setUnitKerja] = useState(
    request?.sub_bagian
      ? `Komisi Pemilihan Umum Kota Sungai Penuh - Subbagian ${request.sub_bagian}`
      : 'Komisi Pemilihan Umum Kota Sungai Penuh'
  );

  const [alasanCuti, setAlasanCuti] = useState(
    request?.alasan || 'Keperluan keluarga mendesak dan kepentingan pribadi'
  );
  const [alamatCuti, setAlamatCuti] = useState(
    request?.alamat_cuti || 'Kota Sungai Penuh, Provinsi Jambi'
  );
  const [teleponCuti, setTeleponCuti] = useState(
    request?.telepon_cuti ||
      (request as any)?.emp_nomor_hp ||
      currentEmployee?.nomor_hp ||
      '08xxxxxxxxxx'
  );

  // Tujuan Surat (Kepada Yth)
  const [tujuanSurat, setTujuanSurat] = useState(resolved.kepadaYth);
  const [kotaTujuan, setKotaTujuan] = useState(resolved.kotaTujuan);

  // Atasan Langsung
  const [namaAtasan, setNamaAtasan] = useState(
    request?.nama_atasan || resolved.atasanLangsung.nama
  );
  const [nipAtasan, setNipAtasan] = useState(
    request?.nip_atasan || resolved.atasanLangsung.nip
  );
  const [jabatanAtasan, setJabatanAtasan] = useState(
    request?.jabatan_atasan || resolved.atasanLangsung.jabatan
  );
  const [statusAtasan, setStatusAtasan] = useState<'setuju' | 'perubahan' | 'tangguhkan' | 'tolak'>('setuju');
  const [catatanAtasan, setCatatanAtasan] = useState(request?.catatan_verifikator || '-');

  // Pejabat Berwenang
  const [namaPejabat, setNamaPejabat] = useState(resolved.pejabatBerwenang.nama);
  const [nipPejabat, setNipPejabat] = useState(resolved.pejabatBerwenang.nip);
  const [jabatanPejabat, setJabatanPejabat] = useState(resolved.pejabatBerwenang.jabatan);
  const [statusPejabat, setStatusPejabat] = useState<'setuju' | 'perubahan' | 'tangguhkan' | 'tolak'>(
    request?.status === 'approved' ? 'setuju' : 'setuju'
  );
  const [catatanPejabat, setCatatanPejabat] = useState('-');

  // Catatan Saldo Cuti (Halaman 2)
  const [saldoN2, setSaldoN2] = useState('0 Hari');
  const [saldoN1, setSaldoN1] = useState(
    initialBalance?.saldo_tahun_lalu ? `${initialBalance.saldo_tahun_lalu} Hari` : '0 Hari'
  );
  const [hakCutiN, setHakCutiN] = useState('12 Hari');
  const [cutiDiambilN, setCutiDiambilN] = useState(`${durasiHari} Hari`);
  const [sisaCutiN, setSisaCutiN] = useState(
    initialBalance?.sisa_cuti !== undefined
      ? `${initialBalance.sisa_cuti} Hari`
      : `${Math.max(0, 12 - durasiHari)} Hari`
  );

  // Sync state saat request atau currentEmployee berubah
  useEffect(() => {
    if (request || currentEmployee) {
      const fresh = resolveLeaveHierarchy(
        {
          nama_lengkap: request?.nama_lengkap || currentEmployee?.nama_lengkap,
          jabatan: request?.jabatan || currentEmployee?.jabatan,
          sub_bagian:
            request?.sub_bagian ||
            (request as any)?.unit_kerja ||
            currentEmployee?.sub_bagian ||
            currentEmployee?.unit_kerja,
          unit_kerja: (request as any)?.unit_kerja || currentEmployee?.unit_kerja,
          nip_nik: request?.nip_nik || currentEmployee?.nip_nik
        },
        allEmployees as any
      );

      setNomorSurat(
        request?.nomor_pengajuan || `CUTI/${String(request?.id || '001').slice(-4)}/${currentYear}`
      );
      setTanggalSurat(
        formatDateIndo(request?.tanggal_pengajuan || request?.created_at) ||
          formatDateIndo(new Date().toISOString())
      );
      setNamaPegawai(request?.nama_lengkap || currentEmployee?.nama_lengkap || '');
      setNipPegawai(request?.nip_nik || currentEmployee?.nip_nik || '-');
      setPangkatGolongan(
        request?.pangkat_golongan ||
          (request as any)?.emp_pangkat_golongan ||
          currentEmployee?.pangkat_golongan ||
          'Penata Muda / III.a'
      );
      setJabatanPegawai(request?.jabatan || currentEmployee?.jabatan || 'Pelaksana');
      setAlasanCuti(
        request?.alasan || 'Keperluan keluarga mendesak dan kepentingan pribadi'
      );
      setAlamatCuti(request?.alamat_cuti || 'Kota Sungai Penuh, Provinsi Jambi');
      setTeleponCuti(
        request?.telepon_cuti ||
          (request as any)?.emp_nomor_hp ||
          currentEmployee?.nomor_hp ||
          '08xxxxxxxxxx'
      );
      setTujuanSurat(fresh.kepadaYth);
      setKotaTujuan(fresh.kotaTujuan);
      setNamaAtasan(request?.nama_atasan || fresh.atasanLangsung.nama);
      setNipAtasan(request?.nip_atasan || fresh.atasanLangsung.nip);
      setJabatanAtasan(request?.jabatan_atasan || fresh.atasanLangsung.jabatan);
      setNamaPejabat(fresh.pejabatBerwenang.nama);
      setNipPejabat(fresh.pejabatBerwenang.nip);
      setJabatanPejabat(fresh.pejabatBerwenang.jabatan);

      if (initialBalance) {
        setSaldoN1(`${initialBalance.saldo_tahun_lalu || 0} Hari`);
        setSisaCutiN(`${initialBalance.sisa_cuti ?? Math.max(0, 12 - durasiHari)} Hari`);
      }
    }
  }, [request?.id, currentEmployee?.id]);

  if (!isOpen) return null;

  const leaveTypeName = request?.leave_type_name || request?.leave_type_id || 'Cuti Tahunan';
  const isTahunan = /tahunan/i.test(leaveTypeName);
  const isBesar = /besar/i.test(leaveTypeName);
  const isSakit = /sakit/i.test(leaveTypeName);
  const isMelahirkan = /melahirkan|bersalin/i.test(leaveTypeName);
  const isAlasanPenting = /alasan penting|penting/i.test(leaveTypeName);
  const isCLTN = /tanggungan negara|cltn/i.test(leaveTypeName);

  const tglMulaiFormatted = formatDateIndo(request?.tanggal_mulai);
  const tglSelesaiFormatted = formatDateIndo(request?.tanggal_selesai);

  const handlePrint = () => {
    printElementById(
      'printable-cuti-document',
      `Formulir_Cuti_${namaPegawai.replace(/\s+/g, '_')}`
    );
  };

  const handleOpenTab = () => {
    openPrintInNewTab(
      'printable-cuti-document',
      `Formulir_Cuti_${namaPegawai.replace(/\s+/g, '_')}`
    );
  };

  return (
    <div className="print-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
      <div className="print-modal-container relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[94vh]">
        
        {/* Header Modal (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Formulir Permohonan & Pemberian Cuti Resmi KPU (2 Halaman BKN)
              </h3>
              <p className="text-[11px] text-slate-500">
                Peraturan BKN No. 24 Th 2017 jo. No. 7 Th 2021 & Keputusan KPU No. 102 Th 2022
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer transition shadow-2xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-600" />
              <span>Sesuaikan Data</span>
              {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleOpenTab}
              title="Buka dokumen di tab baru untuk pencetakan langsung tanpa batasan iframe"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Tab Baru</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigasi Pratinjau (Hidden in Print) */}
        <div className="no-print bg-slate-100/90 px-5 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-semibold mr-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" /> Tampilan:
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-red-700 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Semua (2 Halaman)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('page1')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'page1'
                  ? 'bg-red-700 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Halaman 1 (Permohonan)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('page2')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'page2'
                  ? 'bg-red-700 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Halaman 2 (Catatan & Persetujuan)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('surat')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'surat'
                  ? 'bg-red-700 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              Format Naratif (Surat Dinas)
            </button>
          </div>

          <div className="text-[11px] text-slate-500">
            {activeTab === 'all' && (
              <span className="text-emerald-700 font-semibold">
                ✓ Menampilkan 2 Halaman Lengkap sesuai Standar BKN
              </span>
            )}
            {activeTab === 'page1' && <span>Halaman 1: Bagian I s/d IV</span>}
            {activeTab === 'page2' && <span>Halaman 2: Bagian V s/d VIII</span>}
            {activeTab === 'surat' && <span>Format Surat Pengantar / Naratif Cuti</span>}
          </div>
        </div>

        {/* Configuration Drawer (Hidden in Print) */}
        {showConfig && (
          <div className="no-print bg-slate-50 p-4 border-b border-slate-200 text-xs max-h-72 overflow-y-auto space-y-3">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-200">
              <span>Sesuaikan Data Dokumen Cuti Sebelum Dicetak:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nomor Formulir / Pengajuan:</label>
                <input
                  type="text"
                  value={nomorSurat}
                  onChange={e => setNomorSurat(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tanggal Surat:</label>
                <input
                  type="text"
                  value={tanggalSurat}
                  onChange={e => setTanggalSurat(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Masa Kerja Pegawai:</label>
                <input
                  type="text"
                  value={masaKerja}
                  onChange={e => setMasaKerja(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Pegawai (Pemohon):</label>
                <input
                  type="text"
                  value={namaPegawai}
                  onChange={e => setNamaPegawai(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">NIP Pegawai:</label>
                <input
                  type="text"
                  value={nipPegawai}
                  onChange={e => setNipPegawai(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Pangkat / Golongan:</label>
                <input
                  type="text"
                  value={pangkatGolongan}
                  onChange={e => setPangkatGolongan(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Jabatan Pegawai:</label>
                <input
                  type="text"
                  value={jabatanPegawai}
                  onChange={e => setJabatanPegawai(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Unit Kerja Pegawai:</label>
                <input
                  type="text"
                  value={unitKerja}
                  onChange={e => setUnitKerja(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-slate-700 font-semibold mb-1">Alasan Cuti Lengkap:</label>
                <input
                  type="text"
                  value={alasanCuti}
                  onChange={e => setAlasanCuti(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Alamat Selama Cuti:</label>
                <input
                  type="text"
                  value={alamatCuti}
                  onChange={e => setAlamatCuti(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Telepon / HP Selama Cuti:</label>
                <input
                  type="text"
                  value={teleponCuti}
                  onChange={e => setTeleponCuti(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Atasan Langsung */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Atasan Langsung:</label>
                <input
                  type="text"
                  value={namaAtasan}
                  onChange={e => setNamaAtasan(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">NIP Atasan Langsung:</label>
                <input
                  type="text"
                  value={nipAtasan}
                  onChange={e => setNipAtasan(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Jabatan Atasan Langsung:</label>
                <input
                  type="text"
                  value={jabatanAtasan}
                  onChange={e => setJabatanAtasan(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Pejabat Berwenang */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Pejabat Berwenang:</label>
                <input
                  type="text"
                  value={namaPejabat}
                  onChange={e => setNamaPejabat(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">NIP Pejabat Berwenang:</label>
                <input
                  type="text"
                  value={nipPejabat}
                  onChange={e => setNipPejabat(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Jabatan Pejabat Berwenang:</label>
                <input
                  type="text"
                  value={jabatanPejabat}
                  onChange={e => setJabatanPejabat(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Catatan Saldo Cuti */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Sisa Cuti N-1 ({currentYear - 1}):</label>
                <input
                  type="text"
                  value={saldoN1}
                  onChange={e => setSaldoN1(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Cuti Diambil N ({currentYear}):</label>
                <input
                  type="text"
                  value={cutiDiambilN}
                  onChange={e => setCutiDiambilN(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Sisa Cuti N ({currentYear}):</label>
                <input
                  type="text"
                  value={sisaCutiN}
                  onChange={e => setSisaCutiN(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Printable Paper Canvas */}
        <div className="print-modal-scroll flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 flex justify-center">
          <div
            id="printable-cuti-document"
            className="print-area w-full max-w-[210mm] text-slate-900 font-serif leading-normal"
          >
            {/* ============================================================ */}
            {/* OPSI 1 & 2: FORMULIR RESMI BKN 2 HALAMAN (STANDAR NASIONAL) */}
            {/* ============================================================ */}
            {activeTab !== 'surat' && (
              <>
                {/* ------------------------------------------------------------ */}
                {/* HALAMAN 1: FORMULIR PERMOHONAN CUTI (BAGIAN I - IV)           */}
                {/* ------------------------------------------------------------ */}
                {(activeTab === 'all' || activeTab === 'page1') && (
                  <div className="print-page bg-white shadow-md p-8 sm:p-12 border border-slate-300 print:border-0 print:shadow-none print:p-0 mb-8 print:mb-0">
                    {/* Header Anak Lampiran BKN */}
                    <div className="text-right text-[8.5pt] leading-tight pb-3 mb-2">
                      <div className="italic">ANAK LAMPIRAN 1.b</div>
                      <div>PERATURAN BADAN KEPEGAWAIAN NEGARA REPUBLIK INDONESIA</div>
                      <div>NOMOR 24 TAHUN 2017 TENTANG TATA CARA PEMBERIAN CUTI PNS</div>
                      <div className="text-[7.5pt] text-slate-600">
                        (SEBAGAIMANA TELAH DIUBAH DENGAN PERATURAN BKN NOMOR 7 TAHUN 2021)
                      </div>
                    </div>

                    {/* Tempat, Tanggal dan Tujuan Surat */}
                    <div className="flex justify-between items-start text-[10pt] leading-relaxed mb-4">
                      <div></div>
                      <div className="text-left w-72">
                        <div>Kota Sungai Penuh, {tanggalSurat}</div>
                        <div className="mt-1">Kepada Yth.</div>
                        <div className="font-bold">{tujuanSurat}</div>
                        <div>di -</div>
                        <div className="pl-4 font-semibold">{kotaTujuan || 'Sungai Penuh'}</div>
                      </div>
                    </div>

                    {/* Judul Formulir */}
                    <div className="text-center my-3">
                      <div className="font-bold text-[12pt] uppercase tracking-wider underline">
                        FORMULIR PERMOHONAN DAN PEMBERIAN CUTI
                      </div>
                      <div className="text-[9.5pt] font-mono mt-0.5">
                        Nomor : {nomorSurat}
                      </div>
                    </div>

                    {/* BAGIAN I: DATA PEGAWAI */}
                    <div className="mt-4">
                      <div className="font-bold text-[10pt] uppercase bg-slate-100 px-2 py-1 border border-slate-800 border-b-0">
                        I. DATA PEGAWAI
                      </div>
                      <table className="w-full border-collapse border border-slate-800 text-[9pt]">
                        <tbody>
                          <tr className="border-b border-slate-800">
                            <td className="w-36 p-1.5 font-medium border-r border-slate-800">Nama</td>
                            <td className="p-1.5 font-bold uppercase border-r border-slate-800">{namaPegawai}</td>
                            <td className="w-28 p-1.5 font-medium border-r border-slate-800">NIP</td>
                            <td className="w-48 p-1.5 font-mono">{nipPegawai}</td>
                          </tr>
                          <tr className="border-b border-slate-800">
                            <td className="p-1.5 font-medium border-r border-slate-800">Jabatan</td>
                            <td className="p-1.5 border-r border-slate-800">{jabatanPegawai}</td>
                            <td className="p-1.5 font-medium border-r border-slate-800">Masa Kerja</td>
                            <td className="p-1.5">{masaKerja}</td>
                          </tr>
                          <tr>
                            <td className="p-1.5 font-medium border-r border-slate-800">Unit Kerja</td>
                            <td colSpan={3} className="p-1.5 font-semibold">
                              {unitKerja}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* BAGIAN II: JENIS CUTI YANG DIAMBIL */}
                    <div className="mt-3">
                      <div className="font-bold text-[10pt] uppercase bg-slate-100 px-2 py-1 border border-slate-800 border-b-0">
                        II. JENIS CUTI YANG DIAMBIL **
                      </div>
                      <table className="w-full border-collapse border border-slate-800 text-[9pt]">
                        <tbody>
                          <tr className="border-b border-slate-800">
                            <td className="w-1/2 p-1.5 border-r border-slate-800 flex items-center justify-between">
                              <span>1. Cuti Tahunan</span>
                              <span className="font-bold text-base px-2 font-mono">
                                {isTahunan ? '[ ✓ ]' : '[   ]'}
                              </span>
                            </td>
                            <td className="w-1/2 p-1.5 flex items-center justify-between">
                              <span>2. Cuti Besar</span>
                              <span className="font-bold text-base px-2 font-mono">
                                {isBesar ? '[ ✓ ]' : '[   ]'}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-800">
                            <td className="w-1/2 p-1.5 border-r border-slate-800 flex items-center justify-between">
                              <span>3. Cuti Sakit</span>
                              <span className="font-bold text-base px-2 font-mono">
                                {isSakit ? '[ ✓ ]' : '[   ]'}
                              </span>
                            </td>
                            <td className="w-1/2 p-1.5 flex items-center justify-between">
                              <span>4. Cuti Melahirkan</span>
                              <span className="font-bold text-base px-2 font-mono">
                                {isMelahirkan ? '[ ✓ ]' : '[   ]'}
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="w-1/2 p-1.5 border-r border-slate-800 flex items-center justify-between">
                              <span>5. Cuti Karena Alasan Penting</span>
                              <span className="font-bold text-base px-2 font-mono">
                                {isAlasanPenting ? '[ ✓ ]' : '[   ]'}
                              </span>
                            </td>
                            <td className="w-1/2 p-1.5 flex items-center justify-between">
                              <span>6. Cuti di Luar Tanggungan Negara</span>
                              <span className="font-bold text-base px-2 font-mono">
                                {isCLTN ? '[ ✓ ]' : '[   ]'}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* BAGIAN III: ALASAN CUTI */}
                    <div className="mt-3">
                      <div className="font-bold text-[10pt] uppercase bg-slate-100 px-2 py-1 border border-slate-800 border-b-0">
                        III. ALASAN CUTI
                      </div>
                      <div className="border border-slate-800 p-2.5 text-[9pt] min-h-[50px] leading-relaxed text-justify">
                        {alasanCuti}
                      </div>
                    </div>

                    {/* BAGIAN IV: LAMANYA CUTI */}
                    <div className="mt-3">
                      <div className="font-bold text-[10pt] uppercase bg-slate-100 px-2 py-1 border border-slate-800 border-b-0">
                        IV. LAMANYA CUTI
                      </div>
                      <table className="w-full border-collapse border border-slate-800 text-[9pt]">
                        <tbody>
                          <tr>
                            <td className="w-24 p-1.5 font-medium border-r border-slate-800">Selama</td>
                            <td className="p-1.5 border-r border-slate-800 font-bold">
                              {durasiHari} ({durasiTerbilang}) hari kerja
                            </td>
                            <td className="w-36 p-1.5 font-medium border-r border-slate-800">Mulai Tanggal</td>
                            <td className="p-1.5 font-semibold">
                              {tglMulaiFormatted} s/d {tglSelesaiFormatted}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Tanda Tangan Pemohon */}
                    <div className="flex justify-end text-[9pt] mt-6">
                      <div className="text-center w-64">
                        <div>Hormat Saya,</div>
                        <div className="h-16 flex items-center justify-center text-slate-400 italic text-[8pt]">
                          (Tanda Tangan Pemohon)
                        </div>
                        <div className="font-bold underline uppercase">{namaPegawai}</div>
                        <div className="font-mono text-[8.5pt]">NIP. {nipPegawai}</div>
                      </div>
                    </div>

                    <div className="text-[7.5pt] text-slate-500 italic mt-4 pt-2 border-t border-slate-200">
                      * Lembar 1 dari 2 Formulir Permohonan & Pemberian Cuti Resmi KPU Kota Sungai Penuh
                    </div>
                  </div>
                )}

                {/* PEMISAH HALAMAN VISUAL DI PREVIEW MODAL */}
                {activeTab === 'all' && (
                  <div className="no-print my-6 flex items-center justify-center gap-3">
                    <div className="h-px bg-slate-300 flex-1"></div>
                    <div className="px-3 py-1 bg-slate-700 text-white text-[11px] font-bold rounded-full shadow-xs flex items-center gap-1.5">
                      <span>BATAS HALAMAN 1</span>
                      <span>&bull;</span>
                      <span>HALAMAN 2 (CATATAN CUTI & PERSETUJUAN)</span>
                    </div>
                    <div className="h-px bg-slate-300 flex-1"></div>
                  </div>
                )}

                {/* ------------------------------------------------------------ */}
                {/* HALAMAN 2: CATATAN CUTI & PENGESAHAN PEJABAT (BAGIAN V - VIII) */}
                {/* ------------------------------------------------------------ */}
                {(activeTab === 'all' || activeTab === 'page2') && (
                  <div className="print-page page-break-before bg-white shadow-md p-8 sm:p-12 border border-slate-300 print:border-0 print:shadow-none print:p-0 mb-8 print:mb-0">
                    
                    {/* BAGIAN V: CATATAN CUTI *** */}
                    <div>
                      <div className="font-bold text-[10pt] uppercase bg-slate-100 px-2 py-1 border border-slate-800 border-b-0">
                        V. CATATAN CUTI ***
                      </div>
                      <table className="w-full border-collapse border border-slate-800 text-[8.5pt]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-800 text-center font-bold">
                            <td colSpan={3} className="p-1 border-r border-slate-800">
                              1. CUTI TAHUNAN
                            </td>
                            <td className="p-1 border-r border-slate-800 w-28">2. CUTI BESAR</td>
                            <td className="p-1 border-r border-slate-800 w-24">3. CUTI SAKIT</td>
                            <td className="p-1 border-r border-slate-800 w-28">4. CUTI MELAHIRKAN</td>
                            <td className="p-1 border-r border-slate-800 w-32">5. CUTI ALASAN PENTING</td>
                            <td className="p-1">6. CUTI DI LUAR TN</td>
                          </tr>
                          <tr className="bg-slate-50/70 border-b border-slate-800 text-center text-[7.5pt]">
                            <td className="p-1 border-r border-slate-800 w-16">Tahun</td>
                            <td className="p-1 border-r border-slate-800 w-16">Sisa</td>
                            <td className="p-1 border-r border-slate-800 w-28">Keterangan</td>
                            <td rowSpan={4} className="p-1 border-r border-slate-800 text-center align-middle font-mono">
                              {isBesar ? `${durasiHari} hari` : '-'}
                            </td>
                            <td rowSpan={4} className="p-1 border-r border-slate-800 text-center align-middle font-mono">
                              {isSakit ? `${durasiHari} hari` : '-'}
                            </td>
                            <td rowSpan={4} className="p-1 border-r border-slate-800 text-center align-middle font-mono">
                              {isMelahirkan ? `${durasiHari} hari` : '-'}
                            </td>
                            <td rowSpan={4} className="p-1 border-r border-slate-800 text-center align-middle font-mono">
                              {isAlasanPenting ? `${durasiHari} hari` : '-'}
                            </td>
                            <td rowSpan={4} className="p-1 text-center align-middle font-mono">
                              {isCLTN ? `${durasiHari} hari` : '-'}
                            </td>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-800 text-center">
                            <td className="p-1 border-r border-slate-800 font-mono">{currentYear - 2}</td>
                            <td className="p-1 border-r border-slate-800 font-mono">{saldoN2}</td>
                            <td className="p-1 border-r border-slate-800 text-left text-[8pt]">-</td>
                          </tr>
                          <tr className="border-b border-slate-800 text-center">
                            <td className="p-1 border-r border-slate-800 font-mono">{currentYear - 1}</td>
                            <td className="p-1 border-r border-slate-800 font-mono">{saldoN1}</td>
                            <td className="p-1 border-r border-slate-800 text-left text-[8pt]">-</td>
                          </tr>
                          <tr className="border-b border-slate-800 text-center">
                            <td className="p-1 border-r border-slate-800 font-mono">{currentYear}</td>
                            <td className="p-1 border-r border-slate-800 font-mono font-bold text-emerald-800">
                              {sisaCutiN}
                            </td>
                            <td className="p-1 border-r border-slate-800 text-left text-[8pt]">
                              Hak: {hakCutiN}, Diambil: {cutiDiambilN}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* BAGIAN VI: ALAMAT SELAMA MENJALANKAN CUTI */}
                    <div className="mt-3">
                      <div className="font-bold text-[10pt] uppercase bg-slate-100 px-2 py-1 border border-slate-800 border-b-0">
                        VI. ALAMAT SELAMA MENJALANKAN CUTI
                      </div>
                      <table className="w-full border-collapse border border-slate-800 text-[9pt]">
                        <tbody>
                          <tr className="border-b border-slate-800">
                            <td className="w-32 p-1.5 font-medium border-r border-slate-800">Alamat Lengkap</td>
                            <td className="p-1.5 border-r border-slate-800">{alamatCuti}</td>
                            <td rowSpan={2} className="w-56 p-2 text-center align-middle">
                              <div className="text-[8.5pt]">Hormat Saya,</div>
                              <div className="h-10 flex items-center justify-center text-slate-300 italic text-[7pt]">
                                (Tanda Tangan)
                              </div>
                              <div className="font-bold underline uppercase text-[8.5pt]">{namaPegawai}</div>
                              <div className="font-mono text-[7.5pt]">NIP. {nipPegawai}</div>
                            </td>
                          </tr>
                          <tr>
                            <td className="p-1.5 font-medium border-r border-slate-800">Telepon / HP</td>
                            <td className="p-1.5 border-r border-slate-800 font-mono">{teleponCuti}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* BAGIAN VII: PERTIMBANGAN ATASAN LANGSUNG */}
                    <div className="mt-3">
                      <div className="font-bold text-[10pt] uppercase bg-slate-100 px-2 py-1 border border-slate-800 border-b-0">
                        VII. PERTIMBANGAN ATASAN LANGSUNG **
                      </div>
                      <table className="w-full border-collapse border border-slate-800 text-[8.5pt]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-800 text-center font-bold">
                            <td className="p-1 border-r border-slate-800 w-1/4">DISETUJUI</td>
                            <td className="p-1 border-r border-slate-800 w-1/4">PERUBAHAN ****</td>
                            <td className="p-1 border-r border-slate-800 w-1/4">DITANGGUHKAN ****</td>
                            <td className="p-1 w-1/4">TIDAK DISETUJUI ****</td>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-800 text-center font-mono font-bold text-sm">
                            <td className="p-1.5 border-r border-slate-800">
                              {statusAtasan === 'setuju' ? '[ ✓ ]' : '[   ]'}
                            </td>
                            <td className="p-1.5 border-r border-slate-800">
                              {statusAtasan === 'perubahan' ? '[ ✓ ]' : '[   ]'}
                            </td>
                            <td className="p-1.5 border-r border-slate-800">
                              {statusAtasan === 'tangguhkan' ? '[ ✓ ]' : '[   ]'}
                            </td>
                            <td className="p-1.5">
                              {statusAtasan === 'tolak' ? '[ ✓ ]' : '[   ]'}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="p-2 border-r border-slate-800 align-top text-left">
                              <div className="font-bold text-[8pt] text-slate-600 mb-0.5">Catatan Atasan Langsung:</div>
                              <div className="italic text-[8pt]">{catatanAtasan}</div>
                            </td>
                            <td colSpan={2} className="p-2 text-center align-top">
                              <div className="font-semibold text-[8pt]">{jabatanAtasan}</div>
                              <div className="h-14 flex items-center justify-center text-slate-300 italic text-[7pt]">
                                (Tanda Tangan Atasan Langsung)
                              </div>
                              <div className="font-bold underline text-[8.5pt]">{namaAtasan}</div>
                              <div className="font-mono text-[7.5pt]">NIP. {nipAtasan}</div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* BAGIAN VIII: KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI */}
                    <div className="mt-3">
                      <div className="font-bold text-[10pt] uppercase bg-slate-100 px-2 py-1 border border-slate-800 border-b-0">
                        VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI **
                      </div>
                      <table className="w-full border-collapse border border-slate-800 text-[8.5pt]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-800 text-center font-bold">
                            <td className="p-1 border-r border-slate-800 w-1/4">DISETUJUI</td>
                            <td className="p-1 border-r border-slate-800 w-1/4">PERUBAHAN ****</td>
                            <td className="p-1 border-r border-slate-800 w-1/4">DITANGGUHKAN ****</td>
                            <td className="p-1 w-1/4">TIDAK DISETUJUI ****</td>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-800 text-center font-mono font-bold text-sm">
                            <td className="p-1.5 border-r border-slate-800">
                              {statusPejabat === 'setuju' ? '[ ✓ ]' : '[   ]'}
                            </td>
                            <td className="p-1.5 border-r border-slate-800">
                              {statusPejabat === 'perubahan' ? '[ ✓ ]' : '[   ]'}
                            </td>
                            <td className="p-1.5 border-r border-slate-800">
                              {statusPejabat === 'tangguhkan' ? '[ ✓ ]' : '[   ]'}
                            </td>
                            <td className="p-1.5">
                              {statusPejabat === 'tolak' ? '[ ✓ ]' : '[   ]'}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="p-2 border-r border-slate-800 align-top text-left">
                              <div className="font-bold text-[8pt] text-slate-600 mb-0.5">Catatan Pejabat:</div>
                              <div className="italic text-[8pt]">{catatanPejabat}</div>
                              <div className="text-[7.5pt] text-slate-500 mt-2">
                                Berdasarkan Keputusan Sekjen KPU No. 102 Th 2022 tentang Pedoman Pemberian Cuti PNS di Lingkungan KPU.
                              </div>
                            </td>
                            <td colSpan={2} className="p-2 text-center align-top">
                              <div className="font-semibold text-[8pt]">{jabatanPejabat}</div>
                              <div className="h-14 flex items-center justify-center text-slate-300 italic text-[7pt]">
                                (Tanda Tangan & Cap Dinas)
                              </div>
                              <div className="font-bold underline text-[8.5pt]">{namaPejabat}</div>
                              <div className="font-mono text-[7.5pt]">NIP. {nipPejabat}</div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="text-[7pt] text-slate-500 italic mt-3 pt-2 border-t border-slate-200">
                      ** Beri tanda centang (✓) sesuai pilihan &bull; *** Diisi oleh pejabat yang menangani bidang kepegawaian sebelum PNS mengajukan cuti &bull; **** Diberi alasan perubahan/penangguhan/penolakan
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ============================================================ */}
            {/* OPSI 3: FORMAT NARATIF (SURAT PERMOHONAN CUTI KEPADA KASUBBAG/SEKRETARIS) */}
            {/* ============================================================ */}
            {activeTab === 'surat' && (
              <div className="print-page bg-white shadow-md p-8 sm:p-12 border border-slate-300 print:border-0 print:shadow-none print:p-0">
                {/* Header Tanggal & Tujuan */}
                <div className="flex justify-between items-start text-xs leading-relaxed">
                  <div>
                    <table>
                      <tbody>
                        <tr>
                          <td className="w-16 font-bold">Perihal</td>
                          <td className="w-3">:</td>
                          <td className="font-bold">Permohonan {leaveTypeName}</td>
                        </tr>
                        <tr>
                          <td className="font-bold">Lampiran</td>
                          <td className="w-3">:</td>
                          <td>1 (Satu) Berkas Formulir Cuti</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="text-right">
                    <div>Sungai Penuh, {tanggalSurat}</div>
                    <div className="mt-2 text-left">
                      <div>Kepada Yth.</div>
                      <div className="font-bold">{tujuanSurat}</div>
                      <div>di -</div>
                      <div className="pl-4 font-semibold">{kotaTujuan || 'Sungai Penuh'}</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs pt-4">
                  <div>Dengan Hormat,</div>
                  <div className="mt-2">Saya yang bertanda tangan di bawah ini :</div>
                </div>

                {/* Data Pemohon */}
                <div className="pl-4 text-xs my-2">
                  <table className="leading-relaxed">
                    <tbody>
                      <tr>
                        <td className="w-32 font-medium">Nama</td>
                        <td className="w-3">:</td>
                        <td className="font-bold uppercase">{namaPegawai}</td>
                      </tr>
                      <tr>
                        <td className="font-medium">NIP</td>
                        <td className="w-3">:</td>
                        <td className="font-mono">{nipPegawai}</td>
                      </tr>
                      <tr>
                        <td className="font-medium">Pangkat / Gol</td>
                        <td className="w-3">:</td>
                        <td>{pangkatGolongan}</td>
                      </tr>
                      <tr>
                        <td className="font-medium">Jabatan</td>
                        <td className="w-3">:</td>
                        <td>{jabatanPegawai}</td>
                      </tr>
                      <tr>
                        <td className="font-medium">Unit Kerja</td>
                        <td className="w-3">:</td>
                        <td>{unitKerja}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Paragraf Permohonan */}
                <div className="text-xs text-justify leading-relaxed space-y-2">
                  <p>
                    Dengan ini mengajukan <strong>{leaveTypeName}</strong> selama{' '}
                    <strong>{durasiHari} ({durasiTerbilang}) hari kerja</strong> karena{' '}
                    <em>{alasanCuti}</em>, terhitung tanggal{' '}
                    <strong>{tglMulaiFormatted}</strong> s/d <strong>{tglSelesaiFormatted}</strong>. Adapun selama
                    menjalankan cuti tersebut, saya akan memastikan seluruh tugas dan tanggung jawab telah
                    diselesaikan dan/atau dikoordinasikan sebagaimana mestinya.
                  </p>
                  <p>
                    Selama menjalankan cuti, alamat saya adalah di <strong>{alamatCuti}</strong> dengan contact
                    person <strong>{teleponCuti}</strong>, dan memastikan akan selalu aktif dan dapat dihubungi.
                  </p>
                  <p>
                    Demikian permohonan ini saya sampaikan, semoga dapat dipertimbangkan. Atas perkenan dan
                    kebijaksanaan Bapak/Ibu, saya ucapkan terima kasih.
                  </p>
                </div>

                {/* Tanda Tangan Pemohon */}
                <div className="flex justify-end text-xs pt-3">
                  <div className="text-center w-64">
                    <div>Hormat Saya,</div>
                    <div className="h-16 flex items-center justify-center text-slate-300 italic text-[8pt]">
                      (Tanda Tangan)
                    </div>
                    <div className="font-bold underline uppercase">{namaPegawai}</div>
                    <div className="text-[9pt] font-mono">NIP. {nipPegawai}</div>
                  </div>
                </div>

                {/* Catatan & Rekomendasi Atasan Langsung */}
                <div className="border-t border-slate-300 pt-3 text-[8pt] text-slate-700 space-y-2 mt-4">
                  <div className="font-bold text-slate-900 text-[8.5pt]">Catatan & Rekomendasi :</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="font-bold underline mb-1">Rekomendasi Atasan Langsung :</div>
                      <ol className="list-decimal list-inside space-y-0.5 leading-tight text-[7.5pt]">
                        <li>Peraturan Pemerintah No. 17 Th 2020 tentang Manajemen PNS;</li>
                        <li>Peraturan BKN No. 7 Th 2021 tentang Tata Cara Pemberian Cuti PNS;</li>
                        <li>Keputusan Sekjen KPU No. 102 Th 2022 tentang Pedoman Pemberian Cuti PNS KPU;</li>
                        <li>Keputusan Sekjen KPU No. 326 Th 2022 tentang Juknis Tunjangan Kinerja Setjen KPU.</li>
                      </ol>

                      <div className="mt-4 text-center">
                        <div className="font-semibold">{jabatanAtasan}</div>
                        <div className="h-12 flex items-center justify-center text-slate-300 italic text-[7pt]">
                          (Tanda Tangan Atasan Langsung)
                        </div>
                        <div className="font-bold underline">{namaAtasan}</div>
                        <div className="text-[7.5pt] font-mono">NIP. {nipAtasan}</div>
                      </div>
                    </div>

                    <div className="text-center flex flex-col justify-between border-l border-slate-200 pl-4">
                      <div>
                        <div className="font-bold underline mb-1">Keputusan Pejabat yang Berwenang :</div>
                        <div className="font-bold text-emerald-800 text-[8.5pt] tracking-wider my-1 border border-slate-400 py-1 bg-emerald-50">
                          DISETUJUI
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="font-semibold">{jabatanPejabat}</div>
                        <div className="h-12 flex items-center justify-center text-slate-300 italic text-[7pt]">
                          (Tanda Tangan & Cap Dinas)
                        </div>
                        <div className="font-bold underline">{namaPejabat}</div>
                        <div className="text-[7.5pt] font-mono">NIP. {nipPejabat}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer (Hidden in Print) */}
        <div className="no-print px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              Format Resmi Formulir Cuti 2 Halaman &bull; Standar Peraturan BKN & Setjen KPU
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenTab}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition border border-slate-300"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka di Tab Baru</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer transition"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang (2 Halaman)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
