import { Database } from 'sql.js';
import { queryOne, queryAll, executeSql, runTransaction } from '../db';
import { createAuditLog } from './auditService';

export function getTukinGrades(db: Database) {
  return queryAll<any>(db, 'SELECT * FROM tukin_grades ORDER BY kelas_jabatan DESC, besaran_dasar DESC');
}

export function updateTukinGrade(
  db: Database,
  id: string,
  besaran_dasar: number,
  kelas_jabatan?: number,
  keterangan?: string
) {
  const nowIso = new Date().toISOString();
  executeSql(
    db,
    `UPDATE tukin_grades SET
      besaran_dasar = ?,
      kelas_jabatan = COALESCE(?, kelas_jabatan),
      keterangan = COALESCE(?, keterangan),
      updated_at = ?
     WHERE id = ?`,
    [besaran_dasar, kelas_jabatan, keterangan, nowIso, id]
  );
  return { success: true };
}

function getWorkingDaysCount(year: number, month: number, holidays: string[]): number {
  // Days in month
  const totalDays = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(year, month - 1, d);
    const dayOfWeek = dt.getDay(); // 0 = Sun, 6 = Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!holidays.includes(dateStr)) {
        count++;
      }
    }
  }
  return count > 0 ? count : 22; // default fallback
}

export function calculateTukinForMonth(
  db: Database,
  bulan: number,
  tahun: number,
  userId: string = 'system'
) {
  return runTransaction(db, () => {
    const monthStr = String(bulan).padStart(2, '0');
    const prefix = `${tahun}-${monthStr}`;

    // Get official holidays for this month
    const holidayRows = queryAll<{ tanggal: string }>(
      db,
      "SELECT tanggal FROM holidays WHERE tanggal LIKE ? || '%'",
      [prefix]
    );
    const holidays = holidayRows.map(h => h.tanggal);
    const totalWorkingDays = getWorkingDaysCount(tahun, bulan, holidays);

    // Get all grades
    const grades = queryAll<any>(db, 'SELECT * FROM tukin_grades');

    // Get all active employees
    const employees = queryAll<any>(
      db,
      "SELECT * FROM employees WHERE status_pegawai = 'aktif' ORDER BY unit_kerja ASC, nama_lengkap ASC"
    );

    const nowIso = new Date().toISOString();
    const calculations: any[] = [];

    for (const emp of employees) {
      // Find matching grade based on jabatan or default
      let matchedGrade = grades.find(g =>
        emp.jabatan && g.jabatan.toLowerCase().includes(emp.jabatan.toLowerCase())
      );

      if (!matchedGrade) {
        if (emp.jabatan?.toLowerCase().includes('sekretaris')) {
          matchedGrade = grades.find(g => g.id === 'tg_sekretaris');
        } else if (emp.jabatan?.toLowerCase().includes('kasubbag') || emp.jabatan?.toLowerCase().includes('kepala')) {
          matchedGrade = grades.find(g => g.id === 'tg_kasubbag');
        } else if (emp.jabatan?.toLowerCase().includes('bendahara')) {
          matchedGrade = grades.find(g => g.id === 'tg_bendahara');
        } else if (emp.jabatan?.toLowerCase().includes('penata') || emp.jabatan?.toLowerCase().includes('pemilu')) {
          matchedGrade = grades.find(g => g.id === 'tg_penata_pemilu');
        } else if (emp.jabatan?.toLowerCase().includes('analis')) {
          matchedGrade = grades.find(g => g.id === 'tg_analis_hukum');
        } else if (emp.tipe_pegawai === 'PPNPN') {
          matchedGrade = grades.find(g => g.id === 'tg_ppnpn');
        } else {
          matchedGrade = grades.find(g => g.id === 'tg_staf_pelaksana') || grades[0];
        }
      }

      const tukinBruto = matchedGrade ? matchedGrade.besaran_dasar : 3510400;

      // Attendance records for this employee this month
      const attendances = queryAll<any>(
        db,
        "SELECT * FROM attendance WHERE employee_id = ? AND tanggal LIKE ? || '%'",
        [emp.id, prefix]
      );

      // Travel duties in this month
      const dutiesCount = queryOne<{ count: number }>(
        db,
        `SELECT COUNT(DISTINCT td.id) as count
         FROM travel_duties td
         JOIN travel_duty_employees tde ON td.id = tde.travel_duty_id
         WHERE tde.employee_id = ?
           AND (td.tanggal_mulai LIKE ? || '%' OR td.tanggal_selesai LIKE ? || '%')`,
        [emp.id, prefix, prefix]
      );
      const hariDinas = dutiesCount ? dutiesCount.count : 0;

      // Approved leave in this month
      const leavesCount = queryOne<{ days: number }>(
        db,
        `SELECT COALESCE(SUM(jumlah_hari), SUM(durasi_hari), 0) as days
         FROM leave_requests
         WHERE employee_id = ?
           AND (status = 'Disetujui' OR status = 'APPROVED')
           AND (tanggal_mulai LIKE ? || '%' OR tanggal_selesai LIKE ? || '%')`,
        [emp.id, prefix, prefix]
      );
      const hariCuti = leavesCount ? leavesCount.days : 0;

      let hariHadir = 0;
      let totalTlMenit = 0;
      let potonganTlPersen = 0;
      let totalPswMenit = 0;
      let potonganPswPersen = 0;

      for (const att of attendances) {
        // Only count valid attendances
        if (att.status === 'Hadir' || att.status === 'Terlambat' || att.status === 'WFH' || att.status === 'WFA' || att.approval_status === 'approved') {
          hariHadir++;

          // Keterlambatan
          const late = att.keterlambatan_menit || 0;
          if (late > 0) {
            totalTlMenit += late;
            if (late <= 30) {
              potonganTlPersen += 0.5;
            } else if (late <= 60) {
              potonganTlPersen += 1.0;
            } else if (late <= 90) {
              potonganTlPersen += 1.25;
            } else {
              potonganTlPersen += 1.5;
            }
          }

          // Pulang Cepat sebelum jam pengganti
          if (att.status_ganti_jam === 'tidak_memenuhi') {
            potonganPswPersen += 1.0;
            totalPswMenit += 30;
          }
        }
      }

      // Hitung Tanpa Keterangan (Alpa)
      const calculatedAccountedDays = hariHadir + hariDinas + hariCuti;
      const hariTk = Math.max(0, totalWorkingDays - calculatedAccountedDays);
      const potonganTkPersen = hariTk * 3.0; // 3% per hari alpa

      const totalPotonganPersen = Math.min(100, Number((potonganTlPersen + potonganPswPersen + potonganTkPersen).toFixed(2)));
      const totalPotonganRupiah = Math.round(tukinBruto * (totalPotonganPersen / 100));
      const tukinNetto = Math.max(0, Math.round(tukinBruto - totalPotonganRupiah));

      const calcId = `tc_${emp.id}_${tahun}_${bulan}`;

      executeSql(
        db,
        `INSERT OR REPLACE INTO tukin_calculations (
          id, bulan, tahun, employee_id, tukin_bruto, hari_kerja, hari_hadir,
          hari_dinas, hari_cuti, hari_tk, total_tl_menit, potongan_tl_persen,
          total_psw_menit, potongan_psw_persen, potongan_tk_persen,
          total_potongan_persen, total_potongan_rupiah, tukin_netto,
          status_pembayaran, catatan, calculated_at, calculated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          calcId,
          bulan,
          tahun,
          emp.id,
          tukinBruto,
          totalWorkingDays,
          hariHadir,
          hariDinas,
          hariCuti,
          hariTk,
          totalTlMenit,
          potonganTlPersen,
          totalPswMenit,
          potonganPswPersen,
          potonganTkPersen,
          totalPotonganPersen,
          totalPotonganRupiah,
          tukinNetto,
          'final',
          `Kelas Jabatan: ${matchedGrade?.kelas_jabatan || 7}`,
          nowIso,
          userId
        ]
      );

      calculations.push({
        id: calcId,
        bulan,
        tahun,
        employee_id: emp.id,
        nama_lengkap: emp.nama_lengkap,
        nip_nik: emp.nip_nik,
        jabatan: emp.jabatan,
        unit_kerja: emp.unit_kerja,
        kelas_jabatan: matchedGrade?.kelas_jabatan || 7,
        tukin_bruto: tukinBruto,
        hari_kerja: totalWorkingDays,
        hari_hadir: hariHadir,
        hari_dinas: hariDinas,
        hari_cuti: hariCuti,
        hari_tk: hariTk,
        total_tl_menit: totalTlMenit,
        potongan_tl_persen: potonganTlPersen,
        total_psw_menit: totalPswMenit,
        potongan_psw_persen: potonganPswPersen,
        potongan_tk_persen: potonganTkPersen,
        total_potongan_persen: totalPotonganPersen,
        total_potongan_rupiah: totalPotonganRupiah,
        tukin_netto: tukinNetto,
        status_pembayaran: 'final'
      });
    }

    createAuditLog(
      db,
      userId,
      'Operator Keuangan/Admin',
      'RECALCULATE_TUKIN',
      'TUKIN',
      null,
      JSON.stringify({ bulan, tahun, totalEmployees: employees.length })
    );

    return calculations;
  });
}

export function getTukinCalculations(db: Database, bulan: number, tahun: number) {
  const existing = queryAll<any>(
    db,
    `SELECT tc.*, e.nama_lengkap, e.nip_nik, e.jabatan, e.unit_kerja, e.foto_profil, tg.kelas_jabatan
     FROM tukin_calculations tc
     JOIN employees e ON tc.employee_id = e.id
     LEFT JOIN tukin_grades tg ON e.jabatan LIKE '%' || tg.jabatan || '%'
     WHERE tc.bulan = ? AND tc.tahun = ?
     ORDER BY e.unit_kerja ASC, tc.tukin_bruto DESC, e.nama_lengkap ASC`,
    [bulan, tahun]
  );

  if (existing.length === 0) {
    // Auto calculate if not calculated yet
    return calculateTukinForMonth(db, bulan, tahun);
  }

  return existing;
}
