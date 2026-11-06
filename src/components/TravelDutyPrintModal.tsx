import React, { useState } from 'react';
import { Printer, X, FileText, ChevronDown, ChevronUp, Edit3, ShieldCheck, ExternalLink } from 'lucide-react';
import { TravelDuty, Employee } from '../types';
import { printElementById, openPrintInNewTab } from '../utils/printHelper';

interface TravelDutyPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  duty: TravelDuty;
  employeesList?: Employee[];
}

export const TravelDutyPrintModal: React.FC<TravelDutyPrintModalProps> = ({
  isOpen,
  onClose,
  duty,
  employeesList = []
}) => {
  const [activeDoc, setActiveDoc] = useState<'spt' | 'sppd_lembar1' | 'sppd_visum' | 'all'>('spt');
  const [showConfig, setShowConfig] = useState(false);

  // Indonesian date formatter
  const formatDateIndo = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const currentYear = new Date().getFullYear();

  // Extract duty fields
  const noSptRaw = duty.nomor_surat_tugas || '092';
  const cleanNoSpt = noSptRaw.replace(/[^0-9]/g, '').slice(0, 4) || '092';

  // Customizable state
  const [noSpt, setNoSpt] = useState(cleanNoSpt);
  const [nomorSppd, setNomorSppd] = useState(duty.nomor_sppd || `092/SPD/KPU-SPN/${currentYear}`);
  const [tanggalSurat, setTanggalSurat] = useState(formatDateIndo(duty.tanggal_berangkat || duty.created_at));
  const [maksudTugas, setMaksudTugas] = useState(duty.maksud_tujuan || 'Pelaksanaan Tugas Kedinasan');
  const [tempatBerangkat, setTempatBerangkat] = useState(duty.tempat_berangkat || 'Sungai Penuh');
  const [tempatTujuan, setTempatTujuan] = useState(duty.tempat_tujuan || 'Jambi');
  const [alatAngkut, setAlatAngkut] = useState(duty.alat_angkut || 'Kendaraan Dinas / Darat');
  const [bebanAnggaran, setBebanAnggaran] = useState(duty.beban_anggaran || `DIPA KPU Kota Sungai Penuh T.A. ${currentYear}`);
  const [akunAnggaran, setAkunAnggaran] = useState('524111 (Belanja Perjalanan Dinas Biasa)');

  // Menimbang 1 & 2
  const [menimbang1, setMenimbang1] = useState(
    'Rencana Kegiatan Tahapan Pemilu dan Agenda Rapat Koordinasi Tingkat Provinsi/Pusat'
  );
  const [menimbang2, setMenimbang2] = useState(
    'Telah disetujui dalam rencana kerja dan alokasi anggaran DIPA Komisi Pemilihan Umum Kota Sungai Penuh'
  );

  // Penandatangan SPT
  const [penandatanganSpt, setPenandatanganSpt] = useState<'ketua' | 'sekretaris'>('sekretaris');
  const [namaKetua, setNamaKetua] = useState('Edison, SE');
  const [namaSekretaris, setNamaSekretaris] = useState('Hj. Dewi Aprida, SE, M.Si');
  const [nipSekretaris, setNipSekretaris] = useState('19701005 200701 2 003');

  // Selected personil for SPPD (if multiple, choose primary personil or all)
  const assigned = duty.assigned_employees || [];
  const primaryEmp = assigned[0];
  const [selectedEmpIndex, setSelectedEmpIndex] = useState(0);

  if (!isOpen) return null;

  const currentEmp = assigned[selectedEmpIndex] || primaryEmp || {
    id: 'emp_1',
    nama_lengkap: 'Nama Pegawai',
    nip_nik: '-',
    jabatan: 'Staf Pelaksana',
    peran: 'Ketua Tim'
  };

  const lamaHari = duty.lama_hari || 1;
  const tglBerangkatIndo = formatDateIndo(duty.tanggal_berangkat);
  const tglKembaliIndo = formatDateIndo(duty.tanggal_kembali);

  const handlePrint = () => {
    printElementById('printable-travel-duty', `SPT_SPPD_${(duty.nomor_surat_tugas || 'Tugas').replace(/[/\\?%*:|"<>]/g, '_')}`);
  };

  const handleOpenTab = () => {
    openPrintInNewTab('printable-travel-duty', `SPT_SPPD_${(duty.nomor_surat_tugas || 'Tugas').replace(/[/\\?%*:|"<>]/g, '_')}`);
  };

  return (
    <div className="print-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
      <div className="print-modal-container relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header Modal (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Penerbitan Surat Perintah Tugas (SPT) & SPPD Resmi KPU
              </h3>
              <p className="text-[11px] text-slate-500">
                Nomor: {duty.nomor_surat_tugas} &bull; KPU Kota Sungai Penuh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Sesuaikan Data</span>
              {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleOpenTab}
              title="Buka dokumen di tab baru untuk cetak tanpa batasan iframe"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Tab Baru</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection (Hidden in Print) */}
        <div className="no-print flex items-center justify-between px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveDoc('spt')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeDoc === 'spt'
                  ? 'bg-white text-red-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1. Surat Perintah Tugas (SPT)
            </button>
            <button
              onClick={() => setActiveDoc('sppd_lembar1')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeDoc === 'sppd_lembar1'
                  ? 'bg-white text-red-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2. SPPD (Lembar 1)
            </button>
            <button
              onClick={() => setActiveDoc('sppd_visum')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeDoc === 'sppd_visum'
                  ? 'bg-white text-red-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3. Lembar Visum (Lembar 2)
            </button>
            <button
              onClick={() => setActiveDoc('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeDoc === 'all'
                  ? 'bg-white text-red-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              4. Cetak Semua Dokumen
            </button>
          </div>

          {assigned.length > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500">Pegawai SPPD:</span>
              <select
                value={selectedEmpIndex}
                onChange={e => setSelectedEmpIndex(Number(e.target.value))}
                className="p-1 bg-white border border-slate-300 rounded text-xs"
              >
                {assigned.map((e, idx) => (
                  <option key={idx} value={idx}>
                    {e.nama_lengkap} ({e.peran || 'Personil'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Configuration Panel (Hidden in Print) */}
        {showConfig && (
          <div className="no-print p-4 bg-amber-50/70 border-b border-amber-200 text-xs space-y-3">
            <div className="font-bold text-amber-900 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-amber-700" />
              <span>Sesuaikan Parameter Dokumen Perjalanan Dinas:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nomor SPT:</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={noSpt}
                    onChange={e => setNoSpt(e.target.value)}
                    className="w-20 p-2 bg-white border border-slate-300 rounded-l-lg text-xs font-mono"
                  />
                  <span className="bg-slate-100 border border-l-0 border-slate-300 p-2 text-slate-600 rounded-r-lg text-[10px]">
                    /RT.02.1-SPt/1572/{currentYear}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nomor SPD / SPPD:</label>
                <input
                  type="text"
                  value={nomorSppd}
                  onChange={e => setNomorSppd(e.target.value)}
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
                <label className="block text-slate-700 font-semibold mb-1">Penandatangan SPT:</label>
                <select
                  value={penandatanganSpt}
                  onChange={e => setPenandatanganSpt(e.target.value as any)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="sekretaris">Sekretaris KPU (Hj. Dewi Aprida, SE, M.Si)</option>
                  <option value="ketua">Ketua KPU Kota Sungai Penuh ({namaKetua})</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Ketua KPU:</label>
                <input
                  type="text"
                  value={namaKetua}
                  onChange={e => setNamaKetua(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mata Anggaran / Akun:</label>
                <input
                  type="text"
                  value={akunAnggaran}
                  onChange={e => setAkunAnggaran(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-slate-700 font-semibold mb-1">Menimbang Butir 1:</label>
                <input
                  type="text"
                  value={menimbang1}
                  onChange={e => setMenimbang1(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-slate-700 font-semibold mb-1">Uraian / Maksud Penugasan:</label>
                <textarea
                  rows={2}
                  value={maksudTugas}
                  onChange={e => setMaksudTugas(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Paper Canvas */}
        <div className="print-modal-scroll flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/60 flex justify-center">
          <div
            id="printable-travel-duty"
            className="print-area w-full max-w-[210mm] bg-white text-slate-900 shadow-md p-8 sm:p-12 font-serif text-[11pt] leading-normal border border-slate-300 print:border-0 print:shadow-none print:p-0"
          >

            {/* DOKUMEN 1: SURAT PERINTAH TUGAS (SPT) */}
            {(activeDoc === 'spt' || activeDoc === 'all') && (
              <div className="space-y-4 print:mb-0 mb-12">
                {/* Kop Surat KPU */}
                <div className="text-center border-b-2 border-double border-slate-900 pb-2 space-y-0.5">
                  <div className="font-bold text-sm tracking-wider uppercase font-sans">
                    KOMISI PEMILIHAN UMUM
                  </div>
                  <div className="font-bold text-base tracking-wider uppercase font-sans">
                    KOTA SUNGAI PENUH
                  </div>
                  <div className="text-[8.5pt] font-sans text-slate-600">
                    Jl. Muradi No. 1, Kota Sungai Penuh, Jambi 37111 &bull; Email: kpu.sungaipenuh@kpu.go.id
                  </div>
                </div>

                {/* Judul Surat Perintah */}
                <div className="text-center pt-2 space-y-0.5">
                  <div className="font-bold text-sm tracking-widest uppercase underline">
                    SURAT PERINTAH
                  </div>
                  <div className="text-xs font-mono">
                    Nomor : {noSpt}/RT.02.1-SPt/1572/{currentYear}
                  </div>
                </div>

                {/* Menimbang */}
                <div className="text-[10pt] leading-relaxed">
                  <table className="w-full text-justify align-top">
                    <tbody>
                      <tr>
                        <td className="w-24 font-bold align-top">Menimbang</td>
                        <td className="w-3 align-top">:</td>
                        <td className="align-top">
                          <ol className="list-none space-y-1 pl-0">
                            <li className="flex gap-2">
                              <span className="w-4">1.</span>
                              <span>bahwa berdasarkan {menimbang1};</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="w-4">2.</span>
                              <span>bahwa berdasarkan {menimbang2};</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="w-4">3.</span>
                              <span>
                                bahwa berdasarkan Pertimbangan Sebagaimana dimaksud dalam huruf a dan b diatas,
                                perlu untuk dikeluarkan Surat Perintah.
                              </span>
                            </li>
                          </ol>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Dasar */}
                <div className="text-[10pt] leading-relaxed">
                  <table className="w-full text-justify align-top">
                    <tbody>
                      <tr>
                        <td className="w-24 font-bold align-top">Dasar</td>
                        <td className="w-3 align-top">:</td>
                        <td className="align-top">
                          <ol className="list-none space-y-1 pl-0">
                            <li className="flex gap-2">
                              <span className="w-4">1.</span>
                              <span>
                                Peraturan Menteri Keuangan Republik Indonesia Nomor 119 Tahun 2023 Tentang
                                Perubahan Atas Peraturan Menteri Keuangan Nomor 113/PMK.05/2012 Tentang Perjalanan
                                Dinas Dalam Negeri Bagi Pejabat Negara, Pegawai Negeri, Dan Pegawai Tidak Tetap;
                              </span>
                            </li>
                            <li className="flex gap-2">
                              <span className="w-4">2.</span>
                              <span>
                                Peraturan Menteri Keuangan RI Nomor 39 Tahun 2024 tentang Standar Biaya Masukan
                                Tahun Anggaran 2025/2026;
                              </span>
                            </li>
                            <li className="flex gap-2">
                              <span className="w-4">3.</span>
                              <span>
                                Peraturan Direktur Jenderal Perbendaharaan Nomor PER-22/PB/2013 Tentang Petunjuk
                                Teknis Pelaksanaan Perjalanan Dinas Jabatan Dalam Negeri;
                              </span>
                            </li>
                            <li className="flex gap-2">
                              <span className="w-4">4.</span>
                              <span>
                                Keputusan Komisi Pemilihan Umum Nomor 409 Tahun 2022 Tentang Petunjuk Teknis
                                Pelaksanaan Perjalanan Dinas Jabatan Di Lingkungan Komisi Pemilihan Umum.
                              </span>
                            </li>
                          </ol>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Memberi Perintah */}
                <div className="text-center font-bold text-xs uppercase tracking-wider py-1 font-sans">
                  MEMBERI PERINTAH
                </div>

                {/* Kepada */}
                <div className="text-[10pt] leading-relaxed">
                  <table className="w-full align-top">
                    <tbody>
                      <tr>
                        <td className="w-24 font-bold align-top">Kepada</td>
                        <td className="w-3 align-top">:</td>
                        <td className="align-top">
                          <div className="border border-slate-800 rounded-sm overflow-hidden">
                            <table className="w-full text-[9pt] border-collapse">
                              <thead className="bg-slate-100 border-b border-slate-800 font-sans">
                                <tr>
                                  <th className="p-1 border-r border-slate-800 w-8 text-center">No</th>
                                  <th className="p-1 border-r border-slate-800 text-left">Nama / NIP</th>
                                  <th className="p-1 border-r border-slate-800 text-left">Pangkat / Gol</th>
                                  <th className="p-1 border-r border-slate-800 text-left">Jabatan</th>
                                  <th className="p-1 text-center w-24">Kedudukan</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800">
                                {assigned.length > 0 ? (
                                  assigned.map((emp, idx) => (
                                    <tr key={idx}>
                                      <td className="p-1 text-center border-r border-slate-800">{idx + 1}.</td>
                                      <td className="p-1 border-r border-slate-800 font-bold">
                                        {emp.nama_lengkap}
                                        <div className="text-[8pt] font-mono font-normal">NIP. {emp.nip_nik || '-'}</div>
                                      </td>
                                      <td className="p-1 border-r border-slate-800">{emp.pangkat_golongan || '-'}</td>
                                      <td className="p-1 border-r border-slate-800">{emp.jabatan || 'Pelaksana'}</td>
                                      <td className="p-1 text-center font-semibold">{emp.peran || 'Personil'}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td className="p-1 text-center border-r border-slate-800">1.</td>
                                    <td className="p-1 border-r border-slate-800 font-bold">Pegawai Bertugas</td>
                                    <td className="p-1 border-r border-slate-800">-</td>
                                    <td className="p-1 border-r border-slate-800">Staf</td>
                                    <td className="p-1 text-center">Pelaksana</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Untuk */}
                <div className="text-[10pt] leading-relaxed">
                  <table className="w-full text-justify align-top">
                    <tbody>
                      <tr>
                        <td className="w-24 font-bold align-top">Untuk</td>
                        <td className="w-3 align-top">:</td>
                        <td className="align-top space-y-1">
                          <div className="flex gap-2">
                            <span className="w-4">1.</span>
                            <span>
                              Dalam rangka <strong>{maksudTugas}</strong> ke <strong>{tempatTujuan}</strong> selama{' '}
                              <strong>{lamaHari} ({lamaHari === 1 ? 'satu' : lamaHari}) hari</strong>, terhitung tanggal{' '}
                              <strong>{tglBerangkatIndo}</strong> s/d <strong>{tglKembaliIndo}</strong>;
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="w-4">2.</span>
                            <span>Melaksanakan tugas dengan sebenarnya dengan penuh Rasa Tanggung Jawab;</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="w-4">3.</span>
                            <span>
                              Biaya Kegiatan akan ditanggung Oleh {bebanAnggaran};
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="w-4">4.</span>
                            <span>
                              Setelah selesai melaksanakan tugas segera membuat dan menyampaikan Laporan Hasil
                              Pelaksanaan Tugas kepada Pimpinan.
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Tanda Tangan SPT */}
                <div className="flex justify-between items-end pt-4 text-xs">
                  {/* Tembusan */}
                  <div className="text-[8pt] text-slate-600 leading-tight">
                    <div className="font-bold underline text-slate-800">Tembusan Yth:</div>
                    <ol className="list-decimal list-inside">
                      <li>Sekretaris Jenderal KPU RI;</li>
                      <li>Ketua KPU Provinsi Jambi;</li>
                      <li>Pejabat Pembuat Komitmen KPU Kota Sungai Penuh;</li>
                      <li>Bendahara Pengeluaran KPU Kota Sungai Penuh;</li>
                      <li>Yang Bersangkutan;</li>
                      <li>Pertinggal / Arsip.</li>
                    </ol>
                  </div>

                  {/* Stempel & TTD */}
                  <div className="text-center w-64">
                    <div>Dikeluarkan di : Sungai Penuh</div>
                    <div>Pada tanggal : {tanggalSurat}</div>
                    <div className="font-bold mt-2 uppercase font-sans">
                      {penandatanganSpt === 'ketua'
                        ? 'KOMISI PEMILIHAN UMUM KOTA SUNGAI PENUH\nKETUA'
                        : 'SEKRETARIS KOMISI PEMILIHAN UMUM\nKOTA SUNGAI PENUH'}
                    </div>
                    <div className="h-16 flex items-center justify-center text-slate-300 italic text-[8pt]">
                      (Tanda Tangan & Cap Dinas)
                    </div>
                    <div className="font-bold underline uppercase">
                      {penandatanganSpt === 'ketua' ? namaKetua : namaSekretaris}
                    </div>
                    {penandatanganSpt === 'sekretaris' && (
                      <div className="text-[8.5pt] font-mono">NIP. {nipSekretaris}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* BREAK SEPARATOR */}
            {(activeDoc === 'all' || activeDoc === 'sppd_lembar1') && activeDoc === 'all' && (
              <div className="print:break-before-page border-t-2 border-dashed border-slate-300 my-8 print:border-none print:my-0"></div>
            )}

            {/* DOKUMEN 2: SURAT PERJALANAN DINAS (SPD/SPPD) LEMBAR KE-1 */}
            {(activeDoc === 'sppd_lembar1' || activeDoc === 'all') && (
              <div className="space-y-3 print:mb-0 mb-12">
                {/* Header Kanan Lembar Ke */}
                <div className="flex justify-between text-[8.5pt]">
                  <div>
                    <div className="font-bold uppercase font-sans">KOMISI PEMILIHAN UMUM</div>
                    <div className="font-bold uppercase font-sans">KOTA SUNGAI PENUH</div>
                  </div>
                  <div className="text-right">
                    <table>
                      <tbody>
                        <tr>
                          <td>Lembar ke</td>
                          <td>: 1 (Satu)</td>
                        </tr>
                        <tr>
                          <td>Kode No</td>
                          <td>: -</td>
                        </tr>
                        <tr>
                          <td>Nomor</td>
                          <td className="font-mono font-bold">: {nomorSppd}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Judul SPPD */}
                <div className="text-center py-1">
                  <div className="font-bold text-sm tracking-widest uppercase underline font-sans">
                    SURAT PERJALANAN DINAS (SPD)
                  </div>
                </div>

                {/* Tabel 10 Butir SPPD Standar PMK */}
                <div className="border border-slate-800">
                  <table className="w-full text-[9pt] border-collapse">
                    <tbody className="divide-y divide-slate-800">
                      <tr>
                        <td className="w-8 p-1.5 text-center border-r border-slate-800 font-bold">1.</td>
                        <td className="w-2/5 p-1.5 border-r border-slate-800">Pejabat Pembuat Komitmen</td>
                        <td className="p-1.5 font-bold uppercase">SEKRETARIS KPU KOTA SUNGAI PENUH</td>
                      </tr>
                      <tr>
                        <td className="p-1.5 text-center border-r border-slate-800 font-bold">2.</td>
                        <td className="p-1.5 border-r border-slate-800">
                          Nama / NIP Pegawai yang melaksanakan perjalanan dinas
                        </td>
                        <td className="p-1.5">
                          <div className="font-bold uppercase">{currentEmp.nama_lengkap}</div>
                          <div className="font-mono text-[8pt]">NIP. {currentEmp.nip_nik || '-'}</div>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 text-center border-r border-slate-800 font-bold">3.</td>
                        <td className="p-1.5 border-r border-slate-800">
                          a. Pangkat dan Golongan<br />
                          b. Jabatan / Instansi<br />
                          c. Tingkat Biaya Perjalanan Dinas
                        </td>
                        <td className="p-1.5 leading-relaxed">
                          a. {currentEmp.pangkat_golongan || 'Penata Muda (III/a)'}<br />
                          b. {currentEmp.jabatan || 'Pelaksana'} / KPU Kota Sungai Penuh<br />
                          c. Tingkat C
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 text-center border-r border-slate-800 font-bold">4.</td>
                        <td className="p-1.5 border-r border-slate-800">Maksud Perjalanan Dinas</td>
                        <td className="p-1.5 font-bold">{maksudTugas}</td>
                      </tr>
                      <tr>
                        <td className="p-1.5 text-center border-r border-slate-800 font-bold">5.</td>
                        <td className="p-1.5 border-r border-slate-800">Alat Angkut yang dipergunakan</td>
                        <td className="p-1.5">{alatAngkut}</td>
                      </tr>
                      <tr>
                        <td className="p-1.5 text-center border-r border-slate-800 font-bold">6.</td>
                        <td className="p-1.5 border-r border-slate-800">
                          a. Tempat Berangkat<br />
                          b. Tempat Tujuan
                        </td>
                        <td className="p-1.5 font-bold">
                          a. {tempatBerangkat}<br />
                          b. {tempatTujuan}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 text-center border-r border-slate-800 font-bold">7.</td>
                        <td className="p-1.5 border-r border-slate-800">
                          a. Lamanya Perjalanan Dinas<br />
                          b. Tanggal Berangkat<br />
                          c. Tanggal harus kembali / tiba di tempat baru
                        </td>
                        <td className="p-1.5">
                          a. {lamaHari} ({lamaHari === 1 ? 'satu' : lamaHari}) hari<br />
                          b. {tglBerangkatIndo}<br />
                          c. {tglKembaliIndo}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 text-center border-r border-slate-800 font-bold">8.</td>
                        <td className="p-1.5 border-r border-slate-800">Pengikut : Nama</td>
                        <td className="p-1.5 text-slate-500">
                          {assigned.length > 1
                            ? assigned.filter((_, i) => i !== selectedEmpIndex).map(e => e.nama_lengkap).join(', ')
                            : '-'}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 text-center border-r border-slate-800 font-bold">9.</td>
                        <td className="p-1.5 border-r border-slate-800">
                          Pembebanan Anggaran<br />
                          a. Instansi<br />
                          b. Akun / Mata Anggaran
                        </td>
                        <td className="p-1.5">
                          a. {bebanAnggaran}<br />
                          b. {akunAnggaran}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-1.5 text-center border-r border-slate-800 font-bold">10.</td>
                        <td className="p-1.5 border-r border-slate-800">Keterangan Lain-lain</td>
                        <td className="p-1.5 font-mono text-[8pt]">
                          Surat Tugas Nomor: {noSpt}/RT.02.1-SPt/1572/{currentYear} Tanggal {tanggalSurat}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Tanda Tangan PPK */}
                <div className="flex justify-end pt-3 text-xs">
                  <div className="text-center w-72">
                    <div>Dikeluarkan di : Sungai Penuh</div>
                    <div>Pada tanggal : {tanggalSurat}</div>
                    <div className="font-bold mt-1 uppercase font-sans">
                      Pejabat Pembuat Komitmen (PPK)<br />
                      KPU Kota Sungai Penuh
                    </div>
                    <div className="h-16 flex items-center justify-center text-slate-300 italic text-[8pt]">
                      (Tanda Tangan & Cap PPK)
                    </div>
                    <div className="font-bold underline uppercase">{namaSekretaris}</div>
                    <div className="text-[8.5pt] font-mono">NIP. {nipSekretaris}</div>
                  </div>
                </div>
              </div>
            )}

            {/* BREAK SEPARATOR */}
            {(activeDoc === 'all' || activeDoc === 'sppd_visum') && activeDoc === 'all' && (
              <div className="print:break-before-page border-t-2 border-dashed border-slate-300 my-8 print:border-none print:my-0"></div>
            )}

            {/* DOKUMEN 3: LEMBAR VISUM SPPD (LEMBAR KE-2) */}
            {(activeDoc === 'sppd_visum' || activeDoc === 'all') && (
              <div className="space-y-3 print:mb-0">
                <div className="flex justify-between text-[8.5pt] border-b border-slate-800 pb-1">
                  <div>SPD Nomor: {nomorSppd}</div>
                  <div>Lembar ke: 2 (Lampiran Visum)</div>
                </div>

                {/* Tabel Visum I s/d VI */}
                <div className="border border-slate-800">
                  <table className="w-full text-[8.5pt] border-collapse">
                    <tbody className="divide-y divide-slate-800">
                      <tr>
                        <td className="w-1/2 p-2 border-r border-slate-800 align-top">
                          {/* Blank for symmetry or leave empty */}
                        </td>
                        <td className="w-1/2 p-2 align-top leading-relaxed">
                          <div><strong>I.</strong> Berangkat dari : {tempatBerangkat}</div>
                          <div>(Tempat Kedudukan)</div>
                          <div>Ke : {tempatTujuan}</div>
                          <div>Pada tanggal : {tglBerangkatIndo}</div>
                          <div className="text-center pt-2 font-bold uppercase font-sans">
                            Pejabat Pembuat Komitmen<br />
                            KPU Kota Sungai Penuh
                          </div>
                          <div className="h-10"></div>
                          <div className="text-center font-bold underline uppercase">{namaSekretaris}</div>
                          <div className="text-center font-mono text-[8pt]">NIP. {nipSekretaris}</div>
                        </td>
                      </tr>

                      <tr>
                        <td className="p-2 border-r border-slate-800 align-top leading-relaxed">
                          <div><strong>II.</strong> Tiba di : {tempatTujuan}</div>
                          <div>Pada tanggal : {tglBerangkatIndo}</div>
                          <div className="text-center pt-2 font-bold uppercase font-sans">
                            Kepala / Pejabat Setempat
                          </div>
                          <div className="h-10"></div>
                          <div className="text-center font-bold underline">( .................................................... )</div>
                          <div className="text-center font-mono text-[8pt]">NIP.</div>
                        </td>
                        <td className="p-2 align-top leading-relaxed">
                          <div>Berangkat dari : {tempatTujuan}</div>
                          <div>Ke : {tempatBerangkat}</div>
                          <div>Pada tanggal : {tglKembaliIndo}</div>
                          <div className="text-center pt-2 font-bold uppercase font-sans">
                            Kepala / Pejabat Setempat
                          </div>
                          <div className="h-10"></div>
                          <div className="text-center font-bold underline">( .................................................... )</div>
                          <div className="text-center font-mono text-[8pt]">NIP.</div>
                        </td>
                      </tr>

                      <tr>
                        <td className="p-2 border-r border-slate-800 align-top leading-relaxed">
                          <div><strong>III.</strong> Tiba di : {tempatBerangkat}</div>
                          <div>(Tempat Kedudukan Semula)</div>
                          <div>Pada tanggal : {tglKembaliIndo}</div>
                          <div className="text-center pt-2 font-bold uppercase font-sans">
                            Pejabat Pembuat Komitmen
                          </div>
                          <div className="h-10"></div>
                          <div className="text-center font-bold underline uppercase">{namaSekretaris}</div>
                          <div className="text-center font-mono text-[8pt]">NIP. {nipSekretaris}</div>
                        </td>
                        <td className="p-2 align-top leading-relaxed text-justify text-[8pt]">
                          <div><strong>IV.</strong> Telah diperiksa dengan keterangan bahwa perjalanan tersebut atas perintahnya dan semata-mata untuk kepentingan jabatan dalam waktu yang sesingkat-singkatnya.</div>
                          <div className="text-center pt-2 font-bold uppercase font-sans">
                            Pejabat Pembuat Komitmen
                          </div>
                          <div className="h-8"></div>
                          <div className="text-center font-bold underline uppercase">{namaSekretaris}</div>
                          <div className="text-center font-mono text-[8pt]">NIP. {nipSekretaris}</div>
                        </td>
                      </tr>

                      <tr>
                        <td colSpan={2} className="p-2 align-top text-[8pt] text-justify space-y-1">
                          <div><strong>V. Catatan Lain-Lain:</strong></div>
                          <p>
                            Pelaksanaan tugas telah diselesaikan dengan mematuhi prinsip efisiensi, akuntabilitas,
                            dan standar biaya masukan yang berlaku.
                          </p>
                          <div><strong>VI. PERHATIAN:</strong></div>
                          <p className="italic text-[7.5pt] leading-tight text-slate-600">
                            PPK yang menerbitkan SPD, pegawai yang melakukan perjalanan dinas, para pejabat yang
                            mengesahkan tanggal berangkat/tiba, serta bendahara pengeluaran bertanggung jawab
                            berdasarkan peraturan-peraturan Keuangan Negara apabila negara menderita kerugian
                            akibat kesalahan, kelalaian, dan kealpaannya.
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Modal (Hidden in Print) */}
        <div className="no-print px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Format Surat Perintah & SPPD sesuai PMK No. 119/2023 & Kpt KPU 409/2022</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
