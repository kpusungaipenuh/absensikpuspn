import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { AttendanceRecord } from '../../types';
import {
  ClipboardList,
  Filter,
  RefreshCw,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Table as TableIcon,
  CalendarRange,
  Users,
  Percent,
  Download,
  Printer,
  X,
  Trash2,
  PlusCircle
} from 'lucide-react';
import { ExportButtons } from '../../components/ExportButtons';
import { Modal } from '../../components/Modal';
import { ManualAttendanceModal } from '../../components/admin/ManualAttendanceModal';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { useSubBagianList } from '../../utils/subBagian';
import { getWibDateStr } from '../../utils/dateUtils';

export const RekapDaftarHadir: React.FC = () => {
  const todayStr = getWibDateStr();
  const currentMonthStr = todayStr.substring(0, 7);
  const firstDayOfMonth = `${currentMonthStr}-01`;
  const subBagianList = useSubBagianList();

  // Mode Tampilan: 'MATRIX_MONTH' (Rekap Satu Bulan 1-31 Hari) vs 'LOG_TABLE' (Daftar Hadir Log Harian)
  const [activeTab, setActiveTab] = useState<'MATRIX_MONTH' | 'LOG_TABLE'>('MATRIX_MONTH');

  // Mode Tampilan Isi Sel Matrix: 'HOURS' (Jam Masuk - Jam Pulang) vs 'CODES' (H, TL, C, S, I, A)
  const [matrixDisplayMode, setMatrixDisplayMode] = useState<'HOURS' | 'CODES'>('HOURS');

  // Filter Log Table
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [gantiJamFilter, setGantiJamFilter] = useState('ALL');
  const [exportFormatType, setExportFormatType] = useState<'STANDARD' | 'FULL'>('STANDARD');
  const [showManualModal, setShowManualModal] = useState(false);

  // Data Log Table
  const [list, setList] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Delete attendance state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    nama: string;
    nip: string;
    tanggal: string;
    jamMasuk: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter & Data Rekap Matrix Bulanan
  const [matrixMonth, setMatrixMonth] = useState(currentMonthStr);
  const [matrixUnit, setMatrixUnit] = useState('ALL');
  const [matrixSort, setMatrixSort] = useState<'original' | 'asc' | 'desc'>('original');
  const [matrixData, setMatrixData] = useState<any>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Photo viewer modal
  const [photoModal, setPhotoModal] = useState<{ title: string; url: string } | null>(null);

  const handleDeleteAttendance = async () => {
    if (!deleteConfirm) return;
    try {
      setIsDeleting(true);
      await api.deleteAttendance(deleteConfirm.id);
      alert(`Data absensi ${deleteConfirm.nama} tanggal ${deleteConfirm.tanggal} berhasil dihapus. Pegawai dapat melakukan absensi ulang.`);
      setDeleteConfirm(null);
      await fetchRekap();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus data absensi');
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchRekap = async () => {
    try {
      setLoading(true);
      const res = await api.getRekapAttendance({
        startDate,
        endDate,
        unit: unitFilter !== 'ALL' ? unitFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        method: methodFilter !== 'ALL' ? methodFilter : undefined
      });
      let records = res.list || [];
      if (gantiJamFilter !== 'ALL') {
        records = records.filter(r => (r as any).status_ganti_jam === gantiJamFilter);
      }
      setList(records);
      setSummary(res.summary || {});
    } catch (e) {
      console.error('Error fetching rekap daftar hadir:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatrix = async () => {
    try {
      setMatrixLoading(true);
      const res = await api.getRekapAttendanceMatrix({
        month: matrixMonth,
        unit: matrixUnit !== 'ALL' ? matrixUnit : undefined,
        sort: matrixSort
      });
      setMatrixData(res);
    } catch (e) {
      console.error('Error fetching matrix rekap:', e);
    } finally {
      setMatrixLoading(false);
    }
  };

  useEffect(() => {
    fetchRekap();
  }, [startDate, endDate, unitFilter, statusFilter, methodFilter, gantiJamFilter]);

  useEffect(() => {
    if (activeTab === 'MATRIX_MONTH') {
      fetchMatrix();
    }
  }, [activeTab, matrixMonth, matrixUnit, matrixSort]);

  // Kolom Ekspor Standar KPU (Persis sesuai permintaan: No, Nama, NIP, Tanggal, Jam Hadir, Jam Pulang)
  const exportColumnsStandard = [
    { header: 'Nama Pegawai', key: 'nama_lengkap' },
    { header: 'NIP', key: 'nip_nik' },
    { header: 'Tanggal', key: 'tanggal' },
    { header: 'Jam Hadir', key: 'jam_masuk' },
    { header: 'Jam Pulang', key: 'jam_pulang' }
  ];

  // Kolom Ekspor Lengkap (+ Keterlambatan, Status Potong Tukin, Validasi)
  const exportColumnsFull = [
    { header: 'Nama Pegawai', key: 'nama_lengkap' },
    { header: 'NIP', key: 'nip_nik' },
    { header: 'Tanggal', key: 'tanggal' },
    { header: 'Jam Hadir', key: 'jam_masuk' },
    { header: 'Jam Pulang', key: 'jam_pulang' },
    { header: 'Status Kehadiran', key: 'status' },
    { header: 'Terlambat (Mnt)', key: 'keterlambatan_menit' },
    { header: 'Jam Pulang Wajib', key: 'jam_pulang_wajib' },
    { header: 'Status Penggantian / Tukin', key: 'status_ganti_jam_label' },
    { header: 'Metode Kerja', key: 'metode_kerja' },
    { header: 'Validasi Lokasi', key: 'status_validasi_lokasi' }
  ];

  // Data terformat untuk diekspor
  const formattedListData = list.map((item, idx) => ({
    ...item,
    no: idx + 1,
    jam_masuk: item.jam_masuk ? `${item.jam_masuk} WIB` : '-',
    jam_pulang: item.jam_pulang ? `${item.jam_pulang} WIB` : '-',
    keterlambatan_menit: (item as any).keterlambatan_menit || 0,
    jam_pulang_wajib: (item as any).jam_pulang_wajib ? `${(item as any).jam_pulang_wajib} WIB` : '-',
    status_ganti_jam_label:
      (item as any).status_ganti_jam === 'potong_tukin'
        ? 'Dikenakan Potong Tukin (Pulang Sebelum Waktu Pengganti)'
        : (item as any).status_ganti_jam === 'terpenuhi'
        ? 'Kewajiban Jam Terpenuhi'
        : (item as any).status_ganti_jam === 'tidak_perlu'
        ? 'Tepat Waktu'
        : '-'
  }));

  // Ekspor Khusus Rekap Matrix Bulanan ke Excel (Format Kalender 1-31 Hari dengan Jam Hadir & Jam Pulang)
  const exportMatrixExcel = (exportMode: 'HOURS' | 'CODES' = matrixDisplayMode) => {
    if (!matrixData || !matrixData.rows || matrixData.rows.length === 0) {
      alert('Tidak ada data matrix bulanan untuk diekspor.');
      return;
    }

    const daysCount = matrixData.daysMeta?.length || 31;
    // Kolom: No, Nama Pegawai, NIP, [Tanggal 1 s/d N], Rekapitulasi (13 kolom: H, TL, PSW, DD, DL, WFH, CT, S, I, TB, K/P, TK, %)
    const summaryColCount = 13;
    const totalCols = 3 + daysCount + summaryColCount;

    // Header Baris 1: No, Nama, NIP, [KOLOM BULAN MERGED DI ATAS TANGGAL 1-31], Rekapitulasi
    const headerRow1 = [
      'No',
      'Nama Pegawai',
      'NIP',
      `BULAN: ${matrixData.monthName.toUpperCase()} ${matrixData.year}`,
      ...Array(Math.max(0, daysCount - 1)).fill(''),
      'Hadir (H)',
      'Terlambat (TL)',
      'Pulang Cepat (PSW)',
      'Dinas Dalam (DD)',
      'Dinas Luar (DL)',
      'Work From Home (WFH)',
      'Cuti (CT)',
      'Sakit (S)',
      'Izin (I)',
      'Tugas Belajar (TB)',
      'Kursus/Pelatihan (K/P)',
      'Tanpa Keterangan (TK)',
      '% Kehadiran'
    ];

    // Header Baris 2: Sub-header nomor tanggal 1 s/d 31 tepat di bawah kolom bulan
    const headerRow2 = [
      '',
      '',
      '',
      ...matrixData.daysMeta.map((d: any) => `Tgl ${d.day}`),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ];

    const matrixRows = matrixData.rows.map((row: any, idx: number) => {
      const dayValues = row.days.map((d: any) => {
        if (exportMode === 'CODES') {
          return d.code || (d.isNonWorkingDay ? 'LIBUR' : '-');
        }
        // Mode 'HOURS': Menampilkan jam masuk dan jam pulang di dalam kolom tanggal
        if (d.jam_masuk && d.jam_pulang) {
          return `${d.jam_masuk.substring(0, 5)} - ${d.jam_pulang.substring(0, 5)}`;
        } else if (d.jam_masuk) {
          return `${d.jam_masuk.substring(0, 5)} - (Belum Pulang)`;
        } else if (d.isNonWorkingDay) {
          return 'Libur';
        } else if (d.code === 'CT' || d.code === 'C') {
          return 'Cuti';
        } else if (d.code === 'S') {
          return 'Sakit';
        } else if (d.code === 'I') {
          return 'Izin';
        } else if (d.code === 'TK' || d.code === 'A') {
          return 'Tanpa Ket.';
        } else if (d.code === 'DD') {
          return 'Dinas Dalam';
        } else if (d.code === 'DL') {
          return 'Dinas Luar';
        } else if (d.code === 'TB') {
          return 'Tugas Belajar';
        } else if (d.code === 'K/P') {
          return 'Kursus/Pelatihan';
        } else if (d.code === 'WFH') {
          return 'WFH';
        }
        return d.code || '-';
      });

      const s = row.summary || {};
      return [
        idx + 1,
        row.nama_lengkap,
        row.nip_nik,
        ...dayValues,
        s.H || 0,
        s.TL || 0,
        s.PSW || 0,
        s.DD || 0,
        s.DL || 0,
        s.WFH || 0,
        s.CT !== undefined ? s.CT : (s.C || 0),
        s.S || 0,
        s.I || 0,
        s.TB || 0,
        s.KP !== undefined ? s.KP : 0,
        s.TK !== undefined ? s.TK : (s.A || 0),
        s.persentase || '0%'
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['KOMISI PEMILIHAN UMUM KOTA SUNGAI PENUH'],
      ['REKAPITULASI DAFTAR HADIR BULANAN PEGAWAI'],
      [`Bulan: ${matrixData.monthName} ${matrixData.year} | Format Data: ${exportMode === 'HOURS' ? 'Jam Hadir & Jam Pulang' : 'Kode Singkat'}`],
      [`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`],
      headerRow1,
      headerRow2,
      ...matrixRows,
      [],
      ['Keterangan Singkatan Rekapitulasi:'],
      ['TK: Tanpa Keterangan | S: Sakit | I: Izin | TL: Terlambat/Lupa Absen Pagi | PSW: Pulang Sebelum Waktu/Lupa Absen Sore'],
      ['DD: Dinas Dalam Daerah | DL: Dinas Luar Daerah | CT: Cuti | TB: Tugas Belajar | K/P: Kursus/Pelatihan | WFH: Work From Home | H: Hadir'],
      [],
      ['', '', '', 'Sungai Penuh, ' + new Date().toLocaleDateString('id-ID')],
      ['', '', '', 'Sekretaris Komisi Pemilihan Umum Kota Sungai Penuh'],
      [],
      [],
      ['', '', '', 'Hj. Dewi Aprida S.E., M.Si.']
    ]);

    // Merging header cells in SheetJS (0-indexed rows & cols)
    const summaryMerges = Array.from({ length: summaryColCount }, (_, i) => ({
      s: { r: 4, c: 3 + daysCount + i },
      e: { r: 5, c: 3 + daysCount + i }
    }));

    worksheet['!merges'] = [
      // Title rows merge
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(totalCols - 1, 15) } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: Math.min(totalCols - 1, 15) } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: Math.min(totalCols - 1, 15) } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: Math.min(totalCols - 1, 15) } },
      // Table Header row merges
      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // No
      { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } }, // Nama Pegawai
      { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } }, // NIP
      // KOLOM BULAN spanning across tanggal 1 s/d 31:
      { s: { r: 4, c: 3 }, e: { r: 4, c: 3 + daysCount - 1 } },
      // Summary columns merges
      ...summaryMerges
    ];

    // Column widths
    worksheet['!cols'] = [
      { wch: 5 },  // No
      { wch: 28 }, // Nama Pegawai
      { wch: 22 }, // NIP
      // Kolom Tanggal 1 s/d 31
      ...matrixData.daysMeta.map(() => ({ wch: exportMode === 'HOURS' ? 16 : 8 })),
      // Rekapitulasi (13 kolom)
      { wch: 6 },  // H
      { wch: 6 },  // TL
      { wch: 6 },  // PSW
      { wch: 6 },  // DD
      { wch: 6 },  // DL
      { wch: 6 },  // WFH
      { wch: 6 },  // CT
      { wch: 6 },  // S
      { wch: 6 },  // I
      { wch: 6 },  // TB
      { wch: 6 },  // K/P
      { wch: 6 },  // TK
      { wch: 9 }   // %
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Rekap_${matrixData.month}`);
    const fileSuffix = exportMode === 'HOURS' ? 'Jam_Hadir_Pulang' : 'Kode';
    XLSX.writeFile(workbook, `Rekap_Daftar_Hadir_${matrixData.month}_${fileSuffix}.xlsx`);
  };

  // Unduh Berkas PDF Langsung dengan format Kalender Jam Masuk & Jam Pulang (Tanpa Unit Kerja)
  const downloadMatrixPdfDirect = () => {
    if (!matrixData || !matrixData.rows || matrixData.rows.length === 0) {
      alert('Tidak ada data matrix bulanan untuk diunduh.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Judul Kop
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('KOMISI PEMILIHAN UMUM KOTA SUNGAI PENUH', pageWidth / 2, 12, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('REKAPITULASI DAFTAR HADIR BULANAN (JAM MASUK & PULANG)', pageWidth / 2, 17, { align: 'center' });
    
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`BULAN: ${matrixData.monthName?.toUpperCase()} ${matrixData.year} | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, pageWidth / 2, 22, { align: 'center' });

    doc.setLineWidth(0.4);
    doc.line(10, 25, pageWidth - 10, 25);

    let y = 30;
    const startX = 10;
    const tableWidth = pageWidth - 20; // 277mm
    const daysCount = matrixData.daysMeta?.length || 31;
    
    const colNoWidth = 6;
    const colNamaWidth = 38;
    const colNipWidth = 24;
    const colRecWidth = 4.2;
    const recColsCount = 13;
    const totalRecWidth = colRecWidth * recColsCount;
    const colDayWidth = (tableWidth - colNoWidth - colNamaWidth - colNipWidth - totalRecWidth) / daysCount;

    // Header 1:
    doc.setFillColor(235, 238, 242);
    doc.rect(startX, y, tableWidth, 6, 'F');
    doc.setDrawColor(180, 180, 180);
    doc.rect(startX, y, tableWidth, 11);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('No', startX + colNoWidth / 2, y + 7, { align: 'center' });
    doc.text('Nama Pegawai', startX + colNoWidth + colNamaWidth / 2, y + 7, { align: 'center' });
    doc.text('NIP', startX + colNoWidth + colNamaWidth + colNipWidth / 2, y + 7, { align: 'center' });
    
    // Bulan header
    const daysStartX = startX + colNoWidth + colNamaWidth + colNipWidth;
    const daysTotalWidth = colDayWidth * daysCount;
    doc.setFillColor(153, 27, 27); // red-800
    doc.rect(daysStartX, y, daysTotalWidth, 5.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(`BULAN: ${matrixData.monthName?.toUpperCase()} ${matrixData.year}`, daysStartX + daysTotalWidth / 2, y + 4, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Summary header
    const recStartX = daysStartX + daysTotalWidth;
    doc.setFillColor(220, 225, 230);
    doc.rect(recStartX, y, totalRecWidth, 5.5, 'F');
    doc.text('REKAPITULASI', recStartX + totalRecWidth / 2, y + 4, { align: 'center' });

    // Header 2: Days numbers and summary columns
    const y2 = y + 5.5;
    doc.setFontSize(5);
    matrixData.daysMeta.forEach((d: any, i: number) => {
      const curX = daysStartX + i * colDayWidth;
      if (d.isNonWorkingDay) {
        doc.setFillColor(254, 226, 226); // rose-100
        doc.rect(curX, y2, colDayWidth, 5.5, 'F');
      }
      doc.text(String(d.day), curX + colDayWidth / 2, y2 + 4, { align: 'center' });
    });

    const recLabels = ['H', 'TL', 'PSW', 'DD', 'DL', 'WFH', 'CT', 'S', 'I', 'TB', 'K/P', 'TK', '%'];
    recLabels.forEach((lbl, i) => {
      const curX = recStartX + i * colRecWidth;
      doc.text(lbl, curX + colRecWidth / 2, y2 + 4, { align: 'center' });
    });

    y += 11;

    // Body rows:
    const rowHeight = 6;
    doc.setFont('helvetica', 'normal');

    matrixData.rows.forEach((row: any, rIdx: number) => {
      if (y + rowHeight > pageHeight - 32) {
        doc.addPage();
        y = 15;
      }

      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(startX, y, tableWidth, rowHeight, 'F');
      }
      doc.setDrawColor(210, 215, 220);
      doc.rect(startX, y, tableWidth, rowHeight);

      // No
      doc.setFontSize(5.5);
      doc.text(String(rIdx + 1), startX + colNoWidth / 2, y + 4, { align: 'center' });

      // Nama
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      doc.text(row.nama_lengkap.substring(0, 22), startX + colNoWidth + 1, y + 2.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4);
      doc.setTextColor(100, 100, 100);
      doc.text((row.jabatan || '').substring(0, 24), startX + colNoWidth + 1, y + 5.2);
      doc.setTextColor(0, 0, 0);

      // NIP
      doc.setFontSize(4.5);
      doc.text(row.nip_nik, startX + colNoWidth + colNamaWidth + 1, y + 4);

      // Days with jam masuk / pulang
      row.days.forEach((d: any, dIdx: number) => {
        const curX = daysStartX + dIdx * colDayWidth;
        if (d.isNonWorkingDay) {
          doc.setFillColor(245, 245, 245);
          doc.rect(curX, y, colDayWidth, rowHeight, 'F');
          doc.setFontSize(3.5);
          doc.setTextColor(150, 150, 150);
          doc.text('Lbr', curX + colDayWidth / 2, y + 3.8, { align: 'center' });
          doc.setTextColor(0, 0, 0);
        } else if (d.jam_masuk) {
          doc.setFontSize(3.5);
          if (d.code === 'TL') {
            doc.setTextColor(180, 83, 9);
          } else {
            doc.setTextColor(16, 120, 60);
          }
          doc.text(d.jam_masuk.substring(0, 5), curX + colDayWidth / 2, y + 2.6, { align: 'center' });
          
          doc.setTextColor(29, 78, 216);
          doc.text(d.jam_pulang ? d.jam_pulang.substring(0, 5) : '--:--', curX + colDayWidth / 2, y + 5.2, { align: 'center' });
          doc.setTextColor(0, 0, 0);
        } else if (d.code) {
          doc.setFontSize(4.2);
          doc.setFont('helvetica', 'bold');
          doc.text(d.code, curX + colDayWidth / 2, y + 4, { align: 'center' });
          doc.setFont('helvetica', 'normal');
        } else {
          doc.setFontSize(4);
          doc.text('-', curX + colDayWidth / 2, y + 4, { align: 'center' });
        }
      });

      // Summary columns (13 columns)
      doc.setFontSize(4.8);
      const s = row.summary || {};
      const summaries = [
        s.H || 0,
        s.TL || 0,
        s.PSW || 0,
        s.DD || 0,
        s.DL || 0,
        s.WFH || 0,
        s.CT !== undefined ? s.CT : (s.C || 0),
        s.S || 0,
        s.I || 0,
        s.TB || 0,
        s.KP !== undefined ? s.KP : 0,
        s.TK !== undefined ? s.TK : (s.A || 0),
        `${s.persentase || '0%'}`
      ];
      summaries.forEach((val, sIdx) => {
        const curX = recStartX + sIdx * colRecWidth;
        doc.text(String(val), curX + colRecWidth / 2, y + 4, { align: 'center' });
      });

      y += rowHeight;
    });

    // Signature section
    if (y + 26 > pageHeight) {
      doc.addPage();
      y = 15;
    }
    y += 6;
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Keterangan Singkatan: TK: Tanpa Keterangan | S: Sakit | I: Izin | TL: Terlambat/Lupa Absen Pagi | PSW: Pulang Sebelum Waktu/Lupa Absen Sore | DD: Dinas Dalam Daerah | DL: Dinas Luar Daerah | CT: Cuti | TB: Tugas Belajar | K/P: Kursus/Pelatihan | WFH: Work From Home | H: Hadir Tepat Waktu', 10, y);

    const signX = pageWidth - 70;
    doc.setFontSize(6.5);
    doc.text(`Sungai Penuh, ${new Date().toLocaleDateString('id-ID')}`, signX, y + 5);
    doc.text('Sekretaris Komisi Pemilihan Umum Kota Sungai Penuh', signX, y + 9);
    doc.setFont('helvetica', 'bold');
    doc.text('Hj. Dewi Aprida S.E., M.Si.', signX, y + 23);
    doc.setFont('helvetica', 'normal');
    doc.text('NIP. .............................................................', signX, y + 26);

    doc.save(`Rekap_Daftar_Hadir_${matrixData.month}_Jam_Datang_Pulang.pdf`);
  };

  // Ekspor Rekap Matrix Bulanan ke PDF (Membuka dialog cetak / pratinjau PDF)
  const exportMatrixPDF = () => {
    if (!matrixData || !matrixData.rows || matrixData.rows.length === 0) {
      alert('Tidak ada data matrix bulanan untuk dicetak.');
      return;
    }
    setShowPrintModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-teal-700" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Rekapitulasi Daftar Hadir Pegawai
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Komisi Pemilihan Umum (KPU) Kota Sungai Penuh - Laporan Presensi, Jam Hadir & Jam Pulang
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            id="btn-manual-attendance-rekap"
            onClick={() => setShowManualModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
            title="Tambah atau koreksi absensi pegawai secara manual"
          >
            <PlusCircle className="w-3.5 h-3.5 text-teal-200" />
            <span>+ Input Presensi Manual</span>
          </button>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              id="tab-matrix-month"
              onClick={() => setActiveTab('MATRIX_MONTH')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'MATRIX_MONTH'
                  ? 'bg-white text-teal-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarRange className="w-4 h-4" />
              <span>Rekap Satu Bulan (Kalender 1-31 Hari)</span>
            </button>
            <button
              id="tab-log-table"
              onClick={() => setActiveTab('LOG_TABLE')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'LOG_TABLE'
                  ? 'bg-white text-teal-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>Log Rincian Harian (Detail GPS & Selfie)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================= TAB 1: TABEL LOG RINCIAN (NO, NAMA, NIP, TANGGAL, JAM HADIR, JAM PULANG) ======================= */}
      {activeTab === 'LOG_TABLE' && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <div className="text-[11px] font-semibold text-emerald-700">Hadir Tepat Waktu</div>
              <div className="text-xl font-bold text-emerald-800 mt-1">{summary.totalHadir || 0}</div>
              <div className="text-[10px] text-emerald-600 mt-0.5">Sesuai jam kerja</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
              <div className="text-[11px] font-semibold text-amber-700">Terlambat Masuk</div>
              <div className="text-xl font-bold text-amber-800 mt-1">{summary.totalTerlambat || 0}</div>
              <div className="text-[10px] text-amber-600 mt-0.5">Wajib ganti jam</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs">
              <div className="text-[11px] font-semibold text-rose-700">Potong Tukin</div>
              <div className="text-xl font-bold text-rose-800 mt-1">
                {list.filter(r => (r as any).status_ganti_jam === 'potong_tukin').length}
              </div>
              <div className="text-[10px] text-rose-600 mt-0.5">Pulang awal &lt; wajib</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
              <div className="text-[11px] font-semibold text-blue-700">Metode WFO</div>
              <div className="text-xl font-bold text-blue-800 mt-1">{summary.totalWFO || 0}</div>
              <div className="text-[10px] text-blue-600 mt-0.5">Kantor KPU</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs">
              <div className="text-[11px] font-semibold text-purple-700">Metode WFH</div>
              <div className="text-xl font-bold text-purple-800 mt-1">{summary.totalWFH || 0}</div>
              <div className="text-[10px] text-purple-600 mt-0.5">Work from Home</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-700">Total Baris Log</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{list.length}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Sesuai filter aktif</div>
            </div>
          </div>

          {/* Filter & Export Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-xs">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-700">Periode:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium"
                />
                <span className="text-slate-400">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  value={unitFilter}
                  onChange={e => setUnitFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium bg-slate-50"
                >
                  <option value="ALL">Semua Sub Bagian</option>
                  {subBagianList.map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium bg-slate-50"
                >
                  <option value="ALL">Semua Status Kehadiran</option>
                  <option value="Hadir">Hadir</option>
                  <option value="Terlambat">Terlambat</option>
                </select>
              </div>

              <div>
                <select
                  value={gantiJamFilter}
                  onChange={e => setGantiJamFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium bg-slate-50"
                >
                  <option value="ALL">Semua Status Ganti Jam</option>
                  <option value="potong_tukin">⚠️ Pemotongan Tukin</option>
                  <option value="terpenuhi">✓ Terpenuhi</option>
                  <option value="tidak_perlu">Tepat Waktu (Tidak Perlu)</option>
                </select>
              </div>

              <button
                onClick={fetchRekap}
                className="p-1.5 text-slate-600 hover:text-red-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                title="Muat Ulang"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Export Actions (No, Nama, NIP, Tanggal, Jam Hadir, Jam Pulang) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-600">Format Kolom:</span>
                <button
                  onClick={() => setExportFormatType('STANDARD')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    exportFormatType === 'STANDARD'
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Ekspor memuat persis: No, Nama, NIP, Tanggal, Jam Hadir, Jam Pulang"
                >
                  Standar (No, Nama, NIP, Tgl, Jam)
                </button>
                <button
                  onClick={() => setExportFormatType('FULL')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                    exportFormatType === 'FULL'
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Ekspor seluruh kolom termasuk status tukin, metode & jarak"
                >
                  Lengkap (+Tukin/GPS)
                </button>
              </div>

              <ExportButtons
                title={`DAFTAR HADIR PEGAWAI KPU KOTA SUNGAI PENUH (${startDate} s/d ${endDate})`}
                filename={`Daftar_Hadir_KPU_${startDate}_${endDate}`}
                columns={exportFormatType === 'STANDARD' ? exportColumnsStandard : exportColumnsFull}
                data={formattedListData}
              />
            </div>
          </div>

          {/* Main Table: No, Nama, NIP, Tanggal, Jam Hadir, Jam Pulang */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 text-sm">
                  Daftar Hadir Pegawai (Presensi Masuk & Pulang)
                </span>
                <span className="text-xs text-slate-500 ml-2">
                  (Format: No, Nama, NIP, Tanggal, Jam Hadir, Jam Pulang)
                </span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-white rounded-full border border-slate-200 text-slate-600">
                {list.length} Catatan Ditemukan
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-3 font-bold text-center w-12">No.</th>
                    <th className="px-4 py-3 font-bold">Nama Pegawai</th>
                    <th className="px-4 py-3 font-bold font-mono">NIP</th>
                    <th className="px-4 py-3 font-bold font-mono">Tanggal</th>
                    <th className="px-4 py-3 font-bold font-mono text-emerald-800">Jam Hadir</th>
                    <th className="px-4 py-3 font-bold font-mono text-blue-800">Jam Pulang</th>
                    <th className="px-4 py-3 font-bold">Status Kehadiran</th>
                    <th className="px-4 py-3 font-bold">Status Penggantian / Tukin</th>
                    <th className="px-4 py-3 font-bold text-center">Metode</th>
                    <th className="px-4 py-3 font-bold text-center">Foto Selfie</th>
                    <th className="px-4 py-3 font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-red-600" />
                        Memuat data rekap daftar hadir...
                      </td>
                    </tr>
                  ) : list.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                        Tidak ada catatan daftar hadir pada filter periode ini.
                      </td>
                    </tr>
                  ) : (
                    list.map((item: any, index: number) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3.5 py-3 font-bold text-center text-slate-500 font-mono">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{item.nama_lengkap}</div>
                          <div className="text-[11px] text-slate-500">{item.jabatan}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700 font-medium">
                          {item.nip_nik}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-slate-800">
                          {item.tanggal}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700 bg-emerald-50/40">
                          {item.jam_masuk ? `${item.jam_masuk} WIB` : '-'}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-700 bg-blue-50/40">
                          {item.jam_pulang ? `${item.jam_pulang} WIB` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'Hadir'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {item.status}
                            {item.keterlambatan_menit > 0 && ` (+${item.keterlambatan_menit}m)`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {item.status_ganti_jam === 'potong_tukin' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Potong Tukin (Pulang Sebelum Jam Wajib)
                            </span>
                          ) : item.status_ganti_jam === 'terpenuhi' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Ganti Jam Terpenuhi
                            </span>
                          ) : item.keterlambatan_menit > 0 && !item.jam_pulang ? (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              Wajib Pulang min. {item.jam_pulang_wajib?.substring(0, 5) || '-'} WIB
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.metode_kerja === 'WFO'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : item.metode_kerja === 'WFH'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}
                          >
                            {item.metode_kerja}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.foto_masuk && (
                              <button
                                onClick={() =>
                                  setPhotoModal({
                                    title: `Foto Masuk: ${item.nama_lengkap} (${item.tanggal} ${item.jam_masuk})`,
                                    url: item.foto_masuk!
                                  })
                                }
                                className="p-1 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                                title="Lihat Foto Masuk"
                              >
                                <img
                                  src={item.foto_masuk}
                                  alt="In"
                                  className="w-7 h-7 rounded-md object-cover ring-1 ring-slate-200 hover:ring-red-400"
                                />
                              </button>
                            )}
                            {item.foto_pulang && (
                              <button
                                onClick={() =>
                                  setPhotoModal({
                                    title: `Foto Pulang: ${item.nama_lengkap} (${item.tanggal} ${item.jam_pulang})`,
                                    url: item.foto_pulang!
                                  })
                                }
                                className="p-1 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                                title="Lihat Foto Pulang"
                              >
                                <img
                                  src={item.foto_pulang}
                                  alt="Out"
                                  className="w-7 h-7 rounded-md object-cover ring-1 ring-slate-200 hover:ring-blue-400"
                                />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                id: item.id,
                                nama: item.nama_lengkap,
                                nip: item.nip_nik,
                                tanggal: item.tanggal,
                                jamMasuk: item.jam_masuk
                              })
                            }
                            title="Hapus data absensi agar pegawai bisa mengulang absen"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-red-700 hover:text-white bg-red-50 hover:bg-red-700 border border-red-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 2: REKAP BULANAN MATRIX KALENDER (1-31 HARI) ======================= */}
      {activeTab === 'MATRIX_MONTH' && (
        <div className="space-y-4">
          {/* Filter Matrix Toolbar & Export Actions */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-red-600" />
                <span className="font-semibold text-slate-700">Bulan & Tahun:</span>
                <input
                  type="month"
                  value={matrixMonth}
                  onChange={e => setMatrixMonth(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-700">Sub Bagian:</span>
                <select
                  value={matrixUnit}
                  onChange={e => setMatrixUnit(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold bg-slate-50 text-slate-800"
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
                <span className="font-semibold text-slate-700">Urutan:</span>
                <select
                  value={matrixSort}
                  onChange={e => setMatrixSort(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold bg-slate-50 text-slate-800"
                >
                  <option value="original">Sesuai Excel (Upload Asli)</option>
                  <option value="asc">Abjad Nama (A - Z)</option>
                  <option value="desc">Abjad Nama (Z - A)</option>
                </select>
              </div>

              {/* Toggle Mode Tampilan Jam Masuk & Pulang vs Kode Singkat */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setMatrixDisplayMode('HOURS')}
                  className={`px-2.5 py-1.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                    matrixDisplayMode === 'HOURS'
                      ? 'bg-linear-to-r from-emerald-800 to-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tampilkan Jam Hadir & Jam Pulang di setiap kolom tanggal"
                >
                  Jam Hadir & Pulang
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixDisplayMode('CODES')}
                  className={`px-2.5 py-1.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                    matrixDisplayMode === 'CODES'
                      ? 'bg-linear-to-r from-emerald-800 to-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tampilkan Kode Ringkas (H, TL, C, S, I, A)"
                >
                  Kode Singkat (H/TL)
                </button>
              </div>

              <button
                onClick={fetchMatrix}
                className="p-1.5 text-slate-600 hover:text-teal-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                title="Muat Ulang Matrix"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Matrix Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-export-matrix-excel-hours"
                onClick={() => exportMatrixExcel('HOURS')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer text-xs"
                title="Ekspor Excel Format Kolom Bulan & Tanggal berisi Jam Hadir & Jam Pulang"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Ekspor Excel (Jam Masuk & Pulang)</span>
              </button>
              <button
                id="btn-export-matrix-excel-codes"
                onClick={() => exportMatrixExcel('CODES')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-semibold shadow-xs transition-colors cursor-pointer text-xs"
                title="Ekspor Excel Format Kode Singkat (H, TL, C, S, I, A)"
              >
                <span>Excel (Kode)</span>
              </button>
              <button
                id="btn-export-matrix-pdf"
                onClick={exportMatrixPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer text-xs"
                title="Buka dialog cetak dan simpan ke PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / PDF</span>
              </button>
            </div>
          </div>

          {/* Matrix Legend */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 text-xs">
            <span className="font-bold text-slate-700">Keterangan:</span>
            {matrixDisplayMode === 'HOURS' ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                    M: 07:30
                  </span>
                  <span className="text-slate-600">Masuk Tepat Waktu</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    M: 07:45
                  </span>
                  <span className="text-slate-600">Masuk Terlambat (Wajib Ganti Jam)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-900 border border-blue-300">
                    P: 16:30
                  </span>
                  <span className="text-slate-600">Pulang Sesuai Jam Kerja</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-300">
                    P: 16:15
                  </span>
                  <span className="text-slate-600">Pulang Awal (Potong Tukin)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-100 border border-dashed border-slate-300">
                    P: --:--
                  </span>
                  <span className="text-slate-500">Belum Pulang</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
                    Libur
                  </span>
                  <span className="text-slate-500">Akhir Pekan / Libur Nasional</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                    H
                  </span>
                  <span className="text-slate-600">Hadir</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-amber-500 text-white font-bold flex items-center justify-center text-[9px]">
                    TL
                  </span>
                  <span className="text-slate-600">Terlambat / Lupa Absen Pagi (TL)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-orange-500 text-white font-bold flex items-center justify-center text-[9px]">
                    PSW
                  </span>
                  <span className="text-slate-600">Pulang Sebelum Waktu / Lupa Absen Sore (PSW)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-indigo-600 text-white font-bold flex items-center justify-center text-[9px]">
                    DD
                  </span>
                  <span className="text-slate-600">Dinas Dalam Daerah (DD)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-cyan-600 text-white font-bold flex items-center justify-center text-[9px]">
                    DL
                  </span>
                  <span className="text-slate-600">Dinas Luar Daerah (DL)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-purple-600 text-white font-bold flex items-center justify-center text-[9px]">
                    WFH
                  </span>
                  <span className="text-slate-600">Work From Home (WFH)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-teal-600 text-white font-bold flex items-center justify-center text-[9px]">
                    CT
                  </span>
                  <span className="text-slate-600">Cuti (CT)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                    S
                  </span>
                  <span className="text-slate-600">Sakit (S)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-violet-600 text-white font-bold flex items-center justify-center text-[10px]">
                    I
                  </span>
                  <span className="text-slate-600">Izin (I)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-fuchsia-700 text-white font-bold flex items-center justify-center text-[9px]">
                    TB
                  </span>
                  <span className="text-slate-600">Tugas Belajar (TB)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-sky-700 text-white font-bold flex items-center justify-center text-[8.5px]">
                    K/P
                  </span>
                  <span className="text-slate-600">Kursus/Pelatihan (K/P)</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded bg-rose-600 text-white font-bold flex items-center justify-center text-[9px]">
                    TK
                  </span>
                  <span className="text-slate-600">Tanpa Keterangan (TK)</span>
                </div>
              </>
            )}
          </div>

          {/* Matrix Calendar Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-sm">
                  REKAPITULASI DAFTAR HADIR BULANAN: {matrixData?.monthName?.toUpperCase()} {matrixData?.year}
                </span>
                <p className="text-xs text-slate-500">
                  Komisi Pemilihan Umum Kota Sungai Penuh - Format Kalender Tanggal 1 s/d {matrixData?.daysInMonth || 31}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-white rounded-full border border-slate-200 text-slate-600">
                {matrixData?.rows?.length || 0} Pegawai
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0 z-10">
                  {/* BARIS HEADER 1: No, Nama Pegawai, NIP, KOLOM BULAN (MERGED DI ATAS TANGGAL 1-31), Rekapitulasi */}
                  <tr>
                    <th rowSpan={2} className="px-2 py-2 border-r border-slate-200 font-bold text-center w-10">
                      No
                    </th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-200 font-bold text-left min-w-[190px]">
                      Nama Pegawai
                    </th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-200 font-bold text-left min-w-[140px] font-mono">
                      NIP
                    </th>
                    <th
                      colSpan={matrixData?.daysMeta?.length || 31}
                      className="px-3 py-2 border-r border-slate-200 font-bold text-center bg-red-800 text-white uppercase tracking-wider text-xs shadow-inner"
                    >
                      BULAN: {matrixData?.monthName?.toUpperCase()} {matrixData?.year}
                    </th>
                    <th colSpan={13} className="px-2 py-2 font-bold text-center bg-slate-200 text-slate-800">
                      REKAPITULASI (1 BULAN)
                    </th>
                  </tr>

                  {/* BARIS HEADER 2: Nomor Tanggal 1 s/d 31 di bawah kolom Bulan */}
                  <tr>
                    {matrixData?.daysMeta?.map((d: any) => {
                      const dayName = d.dayOfWeek === 0 ? 'Min' : d.dayOfWeek === 1 ? 'Sen' : d.dayOfWeek === 2 ? 'Sel' : d.dayOfWeek === 3 ? 'Rab' : d.dayOfWeek === 4 ? 'Kam' : d.dayOfWeek === 5 ? 'Jum' : 'Sab';
                      return (
                        <th
                          key={d.day}
                          className={`p-1 border-r border-slate-200 text-center ${
                            matrixDisplayMode === 'HOURS' ? 'min-w-[72px]' : 'min-w-[32px]'
                          } ${
                            d.isNonWorkingDay
                              ? 'bg-rose-50 text-rose-700 font-bold'
                              : 'bg-white text-slate-800'
                          }`}
                          title={d.holidayName || (d.dayOfWeek === 0 ? 'Minggu' : d.dayOfWeek === 6 ? 'Sabtu' : d.dateStr)}
                        >
                          <div className="font-mono text-[11px] font-bold">{d.day}</div>
                          <div className="text-[9px] font-normal text-slate-400">{dayName}</div>
                        </th>
                      );
                    })}

                    {/* Sub-header Summary Kehadiran (13 Kolom) */}
                    <th className="p-1 font-bold bg-emerald-50 text-emerald-800 min-w-[30px]" title="Hadir Tepat Waktu">H</th>
                    <th className="p-1 font-bold bg-amber-50 text-amber-800 min-w-[30px]" title="Terlambat / Lupa Absen Pagi">TL</th>
                    <th className="p-1 font-bold bg-orange-50 text-orange-800 min-w-[30px]" title="Pulang Sebelum Waktu / Lupa Absen Sore">PSW</th>
                    <th className="p-1 font-bold bg-indigo-50 text-indigo-800 min-w-[30px]" title="Dinas Dalam Daerah">DD</th>
                    <th className="p-1 font-bold bg-cyan-50 text-cyan-800 min-w-[30px]" title="Dinas Luar Daerah">DL</th>
                    <th className="p-1 font-bold bg-purple-50 text-purple-800 min-w-[30px]" title="Work From Home">WFH</th>
                    <th className="p-1 font-bold bg-teal-50 text-teal-800 min-w-[30px]" title="Cuti">CT</th>
                    <th className="p-1 font-bold bg-blue-50 text-blue-800 min-w-[30px]" title="Sakit">S</th>
                    <th className="p-1 font-bold bg-violet-50 text-violet-800 min-w-[30px]" title="Izin">I</th>
                    <th className="p-1 font-bold bg-fuchsia-50 text-fuchsia-800 min-w-[30px]" title="Tugas Belajar">TB</th>
                    <th className="p-1 font-bold bg-sky-50 text-sky-800 min-w-[30px]" title="Kursus / Pelatihan">K/P</th>
                    <th className="p-1 font-bold bg-rose-50 text-rose-800 min-w-[30px]" title="Tanpa Keterangan">TK</th>
                    <th className="p-1 font-bold bg-slate-200 text-slate-900 min-w-[44px]" title="Persentase Kehadiran">%</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {matrixLoading ? (
                    <tr>
                      <td colSpan={(matrixData?.daysMeta?.length || 31) + 16} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-red-600" />
                        Memuat data rekapitulasi matrix bulanan...
                      </td>
                    </tr>
                  ) : !matrixData?.rows || matrixData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={48} className="py-12 text-center text-slate-400">
                        Tidak ada data pegawai untuk bulan terpilih.
                      </td>
                    </tr>
                  ) : (
                    matrixData.rows.map((row: any, idx: number) => {
                      const s = row.summary || {};
                      return (
                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-2 py-2 font-mono font-bold text-center text-slate-500 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 text-left border-r border-slate-200">
                            <div className="font-bold text-slate-900 leading-tight" title={row.nama_lengkap}>
                              {row.nama_lengkap}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{row.jabatan}</div>
                          </td>
                          <td className="px-3 py-2 text-left border-r border-slate-200 font-mono text-xs text-slate-700">
                            {row.nip_nik}
                          </td>

                          {/* Cells Tanggal 1..31: Tempat Jam Masuk dan Jam Pulang */}
                          {row.days.map((d: any) => {
                            if (matrixDisplayMode === 'HOURS') {
                              return (
                                <td
                                  key={d.day}
                                  className={`p-1 border-r border-slate-200 text-center ${
                                    d.isNonWorkingDay ? 'bg-slate-50/80' : ''
                                  }`}
                                  title={`Tgl ${d.day}: ${d.keterangan || ''}`}
                                >
                                  {d.jam_masuk ? (
                                    <div className="flex flex-col gap-0.5 items-center justify-center min-w-[68px]">
                                      {/* Jam Masuk */}
                                      <div
                                        className={`w-full text-center px-1 py-0.5 rounded text-[10px] font-mono font-bold leading-tight ${
                                          d.code === 'TL'
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                            : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        }`}
                                        title={`Jam Masuk: ${d.jam_masuk} ${d.code === 'TL' ? `(Terlambat ${d.keterlambatan_menit}m - Wajib Ganti Jam)` : '(Tepat Waktu)'}`}
                                      >
                                        M: {d.jam_masuk.substring(0, 5)}
                                      </div>

                                      {/* Jam Pulang */}
                                      <div
                                        className={`w-full text-center px-1 py-0.5 rounded text-[10px] font-mono font-bold leading-tight ${
                                          d.jam_pulang
                                            ? d.status_ganti_jam === 'potong_tukin' || d.code === 'PSW'
                                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                              : 'bg-blue-100 text-blue-900 border border-blue-300'
                                            : 'bg-slate-100 text-slate-400 border border-dashed border-slate-300'
                                        }`}
                                        title={
                                          d.jam_pulang
                                            ? `Jam Pulang: ${d.jam_pulang} ${d.status_ganti_jam === 'potong_tukin' ? '(Peringatan: Potong Tukin karena pulang sebelum waktu ganti jam)' : ''}`
                                            : 'Belum Melakukan Presensi Pulang'
                                        }
                                      >
                                        P: {d.jam_pulang ? d.jam_pulang.substring(0, 5) : '--:--'}
                                      </div>
                                    </div>
                                  ) : d.isNonWorkingDay ? (
                                    <span className="inline-block text-[10px] font-medium text-slate-400 bg-slate-100/90 px-1.5 py-0.5 rounded min-w-[55px]">
                                      Libur
                                    </span>
                                  ) : d.code === 'CT' || d.code === 'C' ? (
                                    <span className="inline-block text-[10px] font-bold text-teal-800 bg-teal-100 border border-teal-200 px-1.5 py-0.5 rounded min-w-[55px]">
                                      Cuti
                                    </span>
                                  ) : d.code === 'S' ? (
                                    <span className="inline-block text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded min-w-[55px]">
                                      Sakit
                                    </span>
                                  ) : d.code === 'I' ? (
                                    <span className="inline-block text-[10px] font-bold text-purple-800 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded min-w-[55px]">
                                      Izin
                                    </span>
                                  ) : d.code === 'DD' ? (
                                    <span className="inline-block text-[10px] font-bold text-indigo-800 bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded min-w-[55px]">
                                      Dinas Dlm
                                    </span>
                                  ) : d.code === 'DL' ? (
                                    <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-100 border border-cyan-200 px-1.5 py-0.5 rounded min-w-[55px]">
                                      Dinas Luar
                                    </span>
                                  ) : d.code === 'WFH' ? (
                                    <span className="inline-block text-[10px] font-bold text-purple-800 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded min-w-[55px]">
                                      WFH
                                    </span>
                                  ) : d.code === 'TB' ? (
                                    <span className="inline-block text-[10px] font-bold text-fuchsia-800 bg-fuchsia-100 border border-fuchsia-200 px-1.5 py-0.5 rounded min-w-[55px]">
                                      Tgs Belajar
                                    </span>
                                  ) : d.code === 'K/P' ? (
                                    <span className="inline-block text-[10px] font-bold text-sky-800 bg-sky-100 border border-sky-200 px-1.5 py-0.5 rounded min-w-[55px]">
                                      Pelatihan
                                    </span>
                                  ) : d.code === 'PSW' ? (
                                    <span className="inline-block text-[10px] font-bold text-orange-800 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded min-w-[55px]">
                                      PSW
                                    </span>
                                  ) : d.code === 'TK' || d.code === 'A' ? (
                                    <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded min-w-[55px]">
                                      Tanpa Ket.
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 font-mono text-[11px]">-</span>
                                  )}
                                </td>
                              );
                            }

                            // Mode 'CODES': Tampilan Kode Singkat
                            let bgClass = 'bg-white';
                            let displayCode = d.code;

                            if (d.code === 'H') {
                              bgClass = 'bg-emerald-600 text-white font-bold';
                            } else if (d.code === 'TL') {
                              bgClass = 'bg-amber-500 text-white font-bold';
                            } else if (d.code === 'PSW') {
                              bgClass = 'bg-orange-500 text-white font-bold';
                            } else if (d.code === 'DD') {
                              bgClass = 'bg-indigo-600 text-white font-bold';
                            } else if (d.code === 'DL') {
                              bgClass = 'bg-cyan-600 text-white font-bold';
                            } else if (d.code === 'WFH') {
                              bgClass = 'bg-purple-600 text-white font-bold';
                            } else if (d.code === 'CT' || d.code === 'C') {
                              bgClass = 'bg-teal-600 text-white font-bold';
                            } else if (d.code === 'S') {
                              bgClass = 'bg-blue-600 text-white font-bold';
                            } else if (d.code === 'I') {
                              bgClass = 'bg-violet-600 text-white font-bold';
                            } else if (d.code === 'TB') {
                              bgClass = 'bg-fuchsia-700 text-white font-bold';
                            } else if (d.code === 'K/P' || d.code === 'KP') {
                              bgClass = 'bg-sky-700 text-white font-bold';
                            } else if (d.code === 'TK' || d.code === 'A') {
                              bgClass = 'bg-rose-600 text-white font-bold';
                            } else if (d.isNonWorkingDay) {
                              bgClass = 'bg-slate-100 text-slate-400';
                              displayCode = '·';
                            } else {
                              displayCode = '-';
                            }

                            return (
                              <td
                                key={d.day}
                                className={`p-0.5 border-r border-slate-200 text-center text-[10px] font-mono ${
                                  d.isNonWorkingDay ? 'bg-slate-100/60' : ''
                                }`}
                                title={`Tgl ${d.day}: ${d.keterangan || displayCode}`}
                              >
                                <span
                                  className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] ${bgClass}`}
                                >
                                  {displayCode}
                                </span>
                              </td>
                            );
                          })}

                          {/* Summary Columns (13 Kolom) */}
                          <td className="p-1 font-bold text-emerald-800 bg-emerald-50/50 border-r border-slate-200">
                            {s.H || 0}
                          </td>
                          <td className="p-1 font-bold text-amber-800 bg-amber-50/50 border-r border-slate-200">
                            {s.TL || 0}
                          </td>
                          <td className="p-1 font-bold text-orange-800 bg-orange-50/50 border-r border-slate-200">
                            {s.PSW || 0}
                          </td>
                          <td className="p-1 font-bold text-indigo-800 bg-indigo-50/50 border-r border-slate-200">
                            {s.DD || 0}
                          </td>
                          <td className="p-1 font-bold text-cyan-800 bg-cyan-50/50 border-r border-slate-200">
                            {s.DL || 0}
                          </td>
                          <td className="p-1 font-bold text-purple-800 bg-purple-50/50 border-r border-slate-200">
                            {s.WFH || 0}
                          </td>
                          <td className="p-1 font-bold text-teal-800 bg-teal-50/50 border-r border-slate-200">
                            {s.CT !== undefined ? s.CT : (s.C || 0)}
                          </td>
                          <td className="p-1 font-bold text-blue-800 bg-blue-50/50 border-r border-slate-200">
                            {s.S || 0}
                          </td>
                          <td className="p-1 font-bold text-violet-800 bg-violet-50/50 border-r border-slate-200">
                            {s.I || 0}
                          </td>
                          <td className="p-1 font-bold text-fuchsia-800 bg-fuchsia-50/50 border-r border-slate-200">
                            {s.TB || 0}
                          </td>
                          <td className="p-1 font-bold text-sky-800 bg-sky-50/50 border-r border-slate-200">
                            {s.KP !== undefined ? s.KP : 0}
                          </td>
                          <td className="p-1 font-bold text-rose-800 bg-rose-50/50 border-r border-slate-200">
                            {s.TK !== undefined ? s.TK : (s.A || 0)}
                          </td>
                          <td className="p-1 font-bold text-slate-900 bg-slate-100/80 font-mono">
                            {s.persentase || '0%'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO VIEWER MODAL */}
      {photoModal && (
        <Modal
          isOpen={true}
          onClose={() => setPhotoModal(null)}
          title={photoModal.title}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col items-center">
            <img
              src={photoModal.url}
              alt="Foto absensi"
              className="w-full h-80 object-cover rounded-xl shadow-md border border-slate-200"
            />
            <button
              onClick={() => setPhotoModal(null)}
              className="mt-4 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-900 cursor-pointer"
            >
              Tutup Foto
            </button>
          </div>
        </Modal>
      )}

      {/* DELETE ATTENDANCE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Konfirmasi Hapus Data Absensi"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-red-900">
                  Hapus catatan kehadiran ini?
                </p>
                <p className="text-red-700 leading-relaxed">
                  Data presensi masuk untuk pegawai <strong>{deleteConfirm.nama}</strong> pada tanggal <strong>{deleteConfirm.tanggal}</strong> akan dihapus. Pegawai dapat melakukan absensi ulang.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Pegawai:</span>
                <span className="font-semibold text-slate-900">{deleteConfirm.nama}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NIP / NIK:</span>
                <span className="font-mono text-slate-900">{deleteConfirm.nip}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tanggal:</span>
                <span className="font-medium text-slate-900">{deleteConfirm.tanggal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jam Masuk Tercatat:</span>
                <span className="font-mono font-bold text-slate-900">{deleteConfirm.jamMasuk || '-'} WIB</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteAttendance}
                disabled={isDeleting}
                className="px-4 py-2 font-bold text-white bg-red-700 hover:bg-red-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Presensi'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL CETAK & PRATINJAU PDF REKAPITULASI DAFTAR HADIR (JAM MASUK & PULANG) */}
      {showPrintModal && matrixData && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
          {/* Action Bar (Hanya tampil di layar, tersembunyi saat dicetak) */}
          <div className="w-full max-w-7xl mx-auto mb-4 bg-white p-4 rounded-2xl shadow-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Pratinjau Cetak / PDF Rekapitulasi Daftar Hadir Bulanan
              </h3>
              <p className="text-xs text-slate-500">
                Bulan: {matrixData.monthName} {matrixData.year} • Menampilkan Jam Masuk & Jam Pulang (Urutan Sesuai Excel Upload Asli)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-print-action"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak / Simpan ke PDF</span>
              </button>
              <button
                type="button"
                id="btn-download-pdf-action"
                onClick={downloadMatrixPdfDirect}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File .PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Tutup Pratinjau"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lembar Dokumen Siap Cetak (#printable-rekap-matrix) */}
          <div className="w-full max-w-7xl mx-auto bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 overflow-x-auto print:shadow-none print:border-none print:p-0 print:max-w-none">
            <div id="printable-rekap-matrix" className="bg-white text-black min-w-[1000px] p-2">
              {/* Kop Surat KPU */}
              <div className="flex items-center justify-center gap-4 border-b-2 border-slate-800 pb-3 mb-4">
                <img
                  src="https://www.kpu.go.id/images/1627539868logo-kpu.png"
                  alt="Logo KPU"
                  className="w-16 h-16 object-contain shrink-0"
                />
                <div className="text-center">
                  <h1 className="text-base font-bold uppercase tracking-wider text-slate-900">
                    KOMISI PEMILIHAN UMUM KOTA SUNGAI PENUH
                  </h1>
                  <h2 className="text-sm font-bold uppercase text-slate-800 mt-0.5">
                    REKAPITULASI DAFTAR HADIR BULANAN (JAM MASUK & JAM PULANG)
                  </h2>
                  <div className="text-xs font-medium text-slate-600 mt-1">
                    BULAN: {matrixData.monthName?.toUpperCase()} {matrixData.year} • Tanggal Cetak: {new Date().toLocaleDateString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Tabel Matrix Cetak */}
              <table className="w-full border-collapse border border-slate-400 text-center text-[10px]">
                <thead>
                  {/* Header Baris 1: No, Nama Pegawai, NIP, [BULAN 1-31 MERGED], Rekapitulasi */}
                  <tr className="bg-slate-100 text-slate-900">
                    <th rowSpan={2} className="border border-slate-400 px-1 py-1 font-bold w-7">
                      No
                    </th>
                    <th rowSpan={2} className="border border-slate-400 px-2 py-1 font-bold text-left min-w-[150px]">
                      Nama Pegawai
                    </th>
                    <th rowSpan={2} className="border border-slate-400 px-1 py-1 font-bold text-left min-w-[110px]">
                      NIP
                    </th>
                    <th
                      colSpan={matrixData.daysMeta?.length || 31}
                      className="border border-slate-400 px-2 py-1 font-bold bg-slate-200 text-slate-900 uppercase"
                    >
                      BULAN: {matrixData.monthName?.toUpperCase()} {matrixData.year}
                    </th>
                    <th colSpan={13} className="border border-slate-400 px-1 py-1 font-bold bg-slate-200 text-slate-900">
                      REKAPITULASI
                    </th>
                  </tr>

                  {/* Header Baris 2: Nomor Tanggal 1 s/d 31 & Kolom Ringkasan */}
                  <tr className="bg-slate-50 text-slate-800">
                    {matrixData.daysMeta?.map((d: any) => {
                      const dayName = d.dayOfWeek === 0 ? 'Min' : d.dayOfWeek === 1 ? 'Sen' : d.dayOfWeek === 2 ? 'Sel' : d.dayOfWeek === 3 ? 'Rab' : d.dayOfWeek === 4 ? 'Kam' : d.dayOfWeek === 5 ? 'Jum' : 'Sab';
                      return (
                        <th
                          key={d.day}
                          className={`border border-slate-400 p-0.5 text-center min-w-[34px] ${
                            d.isNonWorkingDay ? 'bg-rose-100/70 font-bold' : ''
                          }`}
                        >
                          <div className="font-bold text-[9px]">{d.day}</div>
                          <div className="text-[7.5px] text-slate-500">{dayName}</div>
                        </th>
                      );
                    })}
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Hadir Tepat Waktu">H</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Terlambat / Lupa Absen Pagi">TL</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Pulang Sebelum Waktu / Lupa Absen Sore">PSW</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Dinas Dalam Daerah">DD</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Dinas Luar Daerah">DL</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Work From Home">WFH</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Cuti">CT</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Sakit">S</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Izin">I</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Tugas Belajar">TB</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Kursus/Pelatihan">K/P</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-4 bg-slate-100" title="Tanpa Keterangan">TK</th>
                    <th className="border border-slate-400 p-0.5 font-bold w-6 bg-slate-100" title="Persentase">%</th>
                  </tr>
                </thead>

                <tbody>
                  {matrixData.rows.map((row: any, idx: number) => {
                    const s = row.summary || {};
                    return (
                      <tr key={row.id} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="border border-slate-300 p-1 font-mono text-center font-bold">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-300 px-1.5 py-1 text-left">
                          <div className="font-bold text-slate-900 leading-tight">
                            {row.nama_lengkap}
                          </div>
                          <div className="text-[8px] text-slate-500">{row.jabatan}</div>
                        </td>
                        <td className="border border-slate-300 px-1 py-1 text-left font-mono text-[9px] text-slate-700">
                          {row.nip_nik}
                        </td>

                        {/* Sel Tanggal 1 s/d 31: Jam Masuk & Jam Pulang */}
                        {row.days.map((d: any) => (
                          <td
                            key={d.day}
                            className={`border border-slate-300 p-0.5 text-center ${
                              d.isNonWorkingDay ? 'bg-slate-100/80' : ''
                            }`}
                          >
                            {d.isNonWorkingDay ? (
                              <span className="text-slate-400 text-[8px] italic">Libur</span>
                            ) : d.jam_masuk ? (
                              <div className="font-mono text-[8px] leading-tight flex flex-col items-center">
                                <span className={d.code === 'TL' ? 'text-amber-900 font-bold' : 'text-emerald-900 font-bold'}>
                                  M:{d.jam_masuk.substring(0, 5)}
                                </span>
                                <span className="text-blue-900 font-semibold">
                                  P:{d.jam_pulang ? d.jam_pulang.substring(0, 5) : '--:--'}
                                </span>
                              </div>
                            ) : d.code === 'CT' || d.code === 'C' ? (
                              <span className="font-bold text-teal-800 text-[8px]">CT</span>
                            ) : d.code === 'S' ? (
                              <span className="font-bold text-blue-800 text-[8px]">S</span>
                            ) : d.code === 'I' ? (
                              <span className="font-bold text-purple-800 text-[8px]">I</span>
                            ) : d.code === 'DD' ? (
                              <span className="font-bold text-indigo-800 text-[8px]">DD</span>
                            ) : d.code === 'DL' ? (
                              <span className="font-bold text-cyan-800 text-[8px]">DL</span>
                            ) : d.code === 'WFH' ? (
                              <span className="font-bold text-purple-800 text-[8px]">WFH</span>
                            ) : d.code === 'TB' ? (
                              <span className="font-bold text-fuchsia-800 text-[8px]">TB</span>
                            ) : d.code === 'K/P' || d.code === 'KP' ? (
                              <span className="font-bold text-sky-800 text-[8px]">K/P</span>
                            ) : d.code === 'PSW' ? (
                              <span className="font-bold text-orange-800 text-[8px]">PSW</span>
                            ) : d.code === 'TK' || d.code === 'A' ? (
                              <span className="font-bold text-rose-800 text-[8px]">TK</span>
                            ) : (
                              <span className="text-slate-300 text-[8px]">-</span>
                            )}
                          </td>
                        ))}

                        {/* Summary Columns (13 Kolom) */}
                        <td className="border border-slate-300 p-0.5 font-bold">{s.H || 0}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.TL || 0}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.PSW || 0}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.DD || 0}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.DL || 0}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.WFH || 0}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.CT !== undefined ? s.CT : (s.C || 0)}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.S || 0}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.I || 0}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.TB || 0}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.KP !== undefined ? s.KP : 0}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.TK !== undefined ? s.TK : (s.A || 0)}</td>
                        <td className="border border-slate-300 p-0.5 font-bold">{s.persentase || '0%'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Keterangan Singkat & Tanda Tangan Resmi */}
              <div className="mt-4 flex flex-col sm:flex-row items-start justify-between gap-6 text-[10px]">
                <div className="text-slate-600 max-w-md">
                  <div className="font-bold text-slate-800 mb-1">Keterangan:</div>
                  <p>
                    • <strong>M</strong>: Jam Masuk/Datang | <strong>P</strong>: Jam Pulang
                  </p>
                  <p>
                    • <strong>TK</strong>: Tanpa Keterangan | <strong>S</strong>: Sakit | <strong>I</strong>: Izin | <strong>TL</strong>: Terlambat/Lupa Absen Pagi | <strong>PSW</strong>: Pulang Sebelum Waktu/Lupa Absen Sore | <strong>DD</strong>: Dinas Dalam Daerah | <strong>DL</strong>: Dinas Luar Daerah | <strong>CT</strong>: Cuti | <strong>TB</strong>: Tugas Belajar | <strong>K/P</strong>: Kursus/Pelatihan | <strong>WFH</strong>: Work From Home
                  </p>
                  <p className="mt-1 text-slate-500">
                    Total Pegawai: {matrixData.rows.length} orang (Urutan data sesuai Excel upload asli).
                  </p>
                </div>

                <div className="text-center min-w-[240px]">
                  <p>Sungai Penuh, {new Date().toLocaleDateString('id-ID')}</p>
                  <p className="font-bold mt-1">Sekretaris Komisi Pemilihan Umum Kota Sungai Penuh</p>
                  <div className="h-16"></div>
                  <p className="font-bold border-b border-slate-400 inline-block px-4 pb-0.5">
                    Hj. Dewi Aprida S.E., M.Si.
                  </p>
                  <p className="text-slate-600 mt-0.5">NIP. .................................................</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Attendance Modal */}
      <ManualAttendanceModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSuccess={() => {
          fetchRekap();
          fetchMatrix();
        }}
      />
    </div>
  );
};

