import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import {
  Printer,
  Download,
  X,
  Filter,
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  FileText
} from 'lucide-react';
import { api } from '../../services/api';
import { useSubBagianList } from '../../utils/subBagian';

interface ExportFilteredAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
  defaultSubBagian?: string;
  defaultStatus?: string;
}

export const ExportFilteredAttendanceModal: React.FC<ExportFilteredAttendanceModalProps> = ({
  isOpen,
  onClose,
  defaultDate = new Date().toISOString().split('T')[0],
  defaultSubBagian = 'ALL',
  defaultStatus = 'ALL'
}) => {
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [selectedSubBagian, setSelectedSubBagian] = useState(defaultSubBagian);
  const [selectedStatus, setSelectedStatus] = useState(defaultStatus);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const subBagianList = useSubBagianList();

  useEffect(() => {
    if (defaultDate) setSelectedDate(defaultDate);
    if (defaultSubBagian) setSelectedSubBagian(defaultSubBagian);
    if (defaultStatus) setSelectedStatus(defaultStatus);
  }, [defaultDate, defaultSubBagian, defaultStatus, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.getMonitoringAttendance(selectedDate);
        if (isMounted) {
          setAttendanceData(res);
        }
      } catch (err) {
        console.error('Error fetching attendance for export:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const sudahAbsen: any[] = attendanceData?.sudahAbsen || [];
  const belumAbsen: any[] = attendanceData?.belumAbsen || [];

  // Combine into unified list with status tags
  const combinedList = [
    ...sudahAbsen.map(item => ({
      ...item,
      isAbsen: true,
      displayStatus: item.status === 'Terlambat' || (item.keterlambatan_menit && item.keterlambatan_menit > 0)
        ? 'Terlambat'
        : item.status || 'Hadir'
    })),
    ...belumAbsen.map(item => ({
      ...item,
      isAbsen: false,
      displayStatus: 'Belum Presensi',
      jam_masuk: null,
      jam_pulang: null,
      metode_kerja: item.assigned_method || 'WFO'
    }))
  ];

  // Apply filters
  const filteredList = combinedList.filter(item => {
    // 1. Sub Bagian Filter
    if (selectedSubBagian !== 'ALL') {
      const sub = item.sub_bagian || item.unit_kerja;
      if (sub !== selectedSubBagian) return false;
    }

    // 2. Status Filter
    if (selectedStatus !== 'ALL') {
      if (selectedStatus === 'Hadir' && item.displayStatus !== 'Hadir') return false;
      if (selectedStatus === 'Terlambat' && item.displayStatus !== 'Terlambat') return false;
      if (selectedStatus === 'Belum Presensi' && item.isAbsen) return false;
      if (selectedStatus === 'WFH' && item.metode_kerja !== 'WFH') return false;
      if (selectedStatus === 'WFA' && item.metode_kerja !== 'WFA') return false;
      if (selectedStatus === 'Luar Radius' && (!item.is_emergency && item.is_inside_radius !== false)) return false;
    }

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nama = item.nama_lengkap?.toLowerCase() || '';
      const nip = item.nip_nik?.toLowerCase() || '';
      return nama.includes(q) || nip.includes(q);
    }

    return true;
  });

  // Calculate summary counts from filtered list
  const totalFiltered = filteredList.length;
  const countHadir = filteredList.filter(i => i.displayStatus === 'Hadir').length;
  const countTerlambat = filteredList.filter(i => i.displayStatus === 'Terlambat').length;
  const countBelum = filteredList.filter(i => !i.isAbsen).length;
  const countWfo = filteredList.filter(i => i.metode_kerja === 'WFO').length;
  const countWfh = filteredList.filter(i => i.metode_kerja === 'WFH').length;
  const countWfa = filteredList.filter(i => i.metode_kerja === 'WFA').length;

  const formattedDateIndo = new Date(selectedDate).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Direct Vector PDF Download using jsPDF
  const downloadPdfDirect = () => {
    if (filteredList.length === 0) {
      alert('Tidak ada data presensi yang terfilter untuk diekspor ke PDF.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Header Kop Surat KPU
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('KOMISI PEMILIHAN UMUM KOTA SUNGAI PENUH', pageWidth / 2, 13, { align: 'center' });

      doc.setFontSize(10);
      doc.text('LAPORAN DAFTAR HADIR DAN STATUS PRESENSI HARIAN PEGAWAI', pageWidth / 2, 18, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Hari / Tanggal: ${formattedDateIndo} | Sub Bagian: ${selectedSubBagian === 'ALL' ? 'Semua Sub Bagian / Unit Kerja' : selectedSubBagian}`, pageWidth / 2, 23, { align: 'center' });

      doc.setLineWidth(0.4);
      doc.line(10, 26, pageWidth - 10, 26);
      doc.setLineWidth(0.15);
      doc.line(10, 26.8, pageWidth - 10, 26.8);

      // Summary Info
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Ringkasan: Total Pegawai: ${totalFiltered} | Hadir Tepat Waktu: ${countHadir} | Terlambat: ${countTerlambat} | Belum Presensi: ${countBelum} | WFO: ${countWfo} | WFH/WFA: ${countWfh + countWfa}`,
        10,
        31
      );

      // Table Header Positions
      const startY = 35;
      const colX = {
        no: 10,
        nama: 18,
        nip: 70,
        sub: 105,
        masuk: 155,
        pulang: 175,
        metode: 195,
        status: 215,
        ket: 245
      };

      // Table Header Background
      doc.setFillColor(240, 243, 246);
      doc.rect(10, startY, pageWidth - 20, 7, 'F');
      doc.setDrawColor(180, 185, 190);
      doc.rect(10, startY, pageWidth - 20, 7, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);

      doc.text('NO', colX.no + 1, startY + 4.5);
      doc.text('NAMA PEGAWAI', colX.nama, startY + 4.5);
      doc.text('NIP / NIK', colX.nip, startY + 4.5);
      doc.text('SUB BAGIAN / JABATAN', colX.sub, startY + 4.5);
      doc.text('JAM MASUK', colX.masuk, startY + 4.5);
      doc.text('JAM PULANG', colX.pulang, startY + 4.5);
      doc.text('METODE', colX.metode, startY + 4.5);
      doc.text('STATUS PRESENSI', colX.status, startY + 4.5);
      doc.text('KETERANGAN', colX.ket, startY + 4.5);

      let currentY = startY + 7;
      const rowHeight = 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);

      filteredList.forEach((emp, index) => {
        // Page break if needed
        if (currentY + rowHeight > pageHeight - 25) {
          doc.addPage();
          currentY = 15;
          // Re-draw table header on new page
          doc.setFillColor(240, 243, 246);
          doc.rect(10, currentY, pageWidth - 20, 7, 'F');
          doc.setDrawColor(180, 185, 190);
          doc.rect(10, currentY, pageWidth - 20, 7, 'S');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.text('NO', colX.no + 1, currentY + 4.5);
          doc.text('NAMA PEGAWAI', colX.nama, currentY + 4.5);
          doc.text('NIP / NIK', colX.nip, currentY + 4.5);
          doc.text('SUB BAGIAN / JABATAN', colX.sub, currentY + 4.5);
          doc.text('JAM MASUK', colX.masuk, currentY + 4.5);
          doc.text('JAM PULANG', colX.pulang, currentY + 4.5);
          doc.text('METODE', colX.metode, currentY + 4.5);
          doc.text('STATUS PRESENSI', colX.status, currentY + 4.5);
          doc.text('KETERANGAN', colX.ket, currentY + 4.5);
          currentY += 7;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
        }

        // Alternating background
        if (index % 2 === 1) {
          doc.setFillColor(250, 250, 252);
          doc.rect(10, currentY, pageWidth - 20, rowHeight, 'F');
        }
        doc.setDrawColor(220, 225, 230);
        doc.rect(10, currentY, pageWidth - 20, rowHeight, 'S');

        const noStr = String(index + 1);
        const namaStr = (emp.nama_lengkap || '-').substring(0, 30);
        const nipStr = (emp.nip_nik || '-').substring(0, 20);
        const subStr = (emp.sub_bagian || emp.unit_kerja || '-').substring(0, 26);
        const jamInStr = emp.jam_masuk ? `${emp.jam_masuk} WIB` : '-';
        const jamOutStr = emp.jam_pulang ? `${emp.jam_pulang} WIB` : '-';
        const metodeStr = emp.metode_kerja || 'WFO';

        let statusStr = emp.displayStatus;
        if (emp.displayStatus === 'Terlambat' && emp.keterlambatan_menit) {
          statusStr = `Terlambat (${emp.keterlambatan_menit}m)`;
        }

        let ketStr = emp.is_emergency ? 'Luar Radius' : emp.is_inside_radius === false ? 'Luar Radius' : 'Dalam Radius';
        if (!emp.isAbsen) ketStr = 'Belum Check-In';

        doc.text(noStr, colX.no + 1, currentY + 4);
        doc.text(namaStr, colX.nama, currentY + 4);
        doc.text(nipStr, colX.nip, currentY + 4);
        doc.text(subStr, colX.sub, currentY + 4);
        doc.text(jamInStr, colX.masuk, currentY + 4);
        doc.text(jamOutStr, colX.pulang, currentY + 4);
        doc.text(metodeStr, colX.metode, currentY + 4);
        doc.text(statusStr, colX.status, currentY + 4);
        doc.text(ketStr, colX.ket, currentY + 4);

        currentY += rowHeight;
      });

      // Signature Block at the bottom
      if (currentY + 28 > pageHeight - 10) {
        doc.addPage();
        currentY = 20;
      } else {
        currentY += 8;
      }

      const sigY = currentY;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');

      // Left Column
      doc.text('Mengetahui,', 25, sigY);
      doc.setFont('helvetica', 'bold');
      doc.text('Sekretaris KPU Kota Sungai Penuh', 25, sigY + 4);
      doc.setFont('helvetica', 'normal');
      doc.text('( ........................................................... )', 25, sigY + 18);
      doc.text('NIP. ....................................................', 25, sigY + 22);

      // Right Column
      doc.text(`Sungai Penuh, ${new Date().toLocaleDateString('id-ID')}`, pageWidth - 90, sigY);
      doc.setFont('helvetica', 'bold');
      doc.text('Pengelola Kepegawaian / Kasubbag Hukum & SDM', pageWidth - 90, sigY + 4);
      doc.setFont('helvetica', 'normal');
      doc.text('( ........................................................... )', pageWidth - 90, sigY + 18);
      doc.text('NIP. ....................................................', pageWidth - 90, sigY + 22);

      const fileName = `Laporan_Presensi_KPU_${selectedDate}_${selectedSubBagian !== 'ALL' ? selectedSubBagian.replace(/\s+/g, '_') : 'Semua'}.pdf`;
      doc.save(fileName);
    } catch (err: any) {
      console.error('Gagal membuat berkas PDF:', err);
      alert(`Gagal membuat berkas PDF: ${err.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto print:p-0 print:bg-white print:static print-modal-overlay">
      {/* Action Bar (Visible on screen, hidden on print) */}
      <div className="w-full max-w-7xl mx-auto mb-3 bg-white p-4 rounded-2xl shadow-xl border border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>Ekspor & Cetak Laporan Presensi Pegawai</span>
              <span className="text-[10px] bg-teal-100 text-teal-900 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                PDF Siap Cetak
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Dokumen resmi daftar hadir harian KPU Kota Sungai Penuh dengan format kop surat standar
            </p>
          </div>
        </div>

        {/* Filter Controls within Modal */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tanggal Picker */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-hidden text-xs"
            />
          </div>

          {/* Sub Bagian Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedSubBagian}
              onChange={e => setSelectedSubBagian(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-hidden text-xs max-w-[150px] truncate"
            >
              <option value="ALL">Semua Sub Bagian</option>
              {subBagianList.map((sub, i) => (
                <option key={i} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Status Kehadiran Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-hidden text-xs"
            >
              <option value="ALL">Semua Status</option>
              <option value="Hadir">Hadir Tepat Waktu</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Belum Presensi">Belum Presensi</option>
              <option value="WFH">WFH (Rumah)</option>
              <option value="WFA">WFA (Lapangan)</option>
              <option value="Luar Radius">Luar Radius</option>
            </select>
          </div>

          {/* Buttons: Cetak & Download PDF */}
          <button
            type="button"
            id="btn-print-filtered-attendance"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Cetak dokumen atau Simpan ke PDF via Peramban"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Print PDF</span>
          </button>

          <button
            type="button"
            id="btn-download-filtered-pdf"
            onClick={downloadPdfDirect}
            disabled={isGeneratingPdf || loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Unduh berkas .PDF langsung"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingPdf ? 'Membuat PDF...' : 'Unduh Berkas .PDF'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dokumen Siap Cetak (#printable-filtered-attendance) */}
      <div className="w-full max-w-7xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-slate-200 overflow-x-auto print:shadow-none print:border-none print:p-0 print:max-w-none print-area">
        <div id="printable-filtered-attendance" className="bg-white text-slate-900 min-w-[950px] p-2">
          {/* Kop Surat Resmi KPU */}
          <div className="flex items-center justify-center gap-4 border-b-2 border-slate-900 pb-3 mb-4">
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
                LAPORAN DAFTAR HADIR DAN STATUS PRESENSI HARIAN PEGAWAI
              </h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Jl. Jend. Sudirman No. 12, Kota Sungai Penuh, Jambi 37111 • Email: kpu.sungaipenuh@kpu.go.id
              </p>
            </div>
          </div>

          {/* Informasi Meta Dokumen & Filter */}
          <div className="grid grid-cols-2 gap-4 text-xs mb-4 bg-slate-50/80 p-3 rounded-xl border border-slate-200 print:bg-transparent print:p-0 print:border-none">
            <div className="space-y-1">
              <div>
                <span className="text-slate-500">Hari / Tanggal: </span>
                <strong className="text-slate-900 font-bold">{formattedDateIndo}</strong>
              </div>
              <div>
                <span className="text-slate-500">Unit / Sub Bagian: </span>
                <strong className="text-slate-900">
                  {selectedSubBagian === 'ALL' ? 'Semua Sub Bagian / Unit Kerja' : selectedSubBagian}
                </strong>
              </div>
            </div>

            <div className="space-y-1 text-right print:text-right">
              <div>
                <span className="text-slate-500">Status Filter: </span>
                <strong className="text-slate-900">
                  {selectedStatus === 'ALL' ? 'Semua Status' : selectedStatus}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Waktu Cetak: </span>
                <span className="text-slate-700 font-mono">
                  {new Date().toLocaleDateString('id-ID')} pukul {new Date().toLocaleTimeString('id-ID')} WIB
                </span>
              </div>
            </div>
          </div>

          {/* Ringkasan Kehadiran */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4 text-center">
            <div className="p-2 bg-slate-100 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-600 block uppercase font-bold">Total Terdata</span>
              <span className="text-sm font-black text-slate-900 font-mono">{totalFiltered}</span>
            </div>
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-[10px] text-emerald-800 block uppercase font-bold">Tepat Waktu</span>
              <span className="text-sm font-black text-emerald-900 font-mono">{countHadir}</span>
            </div>
            <div className="p-2 bg-amber-50 rounded-xl border border-amber-200">
              <span className="text-[10px] text-amber-800 block uppercase font-bold">Terlambat</span>
              <span className="text-sm font-black text-amber-900 font-mono">{countTerlambat}</span>
            </div>
            <div className="p-2 bg-rose-50 rounded-xl border border-rose-200">
              <span className="text-[10px] text-rose-800 block uppercase font-bold">Belum Absen / TK</span>
              <span className="text-sm font-black text-rose-900 font-mono">{countBelum}</span>
            </div>
            <div className="p-2 bg-sky-50 rounded-xl border border-sky-200">
              <span className="text-[10px] text-sky-800 block uppercase font-bold">WFO / WFH / WFA</span>
              <span className="text-sm font-black text-sky-900 font-mono">{countWfo} / {countWfh} / {countWfa}</span>
            </div>
          </div>

          {/* Tabel Presensi Resmi */}
          <div className="overflow-x-auto border border-slate-300 rounded-xl">
            <table className="w-full text-[11px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-300 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-2 border-r border-slate-300 text-center w-8">No</th>
                  <th className="py-2.5 px-3 border-r border-slate-300">Nama Pegawai</th>
                  <th className="py-2.5 px-3 border-r border-slate-300">NIP / NIK</th>
                  <th className="py-2.5 px-3 border-r border-slate-300">Sub Bagian / Unit Kerja</th>
                  <th className="py-2.5 px-2 border-r border-slate-300 text-center">Jam Masuk</th>
                  <th className="py-2.5 px-2 border-r border-slate-300 text-center">Jam Pulang</th>
                  <th className="py-2.5 px-2 border-r border-slate-300 text-center">Metode</th>
                  <th className="py-2.5 px-2.5 border-r border-slate-300">Status Presensi</th>
                  <th className="py-2.5 px-2.5">Keterangan / Lokasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-normal">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      Memuat data presensi terfilter...
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      Tidak ditemukan data presensi yang sesuai dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((emp, idx) => (
                    <tr key={emp.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-mono text-[10px] text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-900">
                        {emp.nama_lengkap || '-'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono text-slate-700 text-[10px]">
                        {emp.nip_nik || '-'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-700 text-[10.5px]">
                        {emp.sub_bagian || emp.unit_kerja || '-'}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-mono font-semibold">
                        {emp.jam_masuk ? (
                          <span className="text-emerald-800">{emp.jam_masuk} WIB</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-mono font-semibold">
                        {emp.jam_pulang ? (
                          <span className="text-teal-800">{emp.jam_pulang} WIB</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-200 text-center font-bold text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded ${
                          emp.metode_kerja === 'WFH'
                            ? 'bg-sky-100 text-sky-800'
                            : emp.metode_kerja === 'WFA'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {emp.metode_kerja || 'WFO'}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-200 text-[10.5px] font-semibold">
                        {emp.displayStatus === 'Hadir' ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 print:hidden" /> Tepat Waktu
                          </span>
                        ) : emp.displayStatus === 'Terlambat' ? (
                          <span className="text-amber-700 flex items-center gap-1 font-bold">
                            <Clock className="w-3 h-3 text-amber-600 print:hidden" /> Terlambat ({emp.keterlambatan_menit || 0} mnt)
                          </span>
                        ) : (
                          <span className="text-rose-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-500 print:hidden" /> Belum Presensi
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-[10px] text-slate-600">
                        {emp.is_emergency ? (
                          <span className="font-bold text-amber-800">
                            Luar Radius {emp.emergency_reason ? `(${emp.emergency_reason})` : ''}
                          </span>
                        ) : emp.is_inside_radius === false ? (
                          <span className="text-amber-700">Luar Radius</span>
                        ) : emp.isAbsen ? (
                          <span className="text-slate-600">Kantor KPU ({emp.distance_meters ? `${emp.distance_meters}m` : 'Radius Normal'})</span>
                        ) : (
                          <span className="text-slate-400">Belum Check-In</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Kolom Tanda Tangan Resmi Pengesahan */}
          <div className="mt-8 pt-4 flex items-start justify-between text-xs text-slate-900 border-t border-slate-300">
            <div className="text-center w-64 space-y-1">
              <span>Mengetahui,</span>
              <p className="font-bold text-slate-900">Sekretaris KPU Kota Sungai Penuh</p>
              <div className="h-16" />
              <p className="font-bold text-slate-900 underline">( ........................................................... )</p>
              <p className="text-[10px] text-slate-600">NIP. ....................................................</p>
            </div>

            <div className="text-center w-64 space-y-1">
              <span>Sungai Penuh, {new Date().toLocaleDateString('id-ID')}</span>
              <p className="font-bold text-slate-900">Pengelola Kepegawaian / Kasubbag Hukum & SDM</p>
              <div className="h-16" />
              <p className="font-bold text-slate-900 underline">( ........................................................... )</p>
              <p className="text-[10px] text-slate-600">NIP. ....................................................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
