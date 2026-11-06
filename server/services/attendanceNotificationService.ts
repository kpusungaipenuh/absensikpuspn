import { Database } from 'sql.js';
import { queryAll, queryOne } from '../db';
import { createNotification } from './notificationService';
import { getWibDateTime, parseTimeToMinutes } from '../utils/time';

interface WorkScheduleRow {
  id: string;
  jam_masuk: string;
  jam_pulang: string;
  toleransi_keterlambatan_menit: number;
  hari_kerja: string;
}

/**
 * Checks if work hours have started and creates notification for employees
 * who have not yet checked in today.
 */
export function checkAndNotifyLateAttendance(db: Database, specificUserId?: string) {
  const wib = getWibDateTime();
  const schedule = queryOne<WorkScheduleRow>(
    db,
    'SELECT * FROM work_schedules WHERE is_active = 1 LIMIT 1'
  ) || {
    id: 'default',
    jam_masuk: '07:30:00',
    jam_pulang: '16:00:00',
    toleransi_keterlambatan_menit: 15,
    hari_kerja: '1,2,3,4,5'
  };

  // Check if today is a scheduled workday
  const workDays = schedule.hari_kerja.split(',').map(s => Number(s.trim()));
  if (!workDays.includes(wib.dayOfWeek)) {
    // Weekend / non-work day
    return { checked: 0, notified: 0, reason: 'Hari libur / bukan hari kerja' };
  }

  // Check if today is a holiday in holidays table
  const holiday = queryOne<{ id: string; nama: string }>(
    db,
    'SELECT id, nama FROM holidays WHERE tanggal = ?',
    [wib.todayStr]
  );
  if (holiday) {
    return { checked: 0, notified: 0, reason: `Hari libur nasional: ${holiday.nama}` };
  }

  const schedInMinutes = parseTimeToMinutes(schedule.jam_masuk);
  // Only trigger when work hours have actually started
  if (wib.totalMinutes < schedInMinutes) {
    return { checked: 0, notified: 0, reason: 'Belum masuk jam kerja' };
  }

  // Find employees with user accounts
  let sql = `
    SELECT u.id as user_id, u.username, e.id as employee_id, e.nama_lengkap
    FROM users u
    JOIN employees e ON u.employee_id = e.id
    WHERE u.role = 'pegawai' AND u.is_active = 1 AND (e.is_deleted = 0 OR e.is_deleted IS NULL)
  `;
  const params: any[] = [];
  if (specificUserId) {
    sql += ' AND u.id = ?';
    params.push(specificUserId);
  }

  const targetUsers = queryAll<{
    user_id: string;
    username: string;
    employee_id: string;
    nama_lengkap: string;
  }>(db, sql, params);

  let notifiedCount = 0;
  const jamMasukFormatted = schedule.jam_masuk.substring(0, 5);

  for (const user of targetUsers) {
    // 1. Check if employee is on approved leave today
    const onLeave = queryOne<{ id: string }>(
      db,
      `SELECT id FROM leave_requests
       WHERE employee_id = ? AND status = 'APPROVED'
       AND ? BETWEEN tanggal_mulai AND tanggal_selesai
       LIMIT 1`,
      [user.employee_id, wib.todayStr]
    );
    if (onLeave) continue;

    // 2. Check if employee has checked in today
    const attendance = queryOne<{ id: string; jam_masuk: string }>(
      db,
      'SELECT id, jam_masuk FROM attendance WHERE employee_id = ? AND tanggal = ?',
      [user.employee_id, wib.todayStr]
    );
    if (attendance && attendance.jam_masuk) {
      // Already checked in
      continue;
    }

    // 3. Check if notification was already sent to this user today
    const existingNotif = queryOne<{ id: string }>(
      db,
      `SELECT id FROM notifications
       WHERE user_id = ? AND title = 'Peringatan Jam Masuk Presensi'
       AND created_at LIKE ? LIMIT 1`,
      [user.user_id, `${wib.todayStr}%`]
    );

    if (!existingNotif) {
      createNotification(
        db,
        user.user_id,
        'Peringatan Jam Masuk Presensi',
        `Jam masuk kerja KPU (${jamMasukFormatted} WIB) telah dimulai. Anda tercatat belum melakukan absensi masuk hari ini. Harap segera lakukan check-in selfie dan GPS.`,
        'warning',
        '/dashboard'
      );
      notifiedCount++;
    }
  }

  return { checked: targetUsers.length, notified: notifiedCount };
}
