import { Database } from 'sql.js';
import { queryOne, queryAll, executeSql, runTransaction } from '../db';
import { createAuditLog } from './auditService';

export interface TravelDutyParticipant {
  employee_id: string;
  peran?: string;
  nama_lengkap?: string;
  nip_nik?: string;
  jabatan?: string;
  unit_kerja?: string;
}

export function getTravelDuties(
  db: Database,
  filters?: { jenis?: string; tahun?: string; employeeId?: string; status?: string }
) {
  let sql = `
    SELECT td.*
    FROM travel_duties td
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters?.jenis) {
    sql += ' AND td.jenis_perjalanan = ?';
    params.push(filters.jenis);
  }

  if (filters?.tahun) {
    sql += ' AND (substr(td.tanggal_mulai, 1, 4) = ? OR substr(td.tanggal_selesai, 1, 4) = ?)';
    params.push(filters.tahun, filters.tahun);
  }

  if (filters?.status) {
    sql += ' AND td.status = ?';
    params.push(filters.status);
  }

  if (filters?.employeeId) {
    sql += ' AND td.id IN (SELECT travel_duty_id FROM travel_duty_employees WHERE employee_id = ?)';
    params.push(filters.employeeId);
  }

  sql += ' ORDER BY td.tanggal_mulai DESC, td.created_at DESC';

  const duties = queryAll<any>(db, sql, params);

  // Fetch participants for each travel duty
  return duties.map(duty => {
    const participants = queryAll<any>(
      db,
      `SELECT tde.id as link_id, tde.employee_id, tde.peran,
              e.nama_lengkap, e.nip_nik, e.jabatan, e.unit_kerja, e.foto_profil
       FROM travel_duty_employees tde
       JOIN employees e ON tde.employee_id = e.id
       WHERE tde.travel_duty_id = ?
       ORDER BY CASE WHEN tde.peran LIKE '%Ketua%' THEN 1 ELSE 2 END, e.nama_lengkap ASC`,
      [duty.id]
    );

    return {
      ...duty,
      employees: participants
    };
  });
}

export function createTravelDuty(
  db: Database,
  data: {
    nomor_surat_tugas: string;
    jenis_perjalanan: 'Dalam Kota' | 'Luar Kota';
    tanggal_mulai: string;
    tanggal_selesai: string;
    kota_tujuan: string;
    tempat_tujuan?: string;
    maksud_tujuan: string;
    beban_anggaran?: string;
    status?: string;
    lampiran_dokumen?: string;
    employee_ids: { employee_id: string; peran?: string }[];
  },
  userId: string
) {
  return runTransaction(db, () => {
    const nowIso = new Date().toISOString();
    const dutyId = `std_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    executeSql(
      db,
      `INSERT INTO travel_duties (
        id, nomor_surat_tugas, jenis_perjalanan, tanggal_mulai, tanggal_selesai,
        kota_tujuan, tempat_tujuan, maksud_tujuan, beban_anggaran, status,
        lampiran_dokumen, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dutyId,
        data.nomor_surat_tugas.trim(),
        data.jenis_perjalanan,
        data.tanggal_mulai,
        data.tanggal_selesai,
        data.kota_tujuan.trim(),
        data.tempat_tujuan ? data.tempat_tujuan.trim() : null,
        data.maksud_tujuan.trim(),
        data.beban_anggaran ? data.beban_anggaran.trim() : 'DIPA KPU Kota Sungai Penuh',
        data.status || 'terjadwal',
        data.lampiran_dokumen || null,
        userId,
        nowIso,
        nowIso
      ]
    );

    // Insert participants
    if (Array.isArray(data.employee_ids) && data.employee_ids.length > 0) {
      for (const item of data.employee_ids) {
        const tdeId = `tde_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        executeSql(
          db,
          `INSERT INTO travel_duty_employees (id, travel_duty_id, employee_id, peran)
           VALUES (?, ?, ?, ?)`,
          [tdeId, dutyId, item.employee_id, item.peran || 'Anggota Tim']
        );
      }
    }

    createAuditLog(
      db,
      userId,
      'Admin/Operator',
      'CREATE_TRAVEL_DUTY',
      'TRAVEL_DUTY',
      null,
      JSON.stringify({
        dutyId,
        nomor: data.nomor_surat_tugas,
        jenis: data.jenis_perjalanan,
        kota: data.kota_tujuan,
        participantsCount: data.employee_ids.length
      })
    );

    return { id: dutyId, success: true };
  });
}

export function updateTravelDuty(
  db: Database,
  id: string,
  data: {
    nomor_surat_tugas?: string;
    jenis_perjalanan?: 'Dalam Kota' | 'Luar Kota';
    tanggal_mulai?: string;
    tanggal_selesai?: string;
    kota_tujuan?: string;
    tempat_tujuan?: string;
    maksud_tujuan?: string;
    beban_anggaran?: string;
    status?: string;
    lampiran_dokumen?: string;
    employee_ids?: { employee_id: string; peran?: string }[];
  },
  userId: string
) {
  return runTransaction(db, () => {
    const existing = queryOne<any>(db, 'SELECT * FROM travel_duties WHERE id = ?', [id]);
    if (!existing) {
      throw new Error('Surat Tugas Perjalanan Dinas tidak ditemukan.');
    }

    const nowIso = new Date().toISOString();

    executeSql(
      db,
      `UPDATE travel_duties SET
        nomor_surat_tugas = COALESCE(?, nomor_surat_tugas),
        jenis_perjalanan = COALESCE(?, jenis_perjalanan),
        tanggal_mulai = COALESCE(?, tanggal_mulai),
        tanggal_selesai = COALESCE(?, tanggal_selesai),
        kota_tujuan = COALESCE(?, kota_tujuan),
        tempat_tujuan = COALESCE(?, tempat_tujuan),
        maksud_tujuan = COALESCE(?, maksud_tujuan),
        beban_anggaran = COALESCE(?, beban_anggaran),
        status = COALESCE(?, status),
        lampiran_dokumen = COALESCE(?, lampiran_dokumen),
        updated_at = ?
       WHERE id = ?`,
      [
        data.nomor_surat_tugas,
        data.jenis_perjalanan,
        data.tanggal_mulai,
        data.tanggal_selesai,
        data.kota_tujuan,
        data.tempat_tujuan,
        data.maksud_tujuan,
        data.beban_anggaran,
        data.status,
        data.lampiran_dokumen,
        nowIso,
        id
      ]
    );

    // If new employee_ids provided, replace participants
    if (data.employee_ids && Array.isArray(data.employee_ids)) {
      executeSql(db, 'DELETE FROM travel_duty_employees WHERE travel_duty_id = ?', [id]);
      for (const item of data.employee_ids) {
        const tdeId = `tde_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        executeSql(
          db,
          `INSERT INTO travel_duty_employees (id, travel_duty_id, employee_id, peran)
           VALUES (?, ?, ?, ?)`,
          [tdeId, id, item.employee_id, item.peran || 'Anggota Tim']
        );
      }
    }

    createAuditLog(
      db,
      userId,
      'Admin/Operator',
      'UPDATE_TRAVEL_DUTY',
      'TRAVEL_DUTY',
      null,
      JSON.stringify({ dutyId: id, status: data.status })
    );

    return { success: true };
  });
}

export function deleteTravelDuty(db: Database, id: string, userId: string) {
  return runTransaction(db, () => {
    executeSql(db, 'DELETE FROM travel_duty_employees WHERE travel_duty_id = ?', [id]);
    executeSql(db, 'DELETE FROM travel_duties WHERE id = ?', [id]);

    createAuditLog(
      db,
      userId,
      'Admin/Operator',
      'DELETE_TRAVEL_DUTY',
      'TRAVEL_DUTY',
      null,
      JSON.stringify({ dutyId: id })
    );

    return { success: true };
  });
}
