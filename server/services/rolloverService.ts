import { Database } from 'sql.js';
import { queryAll, queryOne, executeSql, runTransaction } from '../db';
import { createAuditLog } from './auditService';
import { createNotification } from './notificationService';

export function runRolloverAnnualLeave(
  db: Database,
  targetYear: number,
  triggeredBy: 'SYSTEM' | 'ADMIN',
  adminUserId?: string,
  ipAddress?: string
) {
  // Idempotency check: has rollover already succeeded for targetYear?
  const existingLog = queryOne<{ id: string; status: string }>(
    db,
    "SELECT id, status FROM rollover_logs WHERE tahun_proses = ? AND status = 'SUCCESS'",
    [targetYear]
  );

  if (existingLog) {
    throw new Error(`Rollover cuti tahunan untuk tahun ${targetYear} sudah pernah dijalankan dan berhasil. Proses dicegah untuk menjaga konsistensi data (Idempotent).`);
  }

  return runTransaction(db, () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const prevYear = targetYear - 1;

    // Get annual quota setting
    const quotaSetting = queryOne<{ setting_value: string }>(
      db,
      "SELECT setting_value FROM system_settings WHERE setting_key = 'jatah_cuti_tahunan'"
    );
    const defaultQuota = quotaSetting ? parseInt(quotaSetting.setting_value, 10) || 12 : 12;

    // Fetch all active employees
    const employees = queryAll<{ id: string; nama_lengkap: string; jatah_cuti_tahunan: number }>(
      db,
      "SELECT id, nama_lengkap, jatah_cuti_tahunan FROM employees WHERE status_pegawai = 'aktif' AND is_deleted = 0"
    );

    const changesDetails: Array<{
      employee_id: string;
      nama: string;
      sebelum: { n_2: number; n_1: number; n: number; total: number };
      sesudah: { n_2: number; n_1: number; n: number; total: number };
      hangus_n_2: number;
    }> = [];

    for (const emp of employees) {
      // Get previous year's balance
      const prevBal = queryOne<{ n_2: number; n_1: number; n: number; total: number }>(
        db,
        'SELECT n_2, n_1, n, total FROM leave_balances WHERE employee_id = ? AND tahun = ?',
        [emp.id, prevYear]
      );

      const oldN2 = prevBal ? prevBal.n_2 : 0;
      const oldN1 = prevBal ? prevBal.n_1 : 0;
      const oldN = prevBal ? prevBal.n : 0;
      const oldTotal = prevBal ? prevBal.total : 0;

      // Rollover math:
      // 1. Saldo N tahun sebelumnya menjadi N-1 tahun berjalan
      // 2. Saldo N-1 tahun sebelumnya menjadi N-2 tahun berjalan
      // 3. Saldo N-2 tahun sebelumnya HANGUS (expired)
      // 4. Saldo N tahun berjalan diisi jatah cuti baru
      const newN2 = oldN1;
      const newN1 = oldN;
      const newN = emp.jatah_cuti_tahunan || defaultQuota;
      const newTotal = newN2 + newN1 + newN;
      const hangusN2 = oldN2;

      const balId = `bal_${emp.id}_${targetYear}`;

      // Insert or update leave_balances for targetYear
      const existsInTarget = queryOne<{ id: string }>(
        db,
        'SELECT id FROM leave_balances WHERE employee_id = ? AND tahun = ?',
        [emp.id, targetYear]
      );

      if (existsInTarget) {
        executeSql(
          db,
          'UPDATE leave_balances SET n_2 = ?, n_1 = ?, n = ?, total = ?, updated_at = ? WHERE id = ?',
          [newN2, newN1, newN, newTotal, nowIso, existsInTarget.id]
        );
      } else {
        executeSql(
          db,
          `INSERT INTO leave_balances (id, employee_id, tahun, n_2, n_1, n, total, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [balId, emp.id, targetYear, newN2, newN1, newN, newTotal, nowIso]
        );
      }

      // Record balance transaction
      const txId = `tx_roll_${targetYear}_${emp.id}`;
      executeSql(
        db,
        `INSERT INTO leave_balance_transactions (
          id, employee_id, leave_request_id, type,
          n_2_sebelum, n_2_sesudah, n_1_sebelum, n_1_sesudah, n_sebelum, n_sesudah,
          total_sebelum, total_sesudah, alasan, admin_id, timestamp
        ) VALUES (?, ?, NULL, 'ROLLOVER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          emp.id,
          oldN2,
          newN2,
          oldN1,
          newN1,
          oldN,
          newN,
          oldTotal,
          newTotal,
          `Rollover cuti tahunan awal tahun ${targetYear}. N-2 lama (${hangusN2} hari) hangus, N-1->N-2 (${newN2} hari), N->N-1 (${newN1} hari), jatah baru N (${newN} hari).`,
          adminUserId || 'SYSTEM',
          nowIso
        ]
      );

      changesDetails.push({
        employee_id: emp.id,
        nama: emp.nama_lengkap,
        sebelum: { n_2: oldN2, n_1: oldN1, n: oldN, total: oldTotal },
        sesudah: { n_2: newN2, n_1: newN1, n: newN, total: newTotal },
        hangus_n_2: hangusN2
      });
    }

    // Record rollover log
    const logId = `roll_${targetYear}_${Date.now()}`;
    executeSql(
      db,
      `INSERT INTO rollover_logs (
        id, tahun_proses, tanggal_proses, status, jumlah_pegawai_diproses, triggered_by, admin_id, detail_perubahan, timestamp
      ) VALUES (?, ?, ?, 'SUCCESS', ?, ?, ?, ?, ?)`,
      [
        logId,
        targetYear,
        nowIso.split('T')[0],
        employees.length,
        triggeredBy,
        adminUserId || null,
        JSON.stringify(changesDetails),
        nowIso
      ]
    );

    // Notify admins
    createNotification(
      db,
      'ADMIN',
      `Rollover Cuti Tahunan ${targetYear} Sukses`,
      `Rollover cuti tahunan tahun ${targetYear} telah berhasil diproses untuk ${employees.length} pegawai aktif (${triggeredBy}).`,
      'success'
    );

    // Audit log
    createAuditLog(
      db,
      adminUserId || null,
      adminUserId ? 'admin' : 'SYSTEM',
      'ROLLOVER_ANNUAL_LEAVE',
      'ROLLOVER',
      null,
      JSON.stringify({ tahun: targetYear, jumlah_pegawai: employees.length, triggeredBy }),
      ipAddress
    );

    return {
      success: true,
      tahun: targetYear,
      jumlah_pegawai: employees.length,
      detail: changesDetails
    };
  });
}
