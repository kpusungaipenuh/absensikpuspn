import React from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

interface ExportButtonsProps {
  title: string;
  filename: string;
  columns: { header: string; key: string }[];
  data: any[];
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  title,
  filename,
  columns,
  data
}) => {
  const exportExcel = () => {
    if (!data || data.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const exportRows = data.map((item, index) => {
      const row: Record<string, any> = { 'No': index + 1 };
      columns.forEach(col => {
        row[col.header] = item[col.key] !== undefined && item[col.key] !== null ? item[col.key] : '-';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    
    // Add header rows
    XLSX.utils.sheet_add_aoa(worksheet, [
      ['KOMISI PEMILIHAN UMUM KOTA SUNGAI PENUH'],
      [title.toUpperCase()],
      [`Tanggal Generate: ${new Date().toLocaleString('id-ID')}`],
      [''] // empty line
    ], { origin: 'A1' });

    // Re-add json below header
    XLSX.utils.sheet_add_json(worksheet, exportRows, { origin: 'A5' });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Rekap');
    XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportPDF = () => {
    if (!data || data.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const doc = new jsPDF({
      orientation: columns.length > 6 ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const now = new Date().toLocaleString('id-ID');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Official Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('KOMISI PEMILIHAN UMUM KOTA SUNGAI PENUH', pageWidth / 2, 16, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Jl. Jend. Sudirman No. 45, Kota Sungai Penuh, Jambi 37111', pageWidth / 2, 22, { align: 'center' });
    doc.text(title, pageWidth / 2, 30, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(14, 34, pageWidth - 14, 34);

    doc.setFontSize(8);
    doc.text(`Waktu Cetak: ${now}`, 14, 40);

    // Simple robust tabular layout
    let y = 46;
    const colWidth = (pageWidth - 28) / (columns.length + 1);

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y - 5, pageWidth - 28, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);

    doc.text('No', 16, y);
    columns.forEach((col, idx) => {
      const x = 14 + (idx + 1) * colWidth;
      const cleanHeader = col.header.length > 18 ? col.header.substring(0, 16) + '..' : col.header;
      doc.text(cleanHeader, x, y);
    });

    y += 6;
    doc.setFont('helvetica', 'normal');

    // Data rows
    data.forEach((item, index) => {
      if (y > doc.internal.pageSize.getHeight() - 25) {
        doc.addPage();
        y = 20;
      }

      doc.text(String(index + 1), 16, y);
      columns.forEach((col, idx) => {
        const x = 14 + (idx + 1) * colWidth;
        const val = item[col.key] !== undefined && item[col.key] !== null ? String(item[col.key]) : '-';
        const truncated = val.length > 22 ? val.substring(0, 20) + '..' : val;
        doc.text(truncated, x, y);
      });

      y += 6;
    });

    // Footer signature
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 20;
    }
    const sigX = pageWidth - 70;
    y += 10;
    doc.setFontSize(8);
    doc.text('Kota Sungai Penuh, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), sigX, y);
    y += 5;
    doc.text('Sekretaris KPU Kota Sungai Penuh,', sigX, y);
    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.text('Hj. Dewi Aprida, S.E., M.Si.', sigX, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text('NIP. .....................................................', sigX, y);

    doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        id="btn-export-excel"
        onClick={exportExcel}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-xs"
        title="Ekspor ke format Microsoft Excel (.xlsx)"
      >
        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        <span>Export Excel</span>
      </button>

      <button
        id="btn-export-pdf"
        onClick={exportPDF}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-xs"
        title="Ekspor ke format PDF dokumen resmi"
      >
        <FileText className="w-4 h-4 text-rose-600" />
        <span>Export PDF</span>
      </button>
    </div>
  );
};
