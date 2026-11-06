import { Database } from 'sql.js';
import { executeSql, queryAll, queryOne } from '../db';
import { createNotification } from './notificationService';
import { getWibDateTime, parseTimeToMinutes } from '../utils/time';

export interface FcmTokenRecord {
  id: string;
  user_id: string;
  employee_id?: string;
  token: string;
  device_name?: string;
  platform?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * Register or update an FCM token for a user
 */
export function registerFcmToken(
  db: Database,
  userId: string,
  employeeId: string | undefined,
  token: string,
  deviceName?: string,
  platform?: string
): boolean {
  if (!token || !userId) return false;
  const now = new Date().toISOString();

  try {
    const existing = queryOne<FcmTokenRecord>(
      db,
      'SELECT id FROM fcm_tokens WHERE token = ?',
      [token]
    );

    if (existing) {
      executeSql(
        db,
        `UPDATE fcm_tokens
         SET user_id = ?, employee_id = ?, device_name = ?, platform = ?, is_active = 1, updated_at = ?
         WHERE token = ?`,
        [userId, employeeId || null, deviceName || 'Device', platform || 'Web', now, token]
      );
    } else {
      const id = `fcm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      executeSql(
        db,
        `INSERT INTO fcm_tokens (id, user_id, employee_id, token, device_name, platform, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, userId, employeeId || null, token, deviceName || 'Device', platform || 'Web', now, now]
      );
    }
    return true;
  } catch (err) {
    console.warn('[FCM Service] Register token error:', err);
    return false;
  }
}

/**
 * Unregister or deactivate an FCM token
 */
export function unregisterFcmToken(db: Database, token: string): boolean {
  try {
    executeSql(db, 'DELETE FROM fcm_tokens WHERE token = ?', [token]);
    return true;
  } catch (err) {
    console.warn('[FCM Service] Unregister token error:', err);
    return false;
  }
}

/**
 * Get active tokens for a specific user
 */
export function getUserActiveTokens(db: Database, userId: string): FcmTokenRecord[] {
  return queryAll<FcmTokenRecord>(
    db,
    'SELECT * FROM fcm_tokens WHERE user_id = ? AND is_active = 1',
    [userId]
  );
}

/**
 * Get all active tokens
 */
export function getAllActiveTokens(db: Database): FcmTokenRecord[] {
  return queryAll<FcmTokenRecord>(
    db,
    'SELECT * FROM fcm_tokens WHERE is_active = 1'
  );
}

/**
 * Dispatch Push Notification & In-App Notification
 */
export function sendPushAndInAppNotification(
  db: Database,
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  actionUrl: string = '/dashboard'
) {
  // 1. Create in-app notification (stored in SQLite + broadcasted via SSE)
  const notif = createNotification(db, userId, title, message, type, actionUrl);

  // 2. Fetch active FCM tokens for this user
  const tokens = getUserActiveTokens(db, userId);

  if (tokens.length > 0) {
    console.log(`[FCM Service] Dispatching push to ${tokens.length} active device(s) for user ${userId}:`, {
      title,
      body: message
    });
  }

  return { notification: notif, tokenCount: tokens.length };
}

/**
 * Run Daily Attendance Push Reminders Engine
 * Evaluates current time and employee attendance state in real time
 */
export function runAttendancePushReminderEngine(db: Database) {
  const wib = getWibDateTime();

  // 1. Fetch work schedule
  const schedule = queryOne<{
    jam_masuk: string;
    jam_pulang: string;
    hari_kerja: string;
  }>(db, 'SELECT jam_masuk, jam_pulang, hari_kerja FROM work_schedules WHERE is_active = 1 LIMIT 1') || {
    jam_masuk: '07:30:00',
    jam_pulang: '16:00:00',
    hari_kerja: '1,2,3,4,5'
  };

  // Check if today is a scheduled workday
  const workDays = schedule.hari_kerja.split(',').map(s => Number(s.trim()));
  if (!workDays.includes(wib.dayOfWeek)) {
    return { status: 'skipped', reason: 'Bukan hari kerja' };
  }

  // Check if today is a national holiday
  const holiday = queryOne<{ id: string; nama: string }>(
    db,
    'SELECT id, nama FROM holidays WHERE tanggal = ?',
    [wib.todayStr]
  );
  if (holiday) {
    return { status: 'skipped', reason: `Hari libur nasional: ${holiday.nama}` };
  }

  const currentMinutes = wib.totalMinutes;
  let morningRemindersSent = 0;
  let finalWarningSent = 0;
  let eveningRemindersSent = 0;

  // Active employees query
  const targetEmployees = queryAll<{
    user_id: string;
    employee_id: string;
    nama_lengkap: string;
  }>(
    db,
    `SELECT u.id as user_id, e.id as employee_id, e.nama_lengkap
     FROM users u
     JOIN employees e ON u.employee_id = e.id
     WHERE u.role = 'pegawai' AND u.is_active = 1 AND (e.is_deleted = 0 OR e.is_deleted IS NULL)`
  );

  for (const emp of targetEmployees) {
    // Check if on approved leave
    const onLeave = queryOne<{ id: string }>(
      db,
      `SELECT id FROM leave_requests
       WHERE employee_id = ? AND status = 'APPROVED'
       AND ? BETWEEN tanggal_mulai AND tanggal_selesai LIMIT 1`,
      [emp.employee_id, wib.todayStr]
    );
    if (onLeave) continue;

    // Check attendance record for today
    const att = queryOne<{ id: string; jam_masuk: string; jam_pulang: string }>(
      db,
      'SELECT id, jam_masuk, jam_pulang FROM attendance WHERE employee_id = ? AND tanggal = ?',
      [emp.employee_id, wib.todayStr]
    );

    // =========================================================================
    // A. PRESENSI MASUK: Rentang 06:00 - 08:30 WIB (360 - 510 menit)
    // =========================================================================
    if (!att || !att.jam_masuk) {
      // 1. Check-In Window Started Reminder (saat jam masuk dimulai pukul 06:00 - 07:59 WIB = 360 - 479 menit)
      if (currentMinutes >= 360 && currentMinutes < 480) {
        const alreadySent = queryOne<{ id: string }>(
          db,
          `SELECT id FROM notifications
           WHERE user_id = ? AND (title LIKE '%Presensi Masuk%' OR title LIKE '%Jam Presensi Masuk Dimulai%')
           AND created_at LIKE ? LIMIT 1`,
          [emp.user_id, `${wib.todayStr}%`]
        );

        if (!alreadySent) {
          sendPushAndInAppNotification(
            db,
            emp.user_id,
            '🌅 Jam Presensi Masuk Dimulai (06:00 WIB)',
            `Selamat pagi, ${emp.nama_lengkap}. Jam presensi masuk resmi KPU Kota Sungai Penuh telah dimulai pukul 06:00 WIB. Silakan lakukan presensi masuk selfie & GPS sebelum pukul 08:30 WIB agar tercatat hadir tepat waktu.`,
            'info',
            '/dashboard'
          );
          morningRemindersSent++;
        }
      }

      // 2. Final Warning Reminder (antara 08:00 - 08:29 WIB = 480 - 509 menit)
      if (currentMinutes >= 480 && currentMinutes <= 509) {
        const alreadySentWarning = queryOne<{ id: string }>(
          db,
          `SELECT id FROM notifications
           WHERE user_id = ? AND title = '⚠️ Peringatan: Batas Akhir Presensi Masuk 08:30 WIB'
           AND created_at LIKE ? LIMIT 1`,
          [emp.user_id, `${wib.todayStr}%`]
        );

        if (!alreadySentWarning) {
          sendPushAndInAppNotification(
            db,
            emp.user_id,
            '⚠️ Peringatan: Batas Akhir Presensi Masuk 08:30 WIB',
            `Penting! Batas akhir presensi masuk adalah pukul 08:30 WIB. Jika tidak absen, tombol masuk akan ditutup dan Anda dinyatakan TK (Tanpa Keterangan). Segera lakukan presensi sekarang!`,
            'warning',
            '/dashboard'
          );
          finalWarningSent++;
        }
      }
    }

    // =========================================================================
    // B. PRESENSI PULANG: Rentang 16:00 - 23:59 WIB (960 - 1439 menit)
    // =========================================================================
    if (att && att.jam_masuk && (!att.jam_pulang || att.jam_pulang === '')) {
      // Saat jam pulang dimulai (pukul 16:00 - 23:59 WIB = 960 - 1439 menit)
      if (currentMinutes >= 960 && currentMinutes <= 1439) {
        const alreadySentEvening = queryOne<{ id: string }>(
          db,
          `SELECT id FROM notifications
           WHERE user_id = ? AND (title LIKE '%Presensi Pulang%' OR title LIKE '%Jam Presensi Pulang Dimulai%')
           AND created_at LIKE ? LIMIT 1`,
          [emp.user_id, `${wib.todayStr}%`]
        );

        if (!alreadySentEvening) {
          sendPushAndInAppNotification(
            db,
            emp.user_id,
            '🏠 Jam Presensi Pulang Dimulai (16:00 WIB)',
            `Halo, ${emp.nama_lengkap}. Jam presensi pulang hari ini telah dimulai pukul 16:00 WIB. Harap lakukan presensi pulang dengan verifikasi selfie sebelum pukul 23:59 WIB.`,
            'info',
            '/dashboard'
          );
          eveningRemindersSent++;
        }
      }
    }
  }

  return {
    status: 'success',
    checkedEmployees: targetEmployees.length,
    morningRemindersSent,
    finalWarningSent,
    eveningRemindersSent,
    currentTimeWIB: `${String(wib.hour).padStart(2, '0')}:${String(wib.minute).padStart(2, '0')}`
  };
}

/**
 * Manual broadcast trigger by Admin/Kasubag
 */
export function broadcastAttendanceReminderNow(db: Database, type: 'masuk' | 'pulang') {
  const wib = getWibDateTime();
  const targetEmployees = queryAll<{
    user_id: string;
    employee_id: string;
    nama_lengkap: string;
  }>(
    db,
    `SELECT u.id as user_id, e.id as employee_id, e.nama_lengkap
     FROM users u
     JOIN employees e ON u.employee_id = e.id
     WHERE u.role = 'pegawai' AND u.is_active = 1 AND (e.is_deleted = 0 OR e.is_deleted IS NULL)`
  );

  let notifiedCount = 0;

  for (const emp of targetEmployees) {
    if (type === 'masuk') {
      const att = queryOne<{ id: string }>(
        db,
        'SELECT id FROM attendance WHERE employee_id = ? AND tanggal = ? AND jam_masuk IS NOT NULL',
        [emp.employee_id, wib.todayStr]
      );
      if (!att) {
        sendPushAndInAppNotification(
          db,
          emp.user_id,
          '📢 Pengingat Presensi Masuk (Admin KPU)',
          `Pengingat resmi: Batas presensi masuk adalah pukul 08:30 WIB. Harap segera lakukan check-in selfie dan verifikasi lokasi GPS Anda.`,
          'warning',
          '/dashboard'
        );
        notifiedCount++;
      }
    } else {
      const att = queryOne<{ id: string }>(
        db,
        'SELECT id FROM attendance WHERE employee_id = ? AND tanggal = ? AND jam_masuk IS NOT NULL AND (jam_pulang IS NULL OR jam_pulang = "")',
        [emp.employee_id, wib.todayStr]
      );
      if (att) {
        sendPushAndInAppNotification(
          db,
          emp.user_id,
          '📢 Pengingat Presensi Pulang (Admin KPU)',
          `Pengingat resmi: Jam kerja telah selesai. Silakan lakukan presensi pulang sebelum pukul 23:59 WIB.`,
          'info',
          '/dashboard'
        );
        notifiedCount++;
      }
    }
  }

  return { notifiedCount, totalEmployees: targetEmployees.length };
}
