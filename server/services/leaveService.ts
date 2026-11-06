import { Database } from 'sql.js';
import { queryAll, queryOne, executeSql, runTransaction, saveDb } from '../db';
import { createAuditLog } from './auditService';
import { createNotification } from './notificationService';

export interface LeaveBalanceData {
  id: string;
  employee_id: string;
  tahun: number;
  n_2: number;
  n_1: number;
  n: number;
  total: number;
  updated_at: string;
}

export function calculateLeaveDays(db: Database, startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start > end) {
    throw new Error('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
  }

  // Get system setting for working days calculation
  const settingCutoff = queryOne<{ setting_value: string }>(
    db,
    "SELECT setting_value FROM system_settings WHERE setting_key = 'cutoff_hari_kerja_only'"
  );
  const workDaysOnly = settingCutoff ? settingCutoff.setting_value === 'true' : true;

  // Get all holidays in range
  const holidays = queryAll<{ tanggal: string }>(
    db,
    'SELECT tanggal FROM holidays WHERE tanggal BETWEEN ? AND ?',
    [startDate, endDate]
  ).map(h => h.tanggal);

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    const dateStr = current.toISOString().split('T')[0];

    if (workDaysOnly) {
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidays.includes(dateStr);
      if (!isWeekend && !isHoliday) {
        count++;
      }
    } else {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  // If minimum is at least 1 day in range
  return Math.max(count, 1);
}

export function getLeaveBalance(db: Database, employeeId: string, year: number): LeaveBalanceData {
  let balance = queryOne<LeaveBalanceData>(
    db,
    'SELECT * FROM leave_balances WHERE employee_id = ? AND tahun = ?',
    [employeeId, year]
  );

  if (!balance) {
    // Check if employee has quota config
    const emp = queryOne<{ jatah_cuti_tahunan: number }>(
      db,
      'SELECT jatah_cuti_tahunan FROM employees WHERE id = ?',
      [employeeId]
    );
    const quota = emp ? emp.jatah_cuti_tahunan : 12;
    const now = new Date().toISOString();
    const id = `bal_${employeeId}_${year}`;
    
    executeSql(
      db,
      'INSERT INTO leave_balances (id, employee_id, tahun, n_2, n_1, n, total, updated_at) VALUES (?, ?, ?, 0, 0, ?, ?, ?)',
      [id, employeeId, year, quota, quota, now]
    );

    balance = {
      id,
      employee_id: employeeId,
      tahun: year,
      n_2: 0,
      n_1: 0,
      n: quota,
      total: quota,
      updated_at: now
    };
  }

  return balance;
}

export function generateLeaveRequestNumber(db: Database, year: number, month: number): string {
  const monthStr = String(month).padStart(2, '0');
  const prefix = `CUTI/${year}/${monthStr}/`;
  
  const latest = queryOne<{ nomor_pengajuan: string }>(
    db,
    "SELECT nomor_pengajuan FROM leave_requests WHERE nomor_pengajuan LIKE ? ORDER BY nomor_pengajuan DESC LIMIT 1",
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (latest && latest.nomor_pengajuan) {
    const parts = latest.nomor_pengajuan.split('/');
    if (parts.length >= 4) {
      const parsed = parseInt(parts[3], 10);
      if (!isNaN(parsed)) nextSeq = parsed + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

export interface LeaveExtraDetails {
  alamat_cuti?: string;
  telepon_cuti?: string;
  nama_atasan?: string;
  nip_atasan?: string;
  jabatan_atasan?: string;
  pangkat_golongan?: string;
  masa_kerja?: string;
}

export function createLeaveRequest(
  db: Database,
  employeeId: string,
  leaveTypeId: string,
  startDate: string,
  endDate: string,
  reason: string,
  attachmentUrl?: string,
  extraDetails?: LeaveExtraDetails
) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (new Date(startDate) > new Date(endDate)) {
    throw new Error('Tanggal selesai cuti tidak boleh lebih awal dari tanggal mulai.');
  }

  const leaveType = queryOne<{ id: string; kode: string; nama: string; uses_balance: number; requires_attachment: number }>(
    db,
    'SELECT * FROM leave_types WHERE id = ?',
    [leaveTypeId]
  );
  if (!leaveType) throw new Error('Jenis cuti tidak valid.');

  if (leaveType.requires_attachment && !attachmentUrl) {
    throw new Error(`Jenis cuti "${leaveType.nama}" mewajibkan adanya lampiran / bukti pendukung.`);
  }

  const daysRequested = calculateLeaveDays(db, startDate, endDate);

  // Hanya Cuti Tahunan (kode 'CT' / 'lt_ct') yang memotong dan mengecek saldo cuti tahunan
  const isCutiTahunan = leaveType.id === 'lt_ct' || leaveType.kode === 'CT';
  if (isCutiTahunan && leaveType.uses_balance) {
    const balance = getLeaveBalance(db, employeeId, currentYear);
    if (balance.total < daysRequested) {
      throw new Error(
        `Saldo cuti tahunan tidak mencukupi. Sisa saldo total: ${balance.total} hari, pengajuan: ${daysRequested} hari.`
      );
    }
  }

  const reqId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const reqNumber = generateLeaveRequestNumber(db, currentYear, currentMonth);
  const nowIso = now.toISOString();

  const emp = queryOne<{
    nama_lengkap: string;
    nomor_hp?: string;
    pangkat_golongan?: string;
    tanggal_masuk?: string;
  }>(db, 'SELECT nama_lengkap, nomor_hp, pangkat_golongan, tanggal_masuk FROM employees WHERE id = ?', [employeeId]);

  let calculatedMasaKerja = extraDetails?.masa_kerja || '';
  if (!calculatedMasaKerja && emp?.tanggal_masuk) {
    const masuk = new Date(emp.tanggal_masuk);
    const diffYears = Math.floor((now.getTime() - masuk.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    const diffMonths = Math.floor(((now.getTime() - masuk.getTime()) % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30));
    calculatedMasaKerja = `${Math.max(0, diffYears)} Tahun ${Math.max(0, diffMonths)} Bulan`;
  }

  const alamatCuti = extraDetails?.alamat_cuti || 'Kota Sungai Penuh';
  const teleponCuti = extraDetails?.telepon_cuti || emp?.nomor_hp || '-';
  const namaAtasan = extraDetails?.nama_atasan || 'Kasubbag SDM dan Parmas';
  const nipAtasan = extraDetails?.nip_atasan || '-';
  const jabatanAtasan = extraDetails?.jabatan_atasan || 'Atasan Langsung';
  const pangkatGol = extraDetails?.pangkat_golongan || emp?.pangkat_golongan || '-';

  executeSql(
    db,
    `INSERT INTO leave_requests (
      id, nomor_pengajuan, employee_id, leave_type_id, tanggal_mulai, tanggal_selesai,
      jumlah_hari, durasi_hari, alasan, lampiran_url, status, tanggal_pengajuan,
      alamat_cuti, telepon_cuti, nama_atasan, nip_atasan, jabatan_atasan, pangkat_golongan, masa_kerja,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Menunggu Approval', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reqId,
      reqNumber,
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      daysRequested,
      daysRequested,
      reason,
      attachmentUrl || null,
      nowIso.split('T')[0],
      alamatCuti,
      teleponCuti,
      namaAtasan,
      nipAtasan,
      jabatanAtasan,
      pangkatGol,
      calculatedMasaKerja || '1 Tahun',
      nowIso,
      nowIso
    ]
  );

  createNotification(
    db,
    'ADMIN',
    'Pengajuan Cuti Baru',
    `${emp?.nama_lengkap || 'Pegawai'} mengajukan ${leaveType.nama} sebanyak ${daysRequested} hari (${startDate} s/d ${endDate}).`,
    'info'
  );

  return {
    id: reqId,
    nomor_pengajuan: reqNumber,
    jumlah_hari: daysRequested,
    status: 'Menunggu Approval'
  };
}

export function approveLeaveRequest(
  db: Database,
  requestId: string,
  approverUserId: string,
  adminNotes?: string,
  ipAddress?: string
) {
  return runTransaction(db, () => {
    const req = queryOne<{
      id: string;
      nomor_pengajuan: string;
      employee_id: string;
      leave_type_id: string;
      jumlah_hari: number;
      status: string;
    }>(db, 'SELECT * FROM leave_requests WHERE id = ?', [requestId]);

    if (!req) throw new Error('Pengajuan cuti tidak ditemukan.');
    if (req.status !== 'Menunggu Approval') {
      throw new Error(`Pengajuan cuti sudah berstatus "${req.status}" dan tidak dapat di-approve lagi.`);
    }

    const leaveType = queryOne<{ id: string; kode: string; nama: string; uses_balance: number }>(
      db,
      'SELECT * FROM leave_types WHERE id = ?',
      [req.leave_type_id]
    );
    if (!leaveType) throw new Error('Jenis cuti tidak valid.');

    const now = new Date();
    const nowIso = now.toISOString();
    const currentYear = now.getFullYear();

    let balanceBefore = 0;
    let balanceAfter = 0;

    const isCutiTahunan = leaveType.id === 'lt_ct' || leaveType.kode === 'CT';
    if (isCutiTahunan && leaveType.uses_balance) {
      const balance = getLeaveBalance(db, req.employee_id, currentYear);
      balanceBefore = balance.total;

      if (balance.total < req.jumlah_hari) {
        throw new Error(
          `Saldo cuti tidak mencukupi saat proses approval. Tersedia: ${balance.total} hari, dibutuhkan: ${req.jumlah_hari} hari.`
        );
      }

      // Sequential deduction rule:
      // In Indonesian Civil Service (BKN), N-2 expires first, so deduct N-2 first, then N-1, then N.
      let remainingToDeduct = req.jumlah_hari;
      let newN2 = balance.n_2;
      let newN1 = balance.n_1;
      let newN = balance.n;

      if (newN2 > 0) {
        const deductFromN2 = Math.min(newN2, remainingToDeduct);
        newN2 -= deductFromN2;
        remainingToDeduct -= deductFromN2;
      }

      if (remainingToDeduct > 0 && newN1 > 0) {
        const deductFromN1 = Math.min(newN1, remainingToDeduct);
        newN1 -= deductFromN1;
        remainingToDeduct -= deductFromN1;
      }

      if (remainingToDeduct > 0 && newN > 0) {
        const deductFromN = Math.min(newN, remainingToDeduct);
        newN -= deductFromN;
        remainingToDeduct -= deductFromN;
      }

      balanceAfter = newN2 + newN1 + newN;

      // Update balance
      executeSql(
        db,
        'UPDATE leave_balances SET n_2 = ?, n_1 = ?, n = ?, total = ?, updated_at = ? WHERE id = ?',
        [newN2, newN1, newN, balanceAfter, nowIso, balance.id]
      );

      // Record transaction
      const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      executeSql(
        db,
        `INSERT INTO leave_balance_transactions (
          id, employee_id, leave_request_id, type,
          n_2_sebelum, n_2_sesudah, n_1_sebelum, n_1_sesudah, n_sebelum, n_sesudah,
          total_sebelum, total_sesudah, alasan, admin_id, timestamp
        ) VALUES (?, ?, ?, 'CUTI_DEDUCTION', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          req.employee_id,
          req.id,
          balance.n_2,
          newN2,
          balance.n_1,
          newN1,
          balance.n,
          newN,
          balanceBefore,
          balanceAfter,
          `Pemotongan cuti tahunan no ${req.nomor_pengajuan} (${req.jumlah_hari} hari)`,
          approverUserId,
          nowIso
        ]
      );
    }

    // Update leave request status
    executeSql(
      db,
      `UPDATE leave_requests SET 
        status = 'Disetujui',
        approver_id = ?,
        tanggal_approval = ?,
        catatan_admin = ?,
        updated_at = ?
       WHERE id = ?`,
      [approverUserId, nowIso, adminNotes || 'Disetujui oleh admin', nowIso, req.id]
    );

    // Record approval log
    const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    executeSql(
      db,
      `INSERT INTO leave_approvals (
        id, leave_request_id, approver_id, action, alasan_penolakan, saldo_sebelum, saldo_sesudah, timestamp
      ) VALUES (?, ?, ?, 'APPROVE', NULL, ?, ?, ?)`,
      [approvalId, req.id, approverUserId, balanceBefore, balanceAfter, nowIso]
    );

    // Notify employee
    const userEmp = queryOne<{ id: string }>(
      db,
      'SELECT id FROM users WHERE employee_id = ?',
      [req.employee_id]
    );
    if (userEmp) {
      createNotification(
        db,
        userEmp.id,
        'Pengajuan Cuti Disetujui',
        `Pengajuan ${leaveType.nama} Anda dengan nomor ${req.nomor_pengajuan} telah disetujui.`,
        'success'
      );
    }

    // Audit Log
    const approver = queryOne<{ username: string }>(db, 'SELECT username FROM users WHERE id = ?', [approverUserId]);
    createAuditLog(
      db,
      approverUserId,
      approver?.username || 'admin',
      'APPROVE_LEAVE',
      'LEAVE',
      JSON.stringify({ status: 'Menunggu Approval' }),
      JSON.stringify({ status: 'Disetujui', requestId: req.id, saldo_sesudah: balanceAfter }),
      ipAddress
    );

    return { success: true, status: 'Disetujui', balanceAfter };
  });
}

export function rejectLeaveRequest(
  db: Database,
  requestId: string,
  approverUserId: string,
  rejectionReason: string,
  ipAddress?: string
) {
  if (!rejectionReason || rejectionReason.trim().length === 0) {
    throw new Error('Alasan penolakan cuti wajib diisi.');
  }

  return runTransaction(db, () => {
    const req = queryOne<{
      id: string;
      nomor_pengajuan: string;
      employee_id: string;
      leave_type_id: string;
      status: string;
    }>(db, 'SELECT * FROM leave_requests WHERE id = ?', [requestId]);

    if (!req) throw new Error('Pengajuan cuti tidak ditemukan.');
    if (req.status !== 'Menunggu Approval') {
      throw new Error(`Pengajuan cuti sudah berstatus "${req.status}" dan tidak dapat diproses lagi.`);
    }

    const nowIso = new Date().toISOString();

    executeSql(
      db,
      `UPDATE leave_requests SET 
        status = 'Ditolak',
        approver_id = ?,
        tanggal_approval = ?,
        catatan_admin = ?,
        updated_at = ?
       WHERE id = ?`,
      [approverUserId, nowIso, rejectionReason, nowIso, req.id]
    );

    const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    executeSql(
      db,
      `INSERT INTO leave_approvals (
        id, leave_request_id, approver_id, action, alasan_penolakan, saldo_sebelum, saldo_sesudah, timestamp
      ) VALUES (?, ?, ?, 'REJECT', ?, NULL, NULL, ?)`,
      [approvalId, req.id, approverUserId, rejectionReason, nowIso]
    );

    // Notify employee
    const userEmp = queryOne<{ id: string }>(
      db,
      'SELECT id FROM users WHERE employee_id = ?',
      [req.employee_id]
    );
    if (userEmp) {
      createNotification(
        db,
        userEmp.id,
        'Pengajuan Cuti Ditolak',
        `Pengajuan cuti ${req.nomor_pengajuan} ditolak. Alasan: ${rejectionReason}`,
        'error'
      );
    }

    const approver = queryOne<{ username: string }>(db, 'SELECT username FROM users WHERE id = ?', [approverUserId]);
    createAuditLog(
      db,
      approverUserId,
      approver?.username || 'admin',
      'REJECT_LEAVE',
      'LEAVE',
      JSON.stringify({ status: 'Menunggu Approval' }),
      JSON.stringify({ status: 'Ditolak', requestId: req.id, alasan: rejectionReason }),
      ipAddress
    );

    return { success: true, status: 'Ditolak' };
  });
}

export function cancelLeaveRequest(
  db: Database,
  requestId: string,
  userId: string,
  userRole: string,
  ipAddress?: string
) {
  return runTransaction(db, () => {
    const req = queryOne<{
      id: string;
      nomor_pengajuan: string;
      employee_id: string;
      leave_type_id: string;
      jumlah_hari: number;
      status: string;
    }>(db, 'SELECT * FROM leave_requests WHERE id = ?', [requestId]);

    if (!req) throw new Error('Pengajuan cuti tidak ditemukan.');

    // If employee is cancelling, check that they own it
    if (userRole === 'pegawai') {
      const user = queryOne<{ employee_id: string }>(db, 'SELECT employee_id FROM users WHERE id = ?', [userId]);
      if (!user || user.employee_id !== req.employee_id) {
        throw new Error('Anda tidak memiliki izin membatalkan pengajuan pegawai lain.');
      }
    }

    if (req.status === 'Dibatalkan' || req.status === 'Ditolak') {
      throw new Error(`Pengajuan sudah berstatus ${req.status}.`);
    }

    const leaveType = queryOne<{ id: string; kode: string; uses_balance: number }>(
      db,
      'SELECT id, kode, uses_balance FROM leave_types WHERE id = ?',
      [req.leave_type_id]
    );

    const now = new Date();
    const nowIso = now.toISOString();
    const currentYear = now.getFullYear();

    const isCutiTahunan = leaveType && (leaveType.id === 'lt_ct' || leaveType.kode === 'CT');
    // If it was already approved and used balance, restore the balance!
    if (req.status === 'Disetujui' && isCutiTahunan && leaveType?.uses_balance) {
      const balance = getLeaveBalance(db, req.employee_id, currentYear);
      const totalSebelum = balance.total;
      // Restore to N (current year)
      const newN = balance.n + req.jumlah_hari;
      const totalSesudah = balance.n_2 + balance.n_1 + newN;

      executeSql(
        db,
        'UPDATE leave_balances SET n = ?, total = ?, updated_at = ? WHERE id = ?',
        [newN, totalSesudah, nowIso, balance.id]
      );

      const txId = `tx_rst_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      executeSql(
        db,
        `INSERT INTO leave_balance_transactions (
          id, employee_id, leave_request_id, type,
          n_2_sebelum, n_2_sesudah, n_1_sebelum, n_1_sesudah, n_sebelum, n_sesudah,
          total_sebelum, total_sesudah, alasan, admin_id, timestamp
        ) VALUES (?, ?, ?, 'CUTI_RESTORE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          req.employee_id,
          req.id,
          balance.n_2,
          balance.n_2,
          balance.n_1,
          balance.n_1,
          balance.n,
          newN,
          totalSebelum,
          totalSesudah,
          `Pengembalian saldo akibat pembatalan cuti no ${req.nomor_pengajuan} (+${req.jumlah_hari} hari)`,
          userId,
          nowIso
        ]
      );
    }

    executeSql(
      db,
      "UPDATE leave_requests SET status = 'Dibatalkan', updated_at = ?",
      [nowIso, req.id]
    );

    const emp = queryOne<{ nama_lengkap: string }>(db, 'SELECT nama_lengkap FROM employees WHERE id = ?', [req.employee_id]);
    const userEmp = queryOne<{ id: string }>(db, 'SELECT id FROM users WHERE employee_id = ?', [req.employee_id]);

    if (userRole === 'pegawai') {
      // Notify Admin
      createNotification(
        db,
        'ADMIN',
        'Pengajuan Cuti Dibatalkan',
        `${emp?.nama_lengkap || 'Pegawai'} telah membatalkan pengajuan cuti ${req.nomor_pengajuan}.`,
        'warning'
      );
      // Notify employee confirmation
      createNotification(
        db,
        userId,
        'Pengajuan Cuti Dibatalkan',
        `Pengajuan cuti Anda dengan nomor ${req.nomor_pengajuan} telah berhasil dibatalkan.`,
        'info'
      );
    } else {
      // Admin cancelled: notify employee
      if (userEmp) {
        createNotification(
          db,
          userEmp.id,
          'Pengajuan Cuti Dibatalkan',
          `Pengajuan cuti Anda (${req.nomor_pengajuan}) telah dibatalkan oleh Administrator.`,
          'warning'
        );
      }
    }

    const userObj = queryOne<{ username: string }>(db, 'SELECT username FROM users WHERE id = ?', [userId]);
    createAuditLog(
      db,
      userId,
      userObj?.username || 'user',
      'CANCEL_LEAVE',
      'LEAVE',
      JSON.stringify({ status: req.status }),
      JSON.stringify({ status: 'Dibatalkan', requestId: req.id }),
      ipAddress
    );

    return { success: true, status: 'Dibatalkan' };
  });
}

export function adjustLeaveBalanceManual(
  db: Database,
  employeeId: string,
  year: number,
  newN2: number,
  newN1: number,
  newN: number,
  reason: string,
  adminUserId: string,
  ipAddress?: string
) {
  if (!reason || reason.trim().length === 0) {
    throw new Error('Alasan penyesuaian manual saldo cuti wajib dicatat.');
  }

  return runTransaction(db, () => {
    const current = getLeaveBalance(db, employeeId, year);
    const newTotal = newN2 + newN1 + newN;
    const nowIso = new Date().toISOString();

    executeSql(
      db,
      'UPDATE leave_balances SET n_2 = ?, n_1 = ?, n = ?, total = ?, updated_at = ? WHERE id = ?',
      [newN2, newN1, newN, newTotal, nowIso, current.id]
    );

    const txId = `tx_adj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    executeSql(
      db,
      `INSERT INTO leave_balance_transactions (
        id, employee_id, leave_request_id, type,
        n_2_sebelum, n_2_sesudah, n_1_sebelum, n_1_sesudah, n_sebelum, n_sesudah,
        total_sebelum, total_sesudah, alasan, admin_id, timestamp
      ) VALUES (?, ?, NULL, 'MANUAL_ADJUSTMENT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txId,
        employeeId,
        current.n_2,
        newN2,
        current.n_1,
        newN1,
        current.n,
        newN,
        current.total,
        newTotal,
        reason,
        adminUserId,
        nowIso
      ]
    );

    const admin = queryOne<{ username: string }>(db, 'SELECT username FROM users WHERE id = ?', [adminUserId]);
    createAuditLog(
      db,
      adminUserId,
      admin?.username || 'admin',
      'MANUAL_BALANCE_ADJUSTMENT',
      'LEAVE_BALANCE',
      JSON.stringify({ n_2: current.n_2, n_1: current.n_1, n: current.n, total: current.total }),
      JSON.stringify({ n_2: newN2, n_1: newN1, n: newN, total: newTotal, reason }),
      ipAddress
    );

    return {
      success: true,
      data: {
        n_2: newN2,
        n_1: newN1,
        n: newN,
        total: newTotal
      }
    };
  });
}

export function recordHistoricalLeave(
  db: Database,
  params: {
    employeeId: string;
    leaveTypeId: string;
    nomorPengajuan?: string;
    startDate: string;
    endDate: string;
    days?: number;
    reason: string;
    status?: string;
    tanggalPengajuan?: string;
    tanggalApproval?: string;
    approverUserId?: string;
    potongSaldo?: boolean;
    catatanAdmin?: string;
  }
) {
  const {
    employeeId,
    leaveTypeId,
    nomorPengajuan,
    startDate,
    endDate,
    reason,
    status = 'Disetujui',
    tanggalPengajuan,
    tanggalApproval,
    approverUserId,
    potongSaldo = false,
    catatanAdmin
  } = params;

  const now = new Date();
  const nowIso = now.toISOString();
  const year = new Date(startDate).getFullYear() || now.getFullYear();

  const leaveType = queryOne<{ id: string; kode: string; nama: string; uses_balance: number }>(
    db,
    'SELECT * FROM leave_types WHERE id = ?',
    [leaveTypeId]
  );
  if (!leaveType) throw new Error('Jenis cuti tidak valid.');

  const daysRequested = params.days && params.days > 0 
    ? Number(params.days) 
    : calculateLeaveDays(db, startDate, endDate);

  const reqId = `req_hist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const finalNomor = nomorPengajuan && nomorPengajuan.trim() !== ''
    ? nomorPengajuan.trim()
    : `CUTI-HIST-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

  const finalTglPengajuan = tanggalPengajuan || startDate;
  const finalTglApproval = tanggalApproval || startDate;

  // Insert into leave_requests
  executeSql(
    db,
    `INSERT INTO leave_requests (
      id, nomor_pengajuan, employee_id, leave_type_id, tanggal_mulai, tanggal_selesai,
      jumlah_hari, alasan, lampiran_url, status, tanggal_pengajuan,
      approver_id, tanggal_approval, catatan_admin, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reqId,
      finalNomor,
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      daysRequested,
      reason,
      status,
      finalTglPengajuan,
      approverUserId || 'usr_admin_1',
      finalTglApproval,
      catatanAdmin || 'Pencatatan riwayat cuti lampau',
      nowIso,
      nowIso
    ]
  );

  // Hanya Cuti Tahunan (kode 'CT' / 'lt_ct') yang memotong saldo cuti tahunan
  const isCutiTahunan = leaveType.id === 'lt_ct' || leaveType.kode === 'CT';
  if (status === 'Disetujui' && potongSaldo && isCutiTahunan && leaveType.uses_balance) {
    const balance = getLeaveBalance(db, employeeId, year);
    let remainingToDeduct = daysRequested;
    let newN2 = balance.n_2;
    let newN1 = balance.n_1;
    let newN = balance.n;

    if (newN2 > 0) {
      const deductFromN2 = Math.min(newN2, remainingToDeduct);
      newN2 -= deductFromN2;
      remainingToDeduct -= deductFromN2;
    }
    if (remainingToDeduct > 0 && newN1 > 0) {
      const deductFromN1 = Math.min(newN1, remainingToDeduct);
      newN1 -= deductFromN1;
      remainingToDeduct -= deductFromN1;
    }
    if (remainingToDeduct > 0 && newN > 0) {
      const deductFromN = Math.min(newN, remainingToDeduct);
      newN -= deductFromN;
      remainingToDeduct -= deductFromN;
    }

    const balanceAfter = newN2 + newN1 + newN;
    executeSql(
      db,
      'UPDATE leave_balances SET n_2 = ?, n_1 = ?, n = ?, total = ?, updated_at = ? WHERE id = ?',
      [newN2, newN1, newN, balanceAfter, nowIso, balance.id]
    );

    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    executeSql(
      db,
      `INSERT INTO leave_balance_transactions (
        id, employee_id, leave_request_id, type,
        n_2_sebelum, n_2_sesudah, n_1_sebelum, n_1_sesudah, n_sebelum, n_sesudah,
        total_sebelum, total_sesudah, alasan, admin_id, timestamp
      ) VALUES (?, ?, ?, 'CUTI_DEDUCTION', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txId,
        employeeId,
        reqId,
        balance.n_2,
        newN2,
        balance.n_1,
        newN1,
        balance.n,
        newN,
        balance.total,
        balanceAfter,
        `Pencatatan cuti lampau: ${leaveType.nama} (${finalNomor})`,
        approverUserId || 'usr_admin_1',
        nowIso
      ]
    );
  }

  saveDb(db);

  return {
    id: reqId,
    nomor_pengajuan: finalNomor,
    jumlah_hari: daysRequested,
    status
  };
}

export function deleteLeaveRequest(
  db: Database,
  requestId: string,
  adminUserId: string,
  ipAddress?: string
) {
  return runTransaction(db, () => {
    const req = queryOne<{
      id: string;
      nomor_pengajuan: string;
      employee_id: string;
      leave_type_id: string;
      jumlah_hari: number;
      status: string;
      tanggal_mulai: string;
    }>(db, 'SELECT * FROM leave_requests WHERE id = ?', [requestId]);

    if (!req) {
      throw new Error('Data riwayat pengajuan cuti tidak ditemukan.');
    }

    const leaveType = queryOne<{ id: string; kode: string; nama: string; uses_balance: number }>(
      db,
      'SELECT id, kode, nama, uses_balance FROM leave_types WHERE id = ?',
      [req.leave_type_id]
    );

    const isCutiTahunan = leaveType && (leaveType.id === 'lt_ct' || leaveType.kode === 'CT');
    const nowIso = new Date().toISOString();
    const reqYear = new Date(req.tanggal_mulai).getFullYear() || new Date().getFullYear();

    // Jika berstatus Disetujui dan jenisnya Cuti Tahunan, pulihkan saldo cuti tahunan pegawai!
    if (req.status === 'Disetujui' && isCutiTahunan && leaveType?.uses_balance) {
      const balance = getLeaveBalance(db, req.employee_id, reqYear);
      const totalSebelum = balance.total;
      const newN = balance.n + (req.jumlah_hari || 0);
      const totalSesudah = balance.n_2 + balance.n_1 + newN;

      executeSql(
        db,
        'UPDATE leave_balances SET n = ?, total = ?, updated_at = ? WHERE id = ?',
        [newN, totalSesudah, nowIso, balance.id]
      );

      const txId = `tx_del_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      executeSql(
        db,
        `INSERT INTO leave_balance_transactions (
          id, employee_id, leave_request_id, type,
          n_2_sebelum, n_2_sesudah, n_1_sebelum, n_1_sesudah, n_sebelum, n_sesudah,
          total_sebelum, total_sesudah, alasan, admin_id, timestamp
        ) VALUES (?, ?, ?, 'CUTI_RESTORE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          req.employee_id,
          req.id,
          balance.n_2,
          balance.n_2,
          balance.n_1,
          balance.n_1,
          balance.n,
          newN,
          totalSebelum,
          totalSesudah,
          `Pengembalian saldo akibat penghapusan riwayat cuti no ${req.nomor_pengajuan} (+${req.jumlah_hari} hari)`,
          adminUserId,
          nowIso
        ]
      );
    }

    // Hapus data approval dan transaksi terkait
    executeSql(db, 'DELETE FROM leave_approvals WHERE leave_request_id = ?', [requestId]);
    executeSql(db, 'DELETE FROM leave_balance_transactions WHERE leave_request_id = ?', [requestId]);
    executeSql(db, 'DELETE FROM leave_requests WHERE id = ?', [requestId]);

    const admin = queryOne<{ username: string }>(db, 'SELECT username FROM users WHERE id = ?', [adminUserId]);
    createAuditLog(
      db,
      adminUserId,
      admin?.username || 'admin',
      'DELETE_LEAVE',
      'LEAVE',
      JSON.stringify(req),
      null,
      ipAddress
    );

    saveDb(db);
    return { success: true, message: 'Riwayat cuti berhasil dihapus.' };
  });
}

export function updateLeaveRequest(
  db: Database,
  requestId: string,
  data: {
    leaveTypeId?: string;
    startDate?: string;
    endDate?: string;
    days?: number;
    reason?: string;
    status?: string;
    nomorPengajuan?: string;
    catatanAdmin?: string;
  },
  adminUserId: string,
  ipAddress?: string
) {
  return runTransaction(db, () => {
    const req = queryOne<{
      id: string;
      nomor_pengajuan: string;
      employee_id: string;
      leave_type_id: string;
      tanggal_mulai: string;
      tanggal_selesai: string;
      jumlah_hari: number;
      alasan: string;
      status: string;
      catatan_admin: string;
    }>(db, 'SELECT * FROM leave_requests WHERE id = ?', [requestId]);

    if (!req) {
      throw new Error('Data riwayat pengajuan cuti tidak ditemukan.');
    }

    const nowIso = new Date().toISOString();
    const finalStartDate = data.startDate || req.tanggal_mulai;
    const finalEndDate = data.endDate || req.tanggal_selesai;
    const finalLeaveTypeId = data.leaveTypeId || req.leave_type_id;
    const finalDays = data.days !== undefined && Number(data.days) > 0 
      ? Number(data.days) 
      : calculateLeaveDays(db, finalStartDate, finalEndDate);
    const finalReason = data.reason !== undefined ? data.reason : req.alasan;
    const finalStatus = data.status || req.status;
    const finalNomor = data.nomorPengajuan || req.nomor_pengajuan;
    const finalCatatan = data.catatanAdmin !== undefined ? data.catatanAdmin : req.catatan_admin;

    const oldLeaveType = queryOne<{ id: string; kode: string; uses_balance: number }>(
      db, 'SELECT id, kode, uses_balance FROM leave_types WHERE id = ?', [req.leave_type_id]
    );
    const newLeaveType = queryOne<{ id: string; kode: string; uses_balance: number }>(
      db, 'SELECT id, kode, uses_balance FROM leave_types WHERE id = ?', [finalLeaveTypeId]
    );

    const oldWasCT = oldLeaveType && (oldLeaveType.id === 'lt_ct' || oldLeaveType.kode === 'CT');
    const newIsCT = newLeaveType && (newLeaveType.id === 'lt_ct' || newLeaveType.kode === 'CT');

    const year = new Date(finalStartDate).getFullYear() || new Date().getFullYear();

    // Jika sebelumnya status Disetujui dan merupakan Cuti Tahunan, kembalikan hari lama
    if (req.status === 'Disetujui' && oldWasCT && oldLeaveType?.uses_balance) {
      const balance = getLeaveBalance(db, req.employee_id, year);
      const restoredN = balance.n + req.jumlah_hari;
      executeSql(
        db,
        'UPDATE leave_balances SET n = ?, total = ?, updated_at = ? WHERE id = ?',
        [restoredN, balance.n_2 + balance.n_1 + restoredN, nowIso, balance.id]
      );
    }

    // Jika status baru adalah Disetujui dan jenis baru adalah Cuti Tahunan, potong hari baru
    if (finalStatus === 'Disetujui' && newIsCT && newLeaveType?.uses_balance) {
      const balance = getLeaveBalance(db, req.employee_id, year);
      const newN = Math.max(0, balance.n - finalDays);
      executeSql(
        db,
        'UPDATE leave_balances SET n = ?, total = ?, updated_at = ? WHERE id = ?',
        [newN, balance.n_2 + balance.n_1 + newN, nowIso, balance.id]
      );
    }

    executeSql(
      db,
      `UPDATE leave_requests SET
        nomor_pengajuan = ?,
        leave_type_id = ?,
        tanggal_mulai = ?,
        tanggal_selesai = ?,
        jumlah_hari = ?,
        durasi_hari = ?,
        alasan = ?,
        status = ?,
        catatan_admin = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        finalNomor,
        finalLeaveTypeId,
        finalStartDate,
        finalEndDate,
        finalDays,
        finalDays,
        finalReason,
        finalStatus,
        finalCatatan,
        nowIso,
        requestId
      ]
    );

    const admin = queryOne<{ username: string }>(db, 'SELECT username FROM users WHERE id = ?', [adminUserId]);
    createAuditLog(
      db,
      adminUserId,
      admin?.username || 'admin',
      'UPDATE_LEAVE',
      'LEAVE',
      JSON.stringify(req),
      JSON.stringify({
        nomor_pengajuan: finalNomor,
        leave_type_id: finalLeaveTypeId,
        tanggal_mulai: finalStartDate,
        tanggal_selesai: finalEndDate,
        jumlah_hari: finalDays,
        status: finalStatus
      }),
      ipAddress
    );

    saveDb(db);
    return { success: true, message: 'Data riwayat cuti berhasil diperbarui.' };
  });
}

export function clearAllLeaveRequests(
  db: Database,
  adminUserId: string,
  ipAddress?: string
) {
  return runTransaction(db, () => {
    executeSql(db, 'DELETE FROM leave_approvals');
    executeSql(db, 'DELETE FROM leave_balance_transactions');
    executeSql(db, 'DELETE FROM leave_requests');

    // Reset saldo cuti tahunan semua pegawai ke jatah cuti resmi
    const employees = queryAll<{ id: string; jatah_cuti_tahunan: number }>(
      db,
      'SELECT id, jatah_cuti_tahunan FROM employees'
    );
    const nowIso = new Date().toISOString();

    for (const emp of employees) {
      const quota = emp.jatah_cuti_tahunan || 12;
      executeSql(
        db,
        'UPDATE leave_balances SET n_2 = 0, n_1 = 0, n = ?, total = ?, updated_at = ? WHERE employee_id = ?',
        [quota, quota, nowIso, emp.id]
      );
    }

    // Pastikan hanya Cuti Tahunan yang memotong saldo
    executeSql(db, "UPDATE leave_types SET uses_balance = CASE WHEN id = 'lt_ct' OR kode = 'CT' THEN 1 ELSE 0 END;");

    const admin = queryOne<{ username: string }>(db, 'SELECT username FROM users WHERE id = ?', [adminUserId]);
    createAuditLog(
      db,
      adminUserId,
      admin?.username || 'admin',
      'CLEAR_ALL_LEAVES',
      'LEAVE',
      null,
      'Mengosongkan seluruh riwayat pengajuan cuti dan memulihkan saldo cuti tahunan pegawai',
      ipAddress
    );

    saveDb(db);
    return {
      success: true,
      message: 'Seluruh riwayat cuti telah berhasil dikosongkan dan saldo cuti pegawai telah dipulihkan.'
    };
  });
}
