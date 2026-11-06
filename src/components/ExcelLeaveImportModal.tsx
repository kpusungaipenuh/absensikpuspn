import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { Employee, LeaveType } from '../types';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  FileCheck,
  HelpCircle,
  Clock,
  ShieldAlert
} from 'lucide-react';

interface ExcelLeaveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employees: Employee[];
  leaveTypes: LeaveType[];
}

interface ParsedLeaveRow {
  rowNum: number;
  nip: string;
  nama: string;
  employeeId?: string;
  employeeMatchedName?: string;
  leaveTypeName: string;
  leaveTypeId?: string;
  nomorSurat?: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  tanggalPengajuan?: string;
  tanggalApproval?: string;
  potongSaldo: boolean;
  catatanAdmin?: string;
  isValid: boolean;
  validationError?: string;
}

// Helper to format Excel serial date or string date to YYYY-MM-DD
function formatExcelDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial number
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  // Tangani string serial Excel numerik seperti "46024"
  if (/^\d{5}$/.test(str)) {
    const num = Number(str);
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  // If DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    if (parts[2].length === 4) {
      // DD-MM-YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return str;
}

export const ExcelLeaveImportModal: React.FC<ExcelLeaveImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  employees,
  leaveTypes
}) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedLeaveRow[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceNoDeduct, setForceNoDeduct] = useState(true);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    count: number;
    errors: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. Download official Excel template
  const handleDownloadTemplate = () => {
    const sampleEmp1 = employees[0] || { nip_nik: '198506152010011002', nama_lengkap: 'Contoh Pegawai 1' };
    const sampleEmp2 = employees[1] || { nip_nik: '199001012015012001', nama_lengkap: 'Contoh Pegawai 2' };

    const templateData = [
      {
        'NIP': sampleEmp1.nip_nik,
        'NAMA PEGAWAI': sampleEmp1.nama_lengkap,
        'JENIS CUTI': 'Cuti Tahunan',
        'NOMOR SURAT / SK': '800.1.11.1/01/KPU-SP/2024',
        'TANGGAL MULAI (YYYY-MM-DD)': '2024-04-15',
        'TANGGAL SELESAI (YYYY-MM-DD)': '2024-04-17',
        'JUMLAH HARI': 3,
        'ALASAN CUTI': 'Keperluan keluarga di luar kota',
        'STATUS': 'Disetujui',
        'TANGGAL PENGAJUAN (YYYY-MM-DD)': '2024-04-10',
        'POTONG SALDO (YA/TIDAK)': 'TIDAK',
        'CATATAN': 'Migrasi data aplikasi cuti sebelumnya'
      },
      {
        'NIP': sampleEmp2.nip_nik,
        'NAMA PEGAWAI': sampleEmp2.nama_lengkap,
        'JENIS CUTI': 'Cuti Sakit',
        'NOMOR SURAT / SK': '800.1.11.1/02/KPU-SP/2024',
        'TANGGAL MULAI (YYYY-MM-DD)': '2024-06-03',
        'TANGGAL SELESAI (YYYY-MM-DD)': '2024-06-04',
        'JUMLAH HARI': 2,
        'ALASAN CUTI': 'Sakit demam surat dokter',
        'STATUS': 'Disetujui',
        'TANGGAL PENGAJUAN (YYYY-MM-DD)': '2024-06-03',
        'POTONG SALDO (YA/TIDAK)': 'TIDAK',
        'CATATAN': 'Riwayat cuti lampau'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    // set column widths
    ws['!cols'] = [
      { wch: 22 }, // NIP
      { wch: 26 }, // NAMA
      { wch: 18 }, // JENIS CUTI
      { wch: 26 }, // NOMOR SURAT
      { wch: 20 }, // TGL MULAI
      { wch: 20 }, // TGL SELESAI
      { wch: 14 }, // JUMLAH HARI
      { wch: 30 }, // ALASAN
      { wch: 14 }, // STATUS
      { wch: 20 }, // TGL PENGAJUAN
      { wch: 18 }, // POTONG SALDO
      { wch: 30 }  // CATATAN
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Riwayat_Cuti');
    XLSX.writeFile(wb, 'Template_Import_Riwayat_Cuti_KPU.xlsx');
  };

  // 2. Parse uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessingFile(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rawJson.length === 0) {
          alert('File Excel kosong atau tidak memiliki data.');
          setIsProcessingFile(false);
          return;
        }

        const parsed: ParsedLeaveRow[] = rawJson.map((row, index) => {
          const rowNum = index + 2; // header is row 1

          // Normalisasi keys case-insensitive
          const getVal = (...keys: string[]): string => {
            for (const k of keys) {
              const matchedKey = Object.keys(row).find(
                rk => rk.trim().toLowerCase() === k.trim().toLowerCase()
              );
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== '') {
                return String(row[matchedKey]).trim();
              }
            }
            return '';
          };

          const nip = getVal('NIP', 'NIP/NIK', 'NIP/NIPPPK', 'nip');
          const nama = getVal('NAMA', 'NAMA PEGAWAI', 'nama', 'Nama Lengkap');
          const leaveTypeStr = getVal('JENIS CUTI', 'JENIS', 'jenis_cuti', 'KODE CUTI');
          const nomorSurat = getVal('NOMOR SURAT', 'NOMOR SURAT / SK', 'NOMOR PENGAJUAN', 'NO SURAT', 'no_surat');
          const startDateRaw = getVal('TANGGAL MULAI (YYYY-MM-DD)', 'TANGGAL MULAI', 'TGL MULAI', 'start_date', 'mulai');
          const endDateRaw = getVal('TANGGAL SELESAI (YYYY-MM-DD)', 'TANGGAL SELESAI', 'TGL SELESAI', 'end_date', 'selesai');
          const daysRaw = getVal('JUMLAH HARI', 'HARI', 'hari', 'days');
          const reason = getVal('ALASAN', 'ALASAN CUTI', 'KEPERLUAN', 'keterangan') || 'Riwayat cuti masa lalu';
          const status = getVal('STATUS', 'status') || 'Disetujui';
          const tglPengajuanRaw = getVal('TANGGAL PENGAJUAN (YYYY-MM-DD)', 'TANGGAL PENGAJUAN', 'TGL PENGAJUAN');
          const potongSaldoStr = getVal('POTONG SALDO (YA/TIDAK)', 'POTONG SALDO', 'potong_saldo').toUpperCase();
          const catatanAdmin = getVal('CATATAN', 'CATATAN ADMIN', 'catatan') || 'Import riwayat cuti lampau';

          const startDate = formatExcelDate(startDateRaw);
          const endDate = formatExcelDate(endDateRaw || startDateRaw);
          const tanggalPengajuan = formatExcelDate(tglPengajuanRaw) || startDate;

          // Find employee
          let matchedEmp = employees.find(e => {
            if (nip && e.nip_nik.trim().toLowerCase() === nip.toLowerCase()) return true;
            if (nama && e.nama_lengkap.trim().toLowerCase() === nama.toLowerCase()) return true;
            return false;
          });

          // Match leave type
          let matchedType = leaveTypes.find(t => {
            const search = leaveTypeStr.toLowerCase();
            return (
              t.nama.toLowerCase().includes(search) ||
              t.kode.toLowerCase() === search
            );
          }) || leaveTypes.find(t => t.id === 'lt_ct') || leaveTypes[0];

          let days = Number(daysRaw);
          if (!days || isNaN(days)) {
            if (startDate && endDate) {
              const d1 = new Date(startDate).getTime();
              const d2 = new Date(endDate).getTime();
              days = Math.max(1, Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
            } else {
              days = 1;
            }
          }

          let isValid = true;
          let validationError = '';

          if (!matchedEmp) {
            isValid = false;
            validationError = `Pegawai dengan NIP "${nip}" atau Nama "${nama}" tidak ditemukan di database.`;
          } else if (!startDate || !endDate) {
            isValid = false;
            validationError = 'Tanggal mulai atau tanggal selesai tidak valid.';
          }

          const isCT = matchedType?.id === 'lt_ct' || matchedType?.kode === 'CT';
          const potongSaldo = isCT ? (potongSaldoStr === 'YA' || potongSaldoStr === 'TRUE' || potongSaldoStr === '1') : false;

          return {
            rowNum,
            nip,
            nama,
            employeeId: matchedEmp?.id,
            employeeMatchedName: matchedEmp?.nama_lengkap,
            leaveTypeName: matchedType?.nama || leaveTypeStr || 'Cuti Tahunan',
            leaveTypeId: matchedType?.id,
            nomorSurat,
            startDate,
            endDate,
            days,
            reason,
            status,
            tanggalPengajuan,
            tanggalApproval: tanggalPengajuan,
            potongSaldo,
            catatanAdmin,
            isValid,
            validationError
          };
        });

        setParsedRows(parsed);
      } catch (err: any) {
        alert('Gagal membaca file Excel: ' + err.message);
      } finally {
        setIsProcessingFile(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // 3. Submit import to backend
  const handleStartImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('Tidak ada baris data valid untuk diimport.');
      return;
    }

    try {
      setIsSubmitting(true);
      const items = validRows.map(r => ({
        employeeId: r.employeeId,
        leaveTypeId: r.leaveTypeId,
        nomorPengajuan: r.nomorSurat,
        startDate: r.startDate,
        endDate: r.endDate,
        days: r.days,
        reason: r.reason,
        status: r.status,
        tanggalPengajuan: r.tanggalPengajuan,
        tanggalApproval: r.tanggalApproval,
        potongSaldo: forceNoDeduct ? false : r.potongSaldo,
        catatanAdmin: r.catatanAdmin
      }));

      const res = await api.importHistoricalLeaves(items);
      setImportResult({
        success: true,
        message: res.message,
        count: res.count,
        errors: res.errors || []
      });

      onSuccess();
    } catch (err: any) {
      setImportResult({
        success: false,
        message: err.message || 'Gagal mengimport data.',
        count: 0,
        errors: [err.message]
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const errorCount = parsedRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Import Riwayat Cuti dari Excel</h3>
              <p className="text-xs text-slate-300">
                Pindahkan histori pengajuan cuti masa lalu secara massal ke dalam sistem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {importResult?.success ? (
            <div className="py-8 px-4 text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner ring-8 ring-emerald-50">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h4 className="text-xl font-bold text-slate-900">Import Riwayat Cuti Berhasil!</h4>
                <p className="text-sm text-slate-700 leading-relaxed font-semibold">
                  {importResult.message}
                </p>
                <p className="text-xs text-emerald-800 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-200 inline-block mt-2">
                  ✓ Data riwayat cuti telah tersimpan rapi dan tidak akan terduplikasi.
                </p>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="w-full max-w-lg text-left bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs mt-2">
                  <p className="font-bold text-amber-900 mb-1">Catatan / Data yang Dilewati ({importResult.errors.length}):</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-amber-800 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Result Alert if failed */}
              {importResult && !importResult.success && (
                <div className="p-4 rounded-xl border bg-red-50 border-red-200 text-red-900 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-sm">{importResult.message}</p>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <ul className="text-xs list-disc pl-4 text-slate-700 space-y-0.5 max-h-32 overflow-y-auto">
                        {importResult.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

          {/* Aturan Pemotongan Saldo Banner */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900">
              <span className="font-bold block mb-0.5">Ketentuan Pemotongan Saldo:</span>
              <span className="text-[11px] text-blue-700 leading-relaxed">
                Hanya jenis <strong>Cuti Tahunan</strong> yang dapat memotong saldo cuti tahunan pegawai. Semua jenis cuti lainnya (Cuti Sakit, Cuti Alasan Penting, Cuti Melahirkan, Cuti Besar, dll.) <strong>tidak akan memotong saldo cuti tahunan</strong>.
              </span>
            </div>
          </div>

          {/* Action Step 1: Download Template */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
                Langkah 1: Unduh Format Dokumen
              </span>
              <p className="text-xs text-slate-600">
                Gunakan template Excel resmi agar format kolom (NIP, Tanggal, Jenis Cuti) sesuai otomatis.
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 shadow-2xs transition cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-red-600" />
              <span>Unduh Template Excel</span>
            </button>
          </div>

          {/* Action Step 2: Upload File */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
              Langkah 2: Unggah Berkas Riwayat Cuti
            </span>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-red-500 bg-slate-50/50 hover:bg-red-50/20 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="p-3 bg-red-100 text-red-700 rounded-full">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {fileName ? `File terpilih: ${fileName}` : 'Klik untuk memilih file Excel atau seret berkas ke sini'}
                </p>
                <p className="text-[11px] text-slate-500">Mendukung format .xlsx, .xls, atau .csv</p>
              </div>
            </div>
          </div>

          {/* Option: Force No Deduct */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={forceNoDeduct}
                onChange={e => setForceNoDeduct(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <div className="text-xs">
                <span className="font-bold text-amber-900 block">
                  Simpan sebagai riwayat murni (Jangan kurangi saldo cuti tahun berjalan pegawai)
                </span>
                <span className="text-slate-600 text-[11px] leading-relaxed">
                  Direkomendasikan untuk pencatatan cuti yang telah berlalu / aplikasi lama agar saldo cuti pegawai saat ini tidak ikut terpotong ulang.
                </span>
              </div>
            </label>
          </div>

          {/* Parsed Rows Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Pratinjau Data ({parsedRows.length} baris terbaca)
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {validCount} Siap Import
                  </span>
                  {errorCount > 0 && (
                    <span className="text-red-700 font-semibold flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> {errorCount} Gagal Validasi
                    </span>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 font-semibold">Baris</th>
                      <th className="p-2.5 font-semibold">Pegawai</th>
                      <th className="p-2.5 font-semibold">Jenis Cuti</th>
                      <th className="p-2.5 font-semibold">Rentang Tanggal</th>
                      <th className="p-2.5 font-semibold text-center">Hari</th>
                      <th className="p-2.5 font-semibold">Status Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row) => (
                      <tr key={row.rowNum} className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/40'}>
                        <td className="p-2.5 text-slate-500 font-mono text-[11px]">{row.rowNum}</td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-800">
                            {row.employeeMatchedName || row.nama || '-'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            NIP: {row.nip || 'Tidak ada'}
                          </div>
                        </td>
                        <td className="p-2.5 font-medium text-slate-700">{row.leaveTypeName}</td>
                        <td className="p-2.5 text-[11px] text-slate-600">
                          {row.startDate} s/d {row.endDate}
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-800">{row.days}</td>
                        <td className="p-2.5">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-[10px] font-bold"
                              title={row.validationError}
                            >
                              <AlertCircle className="w-3 h-3" /> {row.validationError}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          {importResult?.success ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setFileName(null);
                  setParsedRows([]);
                  setImportResult(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Upload Berkas Lain
              </button>

              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesai & Tutup</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                disabled={isSubmitting || validCount === 0}
                onClick={handleStartImport}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sedang Mengimpor Data...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>Mulai Import ({validCount} Riwayat Cuti)</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
