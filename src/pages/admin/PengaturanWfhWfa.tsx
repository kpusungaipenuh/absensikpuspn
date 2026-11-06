import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../../services/api';
import { WorkAssignment, Employee } from '../../types';
import { useSubBagianList } from '../../utils/subBagian';
import {
  Laptop,
  Calendar,
  User,
  Plus,
  Trash2,
  Filter,
  RefreshCw,
  Building2,
  Globe,
  Users,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { saveWorkAssignmentToFirestore } from '../../firebase';

export const PengaturanWfhWfa: React.FC = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(todayStr);

  // Modal 1: Single assignment
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [singleEmpId, setSingleEmpId] = useState('');
  const [singleDate, setSingleDate] = useState(todayStr);
  const [singleMethod, setSingleMethod] = useState<'WFO' | 'WFH' | 'WFA'>('WFH');
  const [singleSuratTugas, setSingleSuratTugas] = useState('');
  const [singleNotes, setSingleNotes] = useState('');
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);

  // Modal 2: Bulk assignment
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMethod, setBulkMethod] = useState<'WFH' | 'WFA' | 'WFO'>('WFH');
  const [bulkStartDate, setBulkStartDate] = useState(todayStr);
  const [bulkEndDate, setBulkEndDate] = useState(todayStr);
  const [selectedBulkEmpIds, setSelectedBulkEmpIds] = useState<string[]>([]);
  const [bulkUnitFilter, setBulkUnitFilter] = useState('ALL');
  const [bulkSuratTugas, setBulkSuratTugas] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Modal 3: Import Excel / CSV
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [assRes, empRes] = await Promise.all([
        api.getWorkAssignments(filterDate || undefined),
        api.getEmployees()
      ]);
      setAssignments(assRes.assignments || []);
      setEmployees(empRes.employees || []);
      if (empRes.employees && empRes.employees.length > 0 && !singleEmpId) {
        setSingleEmpId(empRes.employees[0].id);
      }
    } catch (e) {
      console.error('Error fetching work assignments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterDate]);

  // Single Save
  const handleSingleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleEmpId || !singleDate) {
      alert('Pilih pegawai dan tanggal.');
      return;
    }

    try {
      setIsSubmittingSingle(true);
      await api.saveWorkAssignment({
        employee_id: singleEmpId,
        tanggal: singleDate,
        metode_kerja: singleMethod,
        surat_tugas: singleSuratTugas.trim() || undefined,
        keterangan: singleNotes.trim() || undefined
      });

      // Simpan ke Firestore
      saveWorkAssignmentToFirestore({
        employee_id: singleEmpId,
        tanggal: singleDate,
        metode_kerja: singleMethod,
        surat_tugas: singleSuratTugas.trim() || '',
        keterangan: singleNotes.trim() || ''
      }).catch(err => console.warn('Firestore work assignment sync warning:', err));

      setShowSingleModal(false);
      setSingleNotes('');
      setSingleSuratTugas('');
      await fetchData();
      alert(`Jadwal ${singleMethod} berhasil ditetapkan.`);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan penugasan kerja.');
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  // Helper: generate list of dates between start and end inclusive
  const getDatesInRange = (startDate: string, endDate: string): string[] => {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // Bulk Save
  const handleBulkSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBulkEmpIds.length === 0) {
      alert('Silakan pilih minimal satu pegawai.');
      return;
    }
    if (!bulkStartDate || !bulkEndDate) {
      alert('Tentukan tanggal mulai dan tanggal selesai.');
      return;
    }
    if (bulkStartDate > bulkEndDate) {
      alert('Tanggal mulai tidak boleh melebihi tanggal selesai.');
      return;
    }

    const dates = getDatesInRange(bulkStartDate, bulkEndDate);
    if (dates.length > 31) {
      alert('Maksimal rentang tanggal adalah 31 hari dalam satu kali penetapan masal.');
      return;
    }

    try {
      setIsSubmittingBulk(true);
      const res = await api.saveBulkWorkAssignments({
        employee_ids: selectedBulkEmpIds,
        dates,
        metode_kerja: bulkMethod,
        surat_tugas: bulkSuratTugas.trim() || undefined,
        keterangan: bulkNotes.trim() || undefined
      });
      setShowBulkModal(false);
      setSelectedBulkEmpIds([]);
      setBulkSuratTugas('');
      setBulkNotes('');
      await fetchData();
      alert(res.message || `Berhasil menetapkan jadwal ${bulkMethod} secara masal.`);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan penugasan masal.');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const subBagianList = useSubBagianList();

  // Bulk Selection Helpers
  const filteredBulkEmployees = employees.filter(emp => {
    if (bulkUnitFilter === 'ALL') return true;
    const sub = emp.sub_bagian || emp.unit_kerja || '';
    return sub === bulkUnitFilter;
  });

  const toggleSelectAllBulk = () => {
    const currentIds = filteredBulkEmployees.map(e => e.id);
    const allSelected = currentIds.every(id => selectedBulkEmpIds.includes(id));
    if (allSelected) {
      setSelectedBulkEmpIds(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      setSelectedBulkEmpIds(prev => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const toggleBulkEmp = (id: string) => {
    setSelectedBulkEmpIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Excel (.xlsx) Template download
  const handleDownloadExcelTemplate = () => {
    const rows = employees.map(e => ({
      'NIP_NIK': e.nip_nik || '',
      'NAMA_LENGKAP': e.nama_lengkap || '',
      'SUB_BAGIAN': e.sub_bagian || e.unit_kerja || '',
      'TANGGAL': todayStr,
      'METODE_KERJA': 'WFH',
      'SURAT_TUGAS': '045/ST/KPU-SP/III/2026',
      'KETERANGAN': 'Penugasan WFH / WFA KPU Kota Sungai Penuh'
    }));

    const finalRows = rows.length > 0 ? rows : [{
      'NIP_NIK': '197010052007012003',
      'NAMA_LENGKAP': 'Contoh Pegawai KPU',
      'SUB_BAGIAN': 'Keuangan, Umum Dan Logistik',
      'TANGGAL': todayStr,
      'METODE_KERJA': 'WFH',
      'SURAT_TUGAS': '045/ST/KPU-SP/III/2026',
      'KETERANGAN': 'Penugasan WFH'
    }];

    const ws = XLSX.utils.json_to_sheet(finalRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template WFH WFA');
    XLSX.writeFile(wb, `template_penugasan_wfh_wfa_kpu_${todayStr}.xlsx`);
  };

  // CSV Template download
  const handleDownloadTemplate = () => {
    const header = 'nip_nik,nama_lengkap,sub_bagian,tanggal,metode_kerja,surat_tugas,keterangan\n';
    const sampleRows = employees.map(e =>
      `"${e.nip_nik || ''}","${e.nama_lengkap}","${e.sub_bagian || e.unit_kerja || ''}","${todayStr}","WFH","045/ST/KPU-SP/III/2026","Penugasan WFH Pleno"`
    ).join('\n');
    const blob = new Blob([header + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_penugasan_wfh_wfa_kpu_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // File Upload parsing (Supports Excel .xlsx, .xls, and .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          alert('File tidak memiliki sheet data.');
          return;
        }
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          alert('Sheet data kosong.');
          return;
        }

        const rows: any[] = [];
        const errs: string[] = [];

        rawJson.forEach((rowObj, idx) => {
          const rowNum = idx + 2; // header is row 1
          // Normalize keys to lowercase trimmed without punctuation
          const normalized: Record<string, string> = {};
          Object.keys(rowObj).forEach(k => {
            const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            normalized[cleanKey] = String(rowObj[k]).trim();
          });

          const nip = normalized['nipnik'] || normalized['nip'] || normalized['nik'] || '';
          const nama = normalized['namalengkap'] || normalized['nama'] || normalized['pegawai'] || '';
          let tgl = normalized['tanggal'] || normalized['tgl'] || normalized['date'] || '';
          const metode = (normalized['metodekerja'] || normalized['metode'] || normalized['status'] || '').toUpperCase();
          const st = normalized['surattugas'] || normalized['st'] || normalized['nomorsurattugas'] || '';
          const ket = normalized['keterangan'] || normalized['alasan'] || normalized['ket'] || '';

          // Format excel numeric date if any
          if (/^\d{5}$/.test(tgl)) {
            const parsedDate = new Date(Math.round((Number(tgl) - 25569) * 86400 * 1000));
            tgl = parsedDate.toISOString().split('T')[0];
          }

          if (!nip && !nama) {
            errs.push(`Baris ${rowNum}: NIP atau Nama Pegawai kosong.`);
            return;
          }
          if (!tgl) {
            errs.push(`Baris ${rowNum}: Tanggal penugasan kosong.`);
            return;
          }
          if (!metode || !['WFH', 'WFA', 'WFO'].includes(metode)) {
            errs.push(`Baris ${rowNum}: Metode kerja harus WFH, WFA, atau WFO (Ditemukan: ${metode || 'kosong'}).`);
            return;
          }

          rows.push({
            nip_nik: nip,
            nama_lengkap: nama,
            tanggal: tgl,
            metode_kerja: metode,
            surat_tugas: st,
            keterangan: ket
          });
        });

        setParsedRows(rows);
        setImportErrors(errs);
      } catch (err: any) {
        alert('Gagal membaca file Excel/CSV: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Submit parsed rows
  const handleImportSubmit = async () => {
    if (parsedRows.length === 0) {
      alert('Tidak ada baris data untuk di-import.');
      return;
    }

    try {
      setIsImporting(true);
      const res = await api.importWorkAssignmentsExcel(parsedRows);
      alert(`Import Selesai!\n\nBerhasil: ${res.importedCount} penugasan disinkronkan ke database KPU.${res.errors?.length ? `\nCatatan: ${res.errors.join(', ')}` : ''}`);
      setShowImportModal(false);
      setParsedRows([]);
      setImportErrors([]);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengimpor data.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Hapus penetapan metode kerja ini?')) {
      try {
        await api.deleteWorkAssignment(id);
        await fetchData();
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus penetapan.');
      }
    }
  };

  const uniqueUnits = Array.from(new Set(employees.map(e => e.unit_kerja))).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-teal-700" />
            <span>KPU Kota Sungai Penuh &bull; Bagian SDM</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Penetapan Metode Kerja (WFH / WFA / WFO)
          </h2>
          <p className="text-xs text-slate-500">
            Tetapkan status kerja pegawai harian: WFH (Rumah), WFA (Dinas Luar), atau WFO secara individu, masal, atau melalui upload file Excel/CSV berdasarkan Surat Tugas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Upload Excel Button */}
          <button
            id="btn-upload-excel-wfh"
            type="button"
            onClick={() => {
              setParsedRows([]);
              setImportErrors([]);
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Upload Excel / CSV</span>
          </button>

          {/* Bulk Input Button */}
          <button
            id="btn-bulk-wfh"
            type="button"
            onClick={() => {
              setSelectedBulkEmpIds([]);
              setShowBulkModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors cursor-pointer"
          >
            <Users className="w-4 h-4 text-purple-600" />
            <span>Penugasan Masal (Surat Tugas)</span>
          </button>

          {/* Single Add Button */}
          <button
            id="btn-add-wfh"
            type="button"
            onClick={() => setShowSingleModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-linear-to-r from-emerald-800 via-teal-700 to-sky-700 hover:opacity-95 rounded-xl shadow-xs transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tetapkan Individu</span>
          </button>

          <button
            onClick={fetchData}
            title="Muat Ulang"
            className="p-2 text-slate-600 hover:text-teal-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-700">Filter Tanggal:</span>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 font-medium text-slate-800 bg-slate-50 focus:outline-hidden"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-slate-500 hover:text-teal-700 underline text-xs cursor-pointer ml-1"
              >
                Semua Tanggal
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-500">
          <span>Total Penugasan Terfilter: <strong className="text-slate-900 font-mono">{assignments.length}</strong></span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Tanggal</th>
                <th className="px-4 py-3 font-semibold">Nama Pegawai & NIP</th>
                <th className="px-4 py-3 font-semibold">Sub Bagian</th>
                <th className="px-4 py-3 font-semibold text-center">Metode Kerja</th>
                <th className="px-4 py-3 font-semibold">Nomor Surat Tugas & Keterangan</th>
                <th className="px-4 py-3 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Memuat penugasan kerja...
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada penugasan khusus pada tanggal ini. Seluruh pegawai berlaku metode kerja default WFO (Work From Office).
                  </td>
                </tr>
              ) : (
                assignments.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {a.tanggal}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{a.nama_lengkap}</div>
                      <div className="text-[11px] font-mono text-slate-400">{a.nip_nik || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{(a as any).sub_bagian || a.unit_kerja || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold ${
                          a.metode_kerja === 'WFH'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : a.metode_kerja === 'WFA'
                            ? 'bg-teal-100 text-teal-800 border border-teal-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {a.metode_kerja}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.surat_tugas && (
                        <div className="font-mono font-semibold text-slate-800 text-[11px] flex items-center gap-1">
                          <FileText className="w-3 h-3 text-red-600 shrink-0" />
                          <span>ST: {a.surat_tugas}</span>
                        </div>
                      )}
                      <div className="text-slate-500 text-[11px]">{a.keterangan || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Penugasan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CREATE SINGLE ASSIGNMENT */}
      {showSingleModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowSingleModal(false)}
          title="Tetapkan Jadwal WFH / WFA Individu"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSingleSave} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pilih Pegawai <span className="text-red-600">*</span>:
              </label>
              <select
                required
                value={singleEmpId}
                onChange={e => setSingleEmpId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nama_lengkap} (NIP: {emp.nip_nik || '-'}) - {emp.unit_kerja}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Tanggal Penugasan <span className="text-red-600">*</span>:
              </label>
              <input
                type="date"
                required
                value={singleDate}
                onChange={e => setSingleDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-red-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Metode Kerja <span className="text-red-600">*</span>:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['WFH', 'WFA', 'WFO'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSingleMethod(m)}
                    className={`py-2 text-center rounded-xl font-bold border transition-colors cursor-pointer ${
                      singleMethod === m
                        ? 'bg-red-700 text-white border-red-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nomor Surat Tugas KPU:
              </label>
              <input
                type="text"
                value={singleSuratTugas}
                onChange={e => setSingleSuratTugas(e.target.value)}
                placeholder="Contoh: 045/ST/KPU-SP/III/2026"
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Keterangan / Uraian Tugas:
              </label>
              <textarea
                rows={2}
                value={singleNotes}
                onChange={e => setSingleNotes(e.target.value)}
                placeholder="Misal: Penugasan penyusunan laporan keuangan pleno..."
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSingleModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingSingle}
                className="px-4 py-2 font-semibold text-white bg-linear-to-r from-emerald-800 to-teal-700 hover:opacity-95 rounded-xl shadow-xs transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isSubmittingSingle ? 'Menyimpan...' : 'Simpan Penugasan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: BULK ASSIGNMENT (MASAL) */}
      {showBulkModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowBulkModal(false)}
          title="Penetapan WFH / WFA Secara Masal (Berdasarkan Surat Tugas)"
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleBulkSave} className="space-y-4 text-xs">
            <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-purple-900 text-[11px] leading-relaxed">
              💡 <strong>Fitur Masal:</strong> Pilih beberapa pegawai sekaligus dan tentukan rentang tanggal penugasan kerja berdasarkan Surat Tugas KPU. Sistem akan otomatis menetapkan jadwal untuk setiap pegawai dan tanggal yang dipilih.
            </div>

            {/* Metode & Rentang Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Metode Kerja <span className="text-red-600">*</span>:
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['WFH', 'WFA', 'WFO'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBulkMethod(m)}
                      className={`py-2 text-center rounded-xl font-bold border transition-colors cursor-pointer ${
                        bulkMethod === m
                          ? 'bg-purple-700 text-white border-purple-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Dari Tanggal <span className="text-red-600">*</span>:
                </label>
                <input
                  type="date"
                  required
                  value={bulkStartDate}
                  onChange={e => setBulkStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Sampai Tanggal <span className="text-red-600">*</span>:
                </label>
                <input
                  type="date"
                  required
                  value={bulkEndDate}
                  onChange={e => setBulkEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Surat Tugas & Keterangan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor Surat Tugas KPU:
                </label>
                <input
                  type="text"
                  value={bulkSuratTugas}
                  onChange={e => setBulkSuratTugas(e.target.value)}
                  placeholder="Contoh: 088/ST/KPU-SP/III/2026"
                  className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan / Maksud Penugasan:
                </label>
                <input
                  type="text"
                  value={bulkNotes}
                  onChange={e => setBulkNotes(e.target.value)}
                  placeholder="Misal: Penugasan koordinasi persiapan pilkada serentak..."
                  className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Employee Multi-Select */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-800">
                    Pilih Pegawai ({selectedBulkEmpIds.length} Terpilih):
                  </label>
                  <select
                    value={bulkUnitFilter}
                    onChange={e => setBulkUnitFilter(e.target.value)}
                    className="p-1 border border-slate-300 rounded-lg text-slate-700 font-medium text-xs"
                  >
                    <option value="ALL">Semua Sub Bagian</option>
                    {subBagianList.map(u => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={toggleSelectAllBulk}
                  className="text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
                >
                  Pilih / Batal Semua ({filteredBulkEmployees.length})
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                {filteredBulkEmployees.map(emp => {
                  const checked = selectedBulkEmpIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-3 p-2.5 hover:bg-purple-50/50 cursor-pointer select-none transition ${
                        checked ? 'bg-purple-50/80 font-semibold' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBulkEmp(emp.id)}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="text-slate-900">{emp.nama_lengkap}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          NIP: {emp.nip_nik || '-'} &bull; {emp.jabatan} ({emp.sub_bagian || emp.unit_kerja})
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingBulk || selectedBulkEmpIds.length === 0}
                className="px-5 py-2 font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmittingBulk
                  ? 'Menyimpan Penugasan...'
                  : `Simpan Penugasan (${selectedBulkEmpIds.length} Pegawai)`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 3: IMPORT EXCEL / CSV */}
      {showImportModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowImportModal(false)}
          title="Upload Excel / CSV Penugasan WFH & WFA"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-emerald-950 text-[11px] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  Format File Excel & CSV yang Didukung
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Template Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Template CSV</span>
                  </button>
                </div>
              </div>
              <p className="leading-relaxed">
                Kolom template yang dibutuhkan: <code>nip_nik</code> (atau <code>nama_lengkap</code>), <code>sub_bagian</code>, <code>tanggal</code> (format YYYY-MM-DD), <code>metode_kerja</code> (WFH / WFA / WFO), <code>surat_tugas</code>, dan <code>keterangan</code>.
              </p>
            </div>

            {/* File Input */}
            <div className="p-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl text-center bg-slate-50 transition cursor-pointer">
              <input
                type="file"
                id="excel-file-input"
                accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="excel-file-input" className="cursor-pointer space-y-2 block">
                <Upload className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="font-bold text-slate-800 text-sm">
                  Klik untuk Memilih File Excel (.xlsx / .xls) atau CSV
                </div>
                <div className="text-[11px] text-slate-500">
                  Mendukung file Microsoft Excel (.xlsx, .xls) dan CSV dengan pemisah koma
                </div>
              </label>
            </div>

            {/* Parse Errors */}
            {importErrors.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] space-y-1 max-h-28 overflow-y-auto">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Peringatan Pembacaan Baris ({importErrors.length}):</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {importErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview Table */}
            {parsedRows.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Pratinjau Data ({parsedRows.length} Baris Siap Di-import):</span>
                  <button
                    type="button"
                    onClick={() => setParsedRows([])}
                    className="text-rose-600 hover:underline cursor-pointer"
                  >
                    Hapus Data
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0">
                      <tr>
                        <th className="p-2">NIP / Pegawai</th>
                        <th className="p-2">Tanggal</th>
                        <th className="p-2">Metode</th>
                        <th className="p-2">Surat Tugas</th>
                        <th className="p-2">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2 font-medium text-slate-900">
                            {r.nip_nik || r.nama_lengkap}
                          </td>
                          <td className="p-2 font-mono">{r.tanggal}</td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                              {r.metode_kerja}
                            </span>
                          </td>
                          <td className="p-2 text-slate-600 font-mono text-[10px]">
                            {r.surat_tugas || '-'}
                          </td>
                          <td className="p-2 text-slate-600">{r.keterangan || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isImporting || parsedRows.length === 0}
                onClick={handleImportSubmit}
                className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isImporting
                  ? 'Mengimpor Data...'
                  : `Proses Import (${parsedRows.length} Penugasan)`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
