import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  FileCheck,
  HelpCircle,
  Database
} from 'lucide-react';
import { api } from '../services/api';
import { syncEmployeesToFirestore } from '../firebase';

interface ExcelEmployeeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingNips: string[];
}

interface ParsedEmployeeRow {
  nip_nik: string;
  nama_lengkap: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  pangkat_golongan?: string;
  sub_bagian?: string;
  username?: string;
  email?: string;
  nomor_hp?: string;
  jabatan?: string;
  unit_kerja?: string;
  role?: string;
  jatah_cuti_tahunan?: number;
  tanggal_masuk?: string;
  password?: string;
  status: 'valid' | 'duplicate' | 'error';
  errorMessage?: string;
}

export const ExcelEmployeeImportModal: React.FC<ExcelEmployeeImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingNips
}) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    importedCount: number;
    skippedCount: number;
    firestoreSynced?: boolean;
    errors?: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const existingNipSet = new Set(existingNips.map(n => String(n).trim().replace(/['"`\s-]/g, '')));

  if (!isOpen) return null;

  // 1. Download official Excel template matching exact headers:
  // NAMA, TEMPAT LAHIR, TANGGAL LAHIR, NIP/NIPPPK, PANGKAT GOLONGAN, JABATAN, SUB BAGIAN, no hp, email
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'NAMA': 'Budi Santoso, S.Kom',
        'TEMPAT LAHIR': 'Sungai Penuh',
        'TANGGAL LAHIR': '1985-06-15',
        'NIP/NIPPPK': '198506152010011002',
        'PANGKAT GOLONGAN': 'Penata Muda / III/a',
        'JABATAN': 'Staf Pelaksana',
        'SUB BAGIAN': 'Subbag Teknis & Parhubmas',
        'no hp': '081234567890',
        'email': 'budi.santoso@kpu-sungaipenuh.go.id'
      },
      {
        'NAMA': 'Siti Rahmawati, S.Sos',
        'TEMPAT LAHIR': 'Kerinci',
        'TANGGAL LAHIR': '1990-08-20',
        'NIP/NIPPPK': '199008202014022003',
        'PANGKAT GOLONGAN': 'Penata Muda Tk. I / III/b',
        'JABATAN': 'Pranata Humas',
        'SUB BAGIAN': 'Subbag Hukum & SDM',
        'no hp': '081398765432',
        'email': 'siti.rahma@kpu-sungaipenuh.go.id'
      },
      {
        'NAMA': 'Ahmad Fauzi, M.Si',
        'TEMPAT LAHIR': 'Jambi',
        'TANGGAL LAHIR': '1982-04-12',
        'NIP/NIPPPK': '198204122008011005',
        'PANGKAT GOLONGAN': 'Penata Tk. I / III/d',
        'JABATAN': 'Kasubbag Keuangan & Logistik',
        'SUB BAGIAN': 'Subbag Keuangan, Umum & Logistik',
        'no hp': '082155667788',
        'email': 'ahmad.fauzi@kpu-sungaipenuh.go.id'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);

    // Auto-fit column widths
    ws['!cols'] = [
      { wch: 28 }, // NAMA
      { wch: 18 }, // TEMPAT LAHIR
      { wch: 16 }, // TANGGAL LAHIR
      { wch: 24 }, // NIP/NIPPPK
      { wch: 28 }, // PANGKAT GOLONGAN
      { wch: 30 }, // JABATAN
      { wch: 35 }, // SUB BAGIAN
      { wch: 18 }, // no hp
      { wch: 36 }  // email
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Pegawai KPU');
    XLSX.writeFile(wb, 'Template_Data_Pegawai_KPU_Sungai_Penuh.xlsx');
  };

  // 2. Parse uploaded file with flexible header detection and date parsing
  const processFile = (file: File) => {
    setIsProcessingFile(true);
    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];

        // Read sheet as 2D array to locate the exact header row
        const sheetAOA = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });

        if (!sheetAOA || sheetAOA.length === 0) {
          alert('File Excel kosong atau tidak memiliki baris data pada sheet pertama.');
          setIsProcessingFile(false);
          return;
        }

        // Find header row by searching for keywords: "nama", "nip", "jabatan"
        let headerRowIdx = sheetAOA.findIndex(row => 
          Array.isArray(row) && row.some(cell => {
            const str = String(cell || '').toLowerCase().trim();
            return str.includes('nama') || str.includes('nip') || str.includes('jabatan');
          })
        );

        if (headerRowIdx === -1) {
          headerRowIdx = 0; // Fallback to first row
        }

        const rawHeaders = sheetAOA[headerRowIdx].map(h => String(h || '').trim());
        const dataRows = sheetAOA.slice(headerRowIdx + 1);

        if (dataRows.length === 0) {
          alert('Tidak ditemukan baris data di bawah judul kolom pada file Excel.');
          setIsProcessingFile(false);
          return;
        }

        // Helper to format Excel serial date or date string
        const formatExcelDate = (val: any): string => {
          if (!val) return '';
          if (typeof val === 'number' && val > 10000 && val < 60000) {
            try {
              const d = new Date(Math.round((val - 25569) * 86400 * 1000));
              if (!isNaN(d.getTime())) {
                return d.toISOString().split('T')[0];
              }
            } catch (_) {}
          }
          const str = String(val).trim();
          const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (dmyMatch) {
            const day = dmyMatch[1].padStart(2, '0');
            const month = dmyMatch[2].padStart(2, '0');
            const year = dmyMatch[3];
            return `${year}-${month}-${day}`;
          }
          return str;
        };

        // Normalize header keys into canonical names
        const getCanonicalKey = (rawHeader: string): string => {
          const h = rawHeader.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (h.includes('nama')) return 'nama';
          if (h.includes('tempatlahir')) return 'tempat_lahir';
          if (h.includes('tanggallahir') || (h.includes('tanggal') && h.includes('lahir'))) return 'tanggal_lahir';
          if (h.includes('nipppk') || h.includes('nip') || h.includes('nik')) return 'nip';
          if (h.includes('pangkat') || h.includes('golongan')) return 'pangkat_golongan';
          if (h.includes('jabatan')) return 'jabatan';
          if (h.includes('subbagian') || h.includes('subbag') || h.includes('bagian') || h.includes('unitkerja')) return 'sub_bagian';
          if (h.includes('nohp') || h.includes('telepon') || h.includes('hp') || h.includes('wa') || h.includes('kontak')) return 'no_hp';
          if (h.includes('email') || h.includes('surel')) return 'email';
          if (h.includes('role') || h.includes('peran')) return 'role';
          if (h.includes('cuti')) return 'jatah_cuti';
          if (h.includes('masuk')) return 'tanggal_masuk';
          if (h.includes('password') || h.includes('sandi')) return 'password';
          return rawHeader;
        };

        const canonicalHeaders = rawHeaders.map(getCanonicalKey);

        const seenNipsInFile = new Set<string>();
        const parsed: ParsedEmployeeRow[] = [];

        dataRows.forEach((rowArray, index) => {
          if (!Array.isArray(rowArray) || rowArray.every(cell => String(cell || '').trim() === '')) {
            return; // Skip completely empty rows
          }

          const rowObj: Record<string, any> = {};
          canonicalHeaders.forEach((key, colIdx) => {
            rowObj[key] = rowArray[colIdx] ?? '';
          });

          const nama = String(rowObj['nama'] || '').trim();
          if (!nama) return; // Skip rows without name

          const tempatLahir = String(rowObj['tempat_lahir'] || '').trim();
          const tanggalLahir = formatExcelDate(rowObj['tanggal_lahir']);
          
          let nip = String(rowObj['nip'] || '').trim().replace(/['"`]/g, '');
          const pangkatGolongan = String(rowObj['pangkat_golongan'] || '').trim();
          const jabatan = String(rowObj['jabatan'] || 'Staf Pelaksana').trim();
          const subBagian = String(rowObj['sub_bagian'] || 'Sekretariat KPU').trim();
          const noHp = String(rowObj['no_hp'] || '').trim();
          const email = String(rowObj['email'] || '').trim().toLowerCase();
          const role = (String(rowObj['role'] || 'pegawai').toLowerCase() === 'admin') ? 'admin' : 'pegawai';
          const username = String(rowObj['username'] || '').trim();
          const password = String(rowObj['password'] || 'kpu123').trim();
          const jatahCuti = Number(rowObj['jatah_cuti'] || 12) || 12;
          const tanggalMasuk = formatExcelDate(rowObj['tanggal_masuk']) || new Date().toISOString().split('T')[0];

          // Handle honorary/PPNPN or empty NIP gracefully
          if (!nip || nip === '-' || nip.toLowerCase() === 'non asn' || nip.toLowerCase() === 'ppnpn') {
            const safeName = nama.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
            nip = `NON-ASN-${safeName}-${index + 1}`;
          }

          let status: 'valid' | 'duplicate' | 'error' = 'valid';
          let errorMessage: string | undefined = undefined;

          const cleanNipForCheck = nip.replace(/[\s'-]/g, '');

          if (existingNipSet.has(cleanNipForCheck)) {
            status = 'duplicate';
            errorMessage = `NIP ${nip} sudah ada di database`;
          } else if (seenNipsInFile.has(cleanNipForCheck)) {
            status = 'duplicate';
            errorMessage = `NIP ${nip} duplikat di file Excel ini`;
          } else {
            seenNipsInFile.add(cleanNipForCheck);
          }

          parsed.push({
            nip_nik: nip,
            nama_lengkap: nama,
            tempat_lahir: tempatLahir,
            tanggal_lahir: tanggalLahir,
            pangkat_golongan: pangkatGolongan,
            sub_bagian: subBagian,
            jabatan,
            unit_kerja: subBagian,
            role,
            nomor_hp: noHp,
            email,
            username,
            password,
            jatah_cuti_tahunan: jatahCuti,
            tanggal_masuk: tanggalMasuk,
            status,
            errorMessage
          });
        });

        if (parsed.length === 0) {
          alert('Tidak ditemukan data pegawai yang dapat dibaca dari file Excel.');
          setIsProcessingFile(false);
          return;
        }

        setParsedRows(parsed);
      } catch (err: any) {
        console.error('Error parsing excel:', err);
        alert('Format file tidak didukung atau rusak: ' + (err.message || 'Gagal membaca Excel'));
      } finally {
        setIsProcessingFile(false);
      }
    };

    reader.onerror = () => {
      alert('Gagal membaca file dari perangkat.');
      setIsProcessingFile(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // 3. Submit valid rows
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter(r => r.status === 'valid');
    if (validRows.length === 0) {
      alert('Tidak ada baris data valid yang siap diimpor.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.bulkImportEmployees(validRows);

      // Also sync to Google Firebase Firestore!
      let firestoreSynced = false;
      if (res.imported && res.imported.length > 0) {
        try {
          const syncedCount = await syncEmployeesToFirestore(res.imported);
          firestoreSynced = syncedCount > 0;
        } catch (fErr) {
          console.warn('Firestore sync note:', fErr);
        }
      }

      setImportResult({
        success: res.importedCount > 0,
        message: res.message,
        importedCount: res.importedCount,
        skippedCount: res.skippedCount,
        firestoreSynced,
        errors: res.errors
      });

      // Refresh parent list if at least one imported
      if (res.importedCount > 0) {
        onSuccess();
      }
    } catch (err: any) {
      alert('Gagal melakukan impor: ' + (err.message || 'Terjadi kesalahan server'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = parsedRows.filter(r => r.status === 'valid').length;
  const duplicateCount = parsedRows.filter(r => r.status === 'duplicate').length;
  const errorCount = parsedRows.filter(r => r.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">
                Upload & Impor Data Pegawai via Excel
              </h3>
              <p className="text-xs text-slate-500">
                Impor massal data pegawai ke database lokal & Google Firebase Firestore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Cloud Database Integration Banner */}
          <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200/70 rounded-xl text-xs">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-red-600 shrink-0" />
              <div>
                <span className="font-bold text-red-900">Database Ekosistem Google Cloud:</span>{' '}
                <span className="text-red-700">Google Firebase Firestore aktif & siap menerima data sinkronisasi otomatis.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Unduh Template Excel
            </button>
          </div>

          {/* Import Result Notification if complete */}
          {importResult && (
            <div
              className={`p-4 rounded-xl space-y-2 border ${
                importResult.importedCount > 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div
                className={`flex items-center gap-2 font-bold text-sm ${
                  importResult.importedCount > 0 ? 'text-emerald-900' : 'text-amber-900'
                }`}
              >
                {importResult.importedCount > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <span>
                  {importResult.importedCount > 0
                    ? 'Proses Impor Berhasil!'
                    : 'Tidak Ada Data Pegawai Baru yang Diimpor'}
                </span>
              </div>
              <p
                className={`text-xs ${
                  importResult.importedCount > 0 ? 'text-emerald-800' : 'text-amber-800'
                }`}
              >
                {importResult.message}
              </p>
              <div
                className={`flex flex-wrap items-center gap-4 text-xs font-medium pt-1 ${
                  importResult.importedCount > 0 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                <span>
                  &bull; Berhasil ditambahkan: <strong>{importResult.importedCount} pegawai</strong>
                </span>
                {importResult.skippedCount > 0 && (
                  <span>
                    &bull; Dilewati / Terdaftar: <strong>{importResult.skippedCount} pegawai</strong>
                  </span>
                )}
                {importResult.firestoreSynced && (
                  <span className="bg-emerald-200/80 px-2 py-0.5 rounded text-emerald-900">
                    &check; Tersinkronisasi ke Firebase Firestore
                  </span>
                )}
              </div>

              {/* Show error breakdown if any */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-2 pt-2 border-t border-amber-200/60 text-xs text-amber-900 space-y-1 max-h-36 overflow-y-auto">
                  <div className="font-semibold text-amber-950">Detail catatan / kendala:</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-amber-800">
                    {importResult.errors.slice(0, 10).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li className="italic text-amber-700">
                        ...dan {importResult.errors.length - 10} baris lainnya.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Upload Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
              fileName
                ? 'border-emerald-400 bg-emerald-50/40'
                : 'border-slate-300 hover:border-red-400 hover:bg-slate-50/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="p-3 bg-red-100 text-red-700 rounded-2xl">
                <UploadCloud className="w-8 h-8" />
              </div>
              {fileName ? (
                <div>
                  <div className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-emerald-600" /> {fileName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Klik untuk memilih file lain atau seret file baru ke sini
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-bold text-slate-700">
                    Klik untuk upload atau seret file Excel / CSV ke area ini
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Mendukung format <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Instructions note */}
          <div className="text-[11px] text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800">Format Header Kolom Excel Pegawai:</strong>
                <p className="text-slate-500 mt-0.5">
                  Sistem membaca dan memetakan header kolom resmi berikut secara otomatis:
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                'NAMA',
                'TEMPAT LAHIR',
                'TANGGAL LAHIR',
                'NIP/NIPPPK',
                'PANGKAT GOLONGAN',
                'JABATAN',
                'SUB BAGIAN',
                'no hp',
                'email'
              ].map((hdr, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono font-bold text-slate-700 shadow-2xs"
                >
                  {hdr}
                </span>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center gap-2 text-slate-700">
              <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Akun Pegawai Otomatis:
              </span>
              <span>
                Username = <strong>NIP</strong> (tanpa spasi) | Password Default = <strong>kpu123</strong>
              </span>
            </div>
          </div>

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2">
              {/* Counter Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Pratinjau Data ({parsedRows.length} Baris Terbaca)
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-lg flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {validCount} Siap Diimpor
                  </span>
                  {duplicateCount > 0 && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-semibold rounded-lg flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      {duplicateCount} Duplikat
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-semibold rounded-lg flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      {errorCount} Error
                    </span>
                  )}
                </div>
              </div>

              {/* Table Container */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold w-8">No</th>
                      <th className="py-2 px-3 font-semibold">NAMA</th>
                      <th className="py-2 px-3 font-semibold">TEMPAT / TGL LAHIR</th>
                      <th className="py-2 px-3 font-semibold">NIP/NIPPPK</th>
                      <th className="py-2 px-3 font-semibold">PANGKAT GOLONGAN</th>
                      <th className="py-2 px-3 font-semibold">JABATAN</th>
                      <th className="py-2 px-3 font-semibold">SUB BAGIAN</th>
                      <th className="py-2 px-3 font-semibold">NO HP</th>
                      <th className="py-2 px-3 font-semibold">EMAIL</th>
                      <th className="py-2 px-3 font-semibold">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50 transition-colors ${
                          row.status === 'valid'
                            ? ''
                            : row.status === 'duplicate'
                            ? 'bg-amber-50/50'
                            : 'bg-rose-50/50'
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">{row.nama_lengkap || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {row.tempat_lahir || row.tanggal_lahir ? (
                            <span>{row.tempat_lahir || '-'}{row.tanggal_lahir ? `, ${row.tanggal_lahir}` : ''}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium whitespace-nowrap">{row.nip_nik || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{row.pangkat_golongan || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{row.jabatan}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{row.sub_bagian || row.unit_kerja}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{row.nomor_hp || '-'}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{row.email || '-'}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {row.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                                row.status === 'duplicate' ? 'text-amber-700' : 'text-rose-700'
                              }`}
                              title={row.errorMessage}
                            >
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[130px]">{row.errorMessage}</span>
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 ? (
              <span>
                <strong>{validCount}</strong> dari {parsedRows.length} pegawai siap dimasukkan ke sistem.
              </span>
            ) : (
              <span>Silakan pilih atau unduh template Excel terlebih dahulu.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              {importResult ? 'Tutup' : 'Batal'}
            </button>
            <button
              type="button"
              disabled={validCount === 0 || isSubmitting || isProcessingFile}
              onClick={handleExecuteImport}
              className="px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mengimpor ke Database & Firestore...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Konfirmasi & Impor ({validCount} Pegawai)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
