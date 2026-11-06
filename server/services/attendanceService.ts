import { Database } from 'sql.js';
import { queryOne, executeSql, runTransaction } from '../db';
import { createAuditLog } from './auditService';
import { createNotification } from './notificationService';
import { getWibDateTime, parseTimeToMinutes, minutesToTimeStr } from '../utils/time';

export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
}

export function getActiveOfficeLocation(db: Database) {
  const loc = queryOne<{
    id: string;
    nama: string;
    latitude: number;
    longitude: number;
    radius_meter: number;
    alamat: string;
  }>(db, 'SELECT * FROM office_locations WHERE is_active = 1 LIMIT 1');

  if (loc) return loc;
  return {
    id: 'default',
    nama: 'Kantor KPU Kota Sungai Penuh',
    latitude: -2.069272,
    longitude: 101.403224,
    radius_meter: 150.0,
    alamat: 'Jl. Pancasila, Lawang Agung, Kecamatan Pondok Tinggi, Kota Sungai Penuh'
  };
}

export function getWorkMethodForEmployee(db: Database, employeeId: string, dateStr: string): string {
  const assignment = queryOne<{ metode_kerja: string }>(
    db,
    'SELECT metode_kerja FROM work_assignments WHERE employee_id = ? AND tanggal = ?',
    [employeeId, dateStr]
  );
  return assignment ? assignment.metode_kerja : 'WFO';
}

export function checkInAttendance(
  db: Database,
  employeeId: string,
  latitude: number,
  longitude: number,
  photoBase64: string,
  deviceInfo: string = 'Browser Client',
  ipAddress?: string,
  isEmergency?: boolean,
  emergencyReason?: string
) {
  return runTransaction(db, () => {
    const wib = getWibDateTime();
    const todayStr = wib.todayStr;
    const timeStr = wib.timeStr; // HH:mm:ss in WIB
    const nowIso = wib.isoStr;
    const currentMinutes = wib.totalMinutes;

    // Aturan Presensi Masuk KPU: Hanya dapat dilakukan pada pukul 06.00 sampai 08.30 WIB
    const minCheckInMinutes = 6 * 60; // 06:00 WIB = 360 menit
    const maxCheckInMinutes = 8 * 60 + 30; // 08:30 WIB = 510 menit

    if (currentMinutes < minCheckInMinutes) {
      throw new Error('Presensi masuk belum dibuka. Presensi masuk hanya dapat dilakukan pada pukul 06.00 sampai 08.30 WIB.');
    }
    if (currentMinutes > maxCheckInMinutes || (currentMinutes === maxCheckInMinutes && wib.second > 0)) {
      throw new Error('Waktu presensi masuk telah berakhir (batas maksimal pukul 08.30 WIB). Anda tidak dapat lagi melakukan presensi masuk hari ini.');
    }

    // Check if already checked in today
    const existing = queryOne<{ id: string; jam_masuk: string; approval_status: string }>(
      db,
      'SELECT id, jam_masuk, approval_status FROM attendance WHERE employee_id = ? AND tanggal = ?',
      [employeeId, todayStr]
    );

    if (existing && existing.jam_masuk && existing.approval_status !== 'rejected') {
      throw new Error(`Anda sudah melakukan absensi masuk hari ini pada pukul ${existing.jam_masuk} WIB.`);
    }

    const office = getActiveOfficeLocation(db);
    const distanceMeters = calculateDistanceInMeters(
      latitude,
      longitude,
      office.latitude,
      office.longitude
    );

    const workMethod = getWorkMethodForEmployee(db, employeeId, todayStr);
    let locationStatus = 'valid';
    let isEmergencyCheckin = 0;
    let cleanEmergencyReason: string | null = null;
    let approvalStatus = 'approved';

    if (workMethod === 'WFO') {
      if (distanceMeters > office.radius_meter) {
        if (isEmergency && emergencyReason && emergencyReason.trim().length > 0) {
          // Pegawai terkendala halangan dijalan (macet, mogok, dll) di luar radius
          locationStatus = 'luar_radius_pending';
          isEmergencyCheckin = 1;
          cleanEmergencyReason = emergencyReason.trim();
          approvalStatus = 'pending';
        } else {
          locationStatus = 'luar_radius';
          throw new Error(
            `Anda berada di luar radius absensi kantor KPU (${distanceMeters} meter dari kantor, batas radius: ${office.radius_meter} meter). ` +
            `Jika Anda mengalami kendala di perjalanan (macet, kendaraan mogok, atau halangan darurat), silakan centang dan isi alasan kendala di bawah untuk diverifikasi oleh Admin.`
          );
        }
      }
    } else {
      locationStatus = `valid (${workMethod})`;
    }

    // Determine status (Hadir vs Terlambat vs TK) and required check-out time (Ganti Jam)
    const schedule = queryOne<{ jam_masuk: string; jam_pulang: string; toleransi_keterlambatan_menit: number }>(
      db,
      'SELECT jam_masuk, jam_pulang, toleransi_keterlambatan_menit FROM work_schedules WHERE is_active = 1 LIMIT 1'
    ) || {
      jam_masuk: '07:30:00',
      jam_pulang: '16:00:00',
      toleransi_keterlambatan_menit: 59
    };

    let status = 'Hadir';
    let keterlambatanMenit = 0;
    let jamPulangWajib = schedule.jam_pulang;
    let statusGantiJam = 'tidak_perlu';

    const schedInMinutes = parseTimeToMinutes(schedule.jam_masuk); // 07:30 = 450 menit
    const schedOutMinutes = parseTimeToMinutes(schedule.jam_pulang); // 16:00 = 960 menit
    const cutoffTkMinutes = 8 * 60 + 29; // 08:29:59 = 509 menit (batas maksimal toleransi kehadiran)

    // Aturan Presensi KPU Kota Sungai Penuh:
    // 1. Datang <= 07:30 WIB: Hadir Tepat Waktu, pulang normal pukul 16:00.
    // 2. Datang 07:30 s.d. 08:29 WIB: Terlambat, HARUS mengganti jam keterlambatan saat pulang.
    // 3. Datang LEWAT 08:29 WIB (>= 08:30 WIB): Dianggap TK (Tanpa Keterangan).
    if (currentMinutes > cutoffTkMinutes) {
      status = 'TK';
      keterlambatanMenit = currentMinutes - schedInMinutes;
      statusGantiJam = 'tidak_berlaku';
      jamPulangWajib = schedule.jam_pulang;
    } else if (currentMinutes > schedInMinutes) {
      status = 'Terlambat';
      keterlambatanMenit = currentMinutes - schedInMinutes;
      const requiredOutMinutes = schedOutMinutes + keterlambatanMenit;
      jamPulangWajib = minutesToTimeStr(requiredOutMinutes);
      statusGantiJam = 'menunggu';
    } else {
      status = 'Hadir';
      keterlambatanMenit = 0;
      jamPulangWajib = schedule.jam_pulang;
      statusGantiJam = 'tidak_perlu';
    }

    if (approvalStatus === 'pending') {
      status = 'Menunggu Persetujuan';
    } else if (workMethod === 'WFH') {
      status = currentMinutes > cutoffTkMinutes ? 'TK' : 'WFH';
    } else if (workMethod === 'WFA') {
      status = currentMinutes > cutoffTkMinutes ? 'TK' : 'WFA';
    }

    const attId = existing ? existing.id : `att_${employeeId}_${todayStr}`;

    if (existing) {
      executeSql(
        db,
        `UPDATE attendance SET
          jam_masuk = ?,
          foto_masuk = ?,
          latitude_masuk = ?,
          longitude_masuk = ?,
          jarak_dari_kantor = ?,
          status_validasi_lokasi = ?,
          status = ?,
          metode_kerja = ?,
          keterlambatan_menit = ?,
          jam_pulang_wajib = ?,
          status_ganti_jam = ?,
          is_emergency_checkin = ?,
          emergency_reason = ?,
          approval_status = ?,
          device_info = ?,
          updated_at = ?
         WHERE id = ?`,
        [
          timeStr,
          photoBase64,
          latitude,
          longitude,
          distanceMeters,
          locationStatus,
          status,
          workMethod,
          keterlambatanMenit,
          jamPulangWajib,
          statusGantiJam,
          isEmergencyCheckin,
          cleanEmergencyReason,
          approvalStatus,
          deviceInfo,
          nowIso,
          attId
        ]
      );
    } else {
      executeSql(
        db,
        `INSERT INTO attendance (
          id, employee_id, tanggal, jam_masuk, jam_pulang, foto_masuk, foto_pulang,
          latitude_masuk, longitude_masuk, jarak_dari_kantor, status_validasi_lokasi,
          status, metode_kerja, keterlambatan_menit, jam_pulang_wajib, status_ganti_jam,
          is_emergency_checkin, emergency_reason, approval_status,
          device_info, created_at, updated_at
        ) VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          attId,
          employeeId,
          todayStr,
          timeStr,
          photoBase64,
          latitude,
          longitude,
          distanceMeters,
          locationStatus,
          status,
          workMethod,
          keterlambatanMenit,
          jamPulangWajib,
          statusGantiJam,
          isEmergencyCheckin,
          cleanEmergencyReason,
          approvalStatus,
          deviceInfo,
          nowIso,
          nowIso
        ]
      );
    }

    // Save photo record
    const photoId = `photo_in_${attId}`;
    executeSql(
      db,
      'INSERT OR REPLACE INTO attendance_photos (id, attendance_id, type, photo_data, created_at) VALUES (?, ?, ?, ?, ?)',
      [photoId, attId, 'masuk', photoBase64, nowIso]
    );

    const emp = queryOne<{ nama_lengkap: string }>(db, 'SELECT nama_lengkap FROM employees WHERE id = ?', [employeeId]);
    createAuditLog(
      db,
      null,
      emp?.nama_lengkap || employeeId,
      'ATTENDANCE_CHECK_IN',
      'ATTENDANCE',
      null,
      JSON.stringify({
        jam_masuk: timeStr,
        status,
        metode_kerja: workMethod,
        distanceMeters,
        keterlambatan_menit: keterlambatanMenit,
        jam_pulang_wajib: jamPulangWajib
      }),
      ipAddress
    );

    return {
      success: true,
      id: attId,
      tanggal: todayStr,
      jam_masuk: timeStr,
      status,
      metode_kerja: workMethod,
      jarak_dari_kantor: distanceMeters,
      status_validasi_lokasi: locationStatus,
      keterlambatan_menit: keterlambatanMenit,
      jam_pulang_wajib: jamPulangWajib,
      status_ganti_jam: statusGantiJam,
      approval_status: approvalStatus,
      is_emergency_checkin: isEmergencyCheckin,
      emergency_reason: cleanEmergencyReason
    };
  });
}

export function approveEmergencyAttendance(
  db: Database,
  attendanceId: string,
  adminId: string,
  approvalNote?: string
) {
  return runTransaction(db, () => {
    const att = queryOne<any>(db, 'SELECT * FROM attendance WHERE id = ?', [attendanceId]);
    if (!att) {
      throw new Error('Data presensi tidak ditemukan');
    }
    if (att.approval_status !== 'pending') {
      throw new Error(`Presensi ini sudah diproses dengan status: ${att.approval_status}`);
    }

    const wib = getWibDateTime();
    const newStatus = (att.keterlambatan_menit && att.keterlambatan_menit > 0) ? 'Terlambat' : 'Hadir';

    executeSql(
      db,
      `UPDATE attendance SET
        approval_status = 'approved',
        status = ?,
        status_validasi_lokasi = 'luar_radius_disetujui',
        approved_by = ?,
        approved_at = ?,
        approval_note = ?,
        updated_at = ?
       WHERE id = ?`,
      [newStatus, adminId, wib.isoStr, approvalNote || 'Disetujui oleh Admin/SDM', wib.isoStr, attendanceId]
    );

    // Send notification to employee
    const user = queryOne<{ id: string }>(
      db,
      'SELECT id FROM users WHERE employee_id = ? LIMIT 1',
      [att.employee_id]
    );
    if (user) {
      createNotification(
        db,
        user.id,
        'Absensi Luar Radius Disetujui',
        `Pengajuan presensi masuk tanggal ${att.tanggal} dengan kendala luar radius telah disetujui Admin/SDM. Status presensi: ${newStatus}.`,
        'success',
        '/dashboard'
      );
    }

    createAuditLog(
      db,
      adminId,
      'Admin',
      'APPROVE_EMERGENCY_ATTENDANCE',
      'ATTENDANCE',
      null,
      JSON.stringify({ attendanceId, employeeId: att.employee_id, status: newStatus, note: approvalNote })
    );

    return { success: true, status: newStatus, message: 'Presensi luar radius berhasil disetujui!' };
  });
}

export function rejectEmergencyAttendance(
  db: Database,
  attendanceId: string,
  adminId: string,
  approvalNote?: string
) {
  return runTransaction(db, () => {
    const att = queryOne<any>(db, 'SELECT * FROM attendance WHERE id = ?', [attendanceId]);
    if (!att) {
      throw new Error('Data presensi tidak ditemukan');
    }

    const wib = getWibDateTime();

    executeSql(
      db,
      `UPDATE attendance SET
        approval_status = 'rejected',
        status = 'Ditolak',
        status_validasi_lokasi = 'luar_radius_ditolak',
        approved_by = ?,
        approved_at = ?,
        approval_note = ?,
        updated_at = ?
       WHERE id = ?`,
      [adminId, wib.isoStr, approvalNote || 'Ditolak oleh Admin/SDM', wib.isoStr, attendanceId]
    );

    const user = queryOne<{ id: string }>(
      db,
      'SELECT id FROM users WHERE employee_id = ? LIMIT 1',
      [att.employee_id]
    );
    if (user) {
      createNotification(
        db,
        user.id,
        'Absensi Luar Radius Ditolak',
        `Pengajuan presensi masuk tanggal ${att.tanggal} dengan kendala luar radius ditolak Admin. Alasan: ${approvalNote || 'Bukti/alasan tidak memenuhi syarat'}.`,
        'error',
        '/dashboard'
      );
    }

    createAuditLog(
      db,
      adminId,
      'Admin',
      'REJECT_EMERGENCY_ATTENDANCE',
      'ATTENDANCE',
      null,
      JSON.stringify({ attendanceId, employeeId: att.employee_id, status: 'Ditolak', note: approvalNote })
    );

    return { success: true, status: 'Ditolak', message: 'Pengajuan presensi luar radius telah ditolak.' };
  });
}

export function checkOutAttendance(
  db: Database,
  employeeId: string,
  latitude: number,
  longitude: number,
  photoBase64: string,
  deviceInfo: string = 'Browser Client',
  ipAddress?: string,
  isEmergency?: boolean,
  emergencyReason?: string
) {
  return runTransaction(db, () => {
    const wib = getWibDateTime();
    const todayStr = wib.todayStr;
    const timeStr = wib.timeStr; // HH:mm:ss in WIB
    const nowIso = wib.isoStr;
    const currentMinutes = wib.totalMinutes;

    // Aturan Presensi Pulang KPU: Hanya dapat dilakukan sampai pukul 23.59 WIB
    const maxCheckOutMinutes = 23 * 60 + 59; // 23:59 WIB = 1439 menit
    if (currentMinutes > maxCheckOutMinutes) {
      throw new Error('Waktu presensi pulang telah berakhir. Presensi pulang hanya dapat dilakukan sampai pukul 23.59 WIB.');
    }

    let existing = queryOne<{
      id: string;
      jam_masuk: string;
      jam_pulang: string;
      metode_kerja: string;
      keterlambatan_menit?: number;
      jam_pulang_wajib?: string;
      status_ganti_jam?: string;
      emergency_reason?: string;
      status?: string;
      approval_status?: string;
    }>(
      db,
      'SELECT id, jam_masuk, jam_pulang, metode_kerja, keterlambatan_menit, jam_pulang_wajib, status_ganti_jam, emergency_reason, status, approval_status FROM attendance WHERE employee_id = ? AND tanggal = ?',
      [employeeId, todayStr]
    );

    // Fallback: If not found by exact string, also check any attendance record created today for this employee
    if (!existing) {
      const fallbackToday = queryOne<any>(
        db,
        'SELECT id, jam_masuk, jam_pulang, metode_kerja, keterlambatan_menit, jam_pulang_wajib, status_ganti_jam, emergency_reason, status, approval_status FROM attendance WHERE employee_id = ? AND (tanggal = ? OR id LIKE ?)',
        [employeeId, todayStr, `%${employeeId}_${todayStr}%`]
      );
      if (fallbackToday) {
        existing = fallbackToday;
      }
    }

    const isReCheckOut = Boolean(existing && existing.jam_pulang);

    const schedule = queryOne<{ jam_masuk: string; jam_pulang: string }>(
      db,
      'SELECT jam_masuk, jam_pulang FROM work_schedules WHERE is_active = 1 LIMIT 1'
    ) || {
      jam_masuk: '07:30:00',
      jam_pulang: '16:00:00'
    };

    const schedInMinutes = parseTimeToMinutes(schedule.jam_masuk);
    const schedOutMinutes = parseTimeToMinutes(schedule.jam_pulang);
    const inMinutes = existing?.jam_masuk ? parseTimeToMinutes(existing.jam_masuk) : null;

    // Hitung keterlambatan kedatangan (jika ada jam masuk)
    const lateMinutes = inMinutes !== null
      ? (typeof existing?.keterlambatan_menit === 'number' && existing.keterlambatan_menit > 0
          ? existing.keterlambatan_menit
          : Math.max(0, inMinutes - schedInMinutes))
      : 0;

    // Hitung target jam pulang wajib sesuai aturan penggantian jam keterlambatan
    const requiredOutMinutes = existing?.jam_pulang_wajib
      ? parseTimeToMinutes(existing.jam_pulang_wajib)
      : schedOutMinutes + lateMinutes;
    
    const requiredOutStr = minutesToTimeStr(requiredOutMinutes);

    // Evaluasi aturan penggantian jam keterlambatan / tanpa absen masuk / pulang sebelum waktunya (PSW):
    let statusGantiJam = inMinutes === null ? 'potong_tukin' : 'tidak_perlu';
    let isPotongTukin = inMinutes === null;
    let kurangMenit = 0;
    let pesanGantiJam = inMinutes === null ? 'Presensi pulang tercatat tanpa presensi masuk pagi.' : '';

    if (inMinutes !== null) {
      if (currentMinutes < requiredOutMinutes) {
        kurangMenit = requiredOutMinutes - currentMinutes;
        statusGantiJam = 'potong_tukin';
        isPotongTukin = true;
        if (lateMinutes > 0) {
          pesanGantiJam = `Pulang sebelum memenuhi jam penggantian keterlambatan (kurang ${kurangMenit} menit dari jadwal minimal ${requiredOutStr.substring(0, 5)} WIB). Tunjangan Kinerja (Tukin) dikenakan pemotongan PSW.`;
        } else {
          pesanGantiJam = `Pulang sebelum waktunya (kurang ${kurangMenit} menit dari jadwal kerja normal ${requiredOutStr.substring(0, 5)} WIB). Tunjangan Kinerja (Tukin) dikenakan pemotongan PSW (Pulang Sebelum Waktu).`;
        }
      } else {
        statusGantiJam = lateMinutes > 0 ? 'terpenuhi' : 'tidak_perlu';
        pesanGantiJam = lateMinutes > 0 ? 'Kewajiban jam penggantian keterlambatan telah terpenuhi secara tuntas.' : 'Presensi pulang tercatat sesuai jadwal dinas kantor KPU.';
      }
    }

    const office = getActiveOfficeLocation(db);
    const distanceMeters = calculateDistanceInMeters(
      latitude,
      longitude,
      office.latitude,
      office.longitude
    );

    const workMethod = existing ? (existing.metode_kerja || 'WFO') : getWorkMethodForEmployee(db, employeeId, todayStr);
    let cleanEmergencyReason = existing?.emergency_reason || null;

    // Untuk presensi pulang: Catat jarak dan alasan tanpa melempar error agar presensi selalu berhasil tercatat
    if (workMethod === 'WFO' && distanceMeters > office.radius_meter) {
      if (emergencyReason && emergencyReason.trim().length > 0) {
        cleanEmergencyReason = cleanEmergencyReason 
          ? `${cleanEmergencyReason} | Pulang: ${emergencyReason.trim()}`
          : `Pulang di luar radius: ${emergencyReason.trim()}`;
      } else {
        cleanEmergencyReason = cleanEmergencyReason 
          ? `${cleanEmergencyReason} | Pulang di luar radius (${distanceMeters}m)`
          : `Pulang di luar radius (${distanceMeters}m dari kantor KPU)`;
      }
    }

    const attId = existing ? existing.id : `att_${todayStr.replace(/-/g, '')}_${employeeId}`;
    const approvalStatus = distanceMeters <= office.radius_meter ? 'approved' : 'pending';

    if (!existing) {
      executeSql(
        db,
        `INSERT INTO attendance (
          id, employee_id, tanggal, jam_masuk, jam_pulang, foto_masuk, foto_pulang,
          latitude_masuk, longitude_masuk, latitude_pulang, longitude_pulang,
          jarak_dari_kantor, status_validasi_lokasi,
          status, metode_kerja, keterlambatan_menit, jam_pulang_wajib, status_ganti_jam,
          is_emergency_checkin, emergency_reason, approval_status,
          device_info, created_at, updated_at
        ) VALUES (?, ?, ?, NULL, ?, NULL, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          attId,
          employeeId,
          todayStr,
          timeStr,
          photoBase64,
          latitude,
          longitude,
          distanceMeters,
          distanceMeters <= office.radius_meter ? 'tervalidasi' : 'luar_radius',
          'Hadir (Tanpa Presensi Masuk)',
          workMethod,
          0,
          requiredOutStr,
          statusGantiJam,
          distanceMeters > office.radius_meter ? 1 : 0,
          cleanEmergencyReason,
          approvalStatus,
          deviceInfo,
          nowIso,
          nowIso
        ]
      );
    } else {
      executeSql(
        db,
        `UPDATE attendance SET
          jam_pulang = ?,
          foto_pulang = ?,
          latitude_pulang = ?,
          longitude_pulang = ?,
          status = CASE WHEN status = 'TK' OR status IS NULL OR status = '' THEN 'Hadir (Tanpa Presensi Masuk)' ELSE status END,
          status_validasi_lokasi = CASE WHEN ? <= ? THEN status_validasi_lokasi ELSE 'luar_radius' END,
          approval_status = CASE WHEN approval_status = 'approved' THEN 'approved' WHEN ? <= ? THEN 'approved' ELSE 'pending' END,
          keterlambatan_menit = ?,
          jam_pulang_wajib = ?,
          status_ganti_jam = ?,
          emergency_reason = ?,
          updated_at = ?
         WHERE id = ?`,
        [
          timeStr,
          photoBase64,
          latitude,
          longitude,
          distanceMeters,
          office.radius_meter,
          distanceMeters,
          office.radius_meter,
          lateMinutes,
          requiredOutStr,
          statusGantiJam,
          cleanEmergencyReason,
          nowIso,
          existing.id
        ]
      );
    }

    const photoId = `photo_out_${attId}`;
    executeSql(
      db,
      'INSERT OR REPLACE INTO attendance_photos (id, attendance_id, type, photo_data, created_at) VALUES (?, ?, ?, ?, ?)',
      [photoId, attId, 'pulang', photoBase64, nowIso]
    );

    // Kirim notifikasi sistem jika dikenakan konsekuensi potong tukin
    if (isPotongTukin) {
      const user = queryOne<{ id: string }>(
        db,
        'SELECT id FROM users WHERE employee_id = ? LIMIT 1',
        [employeeId]
      );
      if (user) {
        createNotification(
          db,
          user.id,
          'Peringatan Pemotongan Tukin',
          `Anda melakukan presensi pulang pukul ${timeStr.substring(0, 5)} WIB sebelum jam wajib pengganti (${requiredOutStr.substring(0, 5)} WIB, kurang ${kurangMenit} menit). Tunjangan Kinerja (Tukin) dikenakan pemotongan.`,
          'warning',
          '/dashboard'
        );
      }
    }

    const emp = queryOne<{ nama_lengkap: string }>(db, 'SELECT nama_lengkap FROM employees WHERE id = ?', [employeeId]);
    createAuditLog(
      db,
      null,
      emp?.nama_lengkap || employeeId,
      'ATTENDANCE_CHECK_OUT',
      'ATTENDANCE',
      null,
      JSON.stringify({
        jam_pulang: timeStr,
        distanceMeters,
        keterlambatan_menit: lateMinutes,
        jam_pulang_wajib: requiredOutStr,
        status_ganti_jam: statusGantiJam,
        is_potong_tukin: isPotongTukin,
        kurang_menit: kurangMenit,
        is_emergency: !!isEmergency
      }),
      ipAddress
    );

    const fullRecord = queryOne<any>(db, 'SELECT * FROM attendance WHERE id = ?', [attId]);

    return {
      success: true,
      id: attId,
      attendance: fullRecord,
      tanggal: todayStr,
      jam_masuk: fullRecord?.jam_masuk || existing?.jam_masuk || null,
      jam_pulang: timeStr,
      status: fullRecord?.status || 'Hadir',
      jarak_dari_kantor: distanceMeters,
      keterlambatan_menit: lateMinutes,
      jam_pulang_wajib: requiredOutStr,
      status_ganti_jam: statusGantiJam,
      is_potong_tukin: isPotongTukin,
      kurang_menit: kurangMenit,
      pesan_ganti_jam: pesanGantiJam
    };
  });
}

export function deleteAttendanceRecord(db: Database, attendanceId: string, adminId: string) {
  return runTransaction(db, () => {
    const att = queryOne<any>(db, 'SELECT * FROM attendance WHERE id = ?', [attendanceId]);
    if (!att) {
      throw new Error('Data presensi tidak ditemukan atau sudah dihapus.');
    }

    const emp = queryOne<{ nama_lengkap: string }>(
      db,
      'SELECT nama_lengkap FROM employees WHERE id = ?',
      [att.employee_id]
    );

    executeSql(db, 'DELETE FROM attendance_photos WHERE attendance_id = ?', [attendanceId]);
    executeSql(db, 'DELETE FROM attendance WHERE id = ?', [attendanceId]);

    // Send notification to employee
    const user = queryOne<{ id: string }>(
      db,
      'SELECT id FROM users WHERE employee_id = ? LIMIT 1',
      [att.employee_id]
    );
    if (user) {
      createNotification(
        db,
        user.id,
        'Presensi Dihapus oleh Admin',
        `Data presensi Anda pada tanggal ${att.tanggal} telah dihapus oleh Admin/SDM. Anda dapat melakukan absensi ulang sekarang.`,
        'info',
        '/dashboard'
      );
    }

    createAuditLog(
      db,
      adminId,
      'Admin',
      'DELETE_ATTENDANCE',
      'ATTENDANCE',
      null,
      JSON.stringify({
        attendanceId,
        employeeId: att.employee_id,
        nama_lengkap: emp?.nama_lengkap,
        tanggal: att.tanggal,
        jam_masuk: att.jam_masuk,
        jam_pulang: att.jam_pulang
      })
    );

    return {
      success: true,
      message: `Data presensi ${emp?.nama_lengkap || 'pegawai'} tanggal ${att.tanggal} berhasil dihapus. Pegawai dapat melakukan absensi ulang.`
    };
  });
}

export function recordManualAttendance(
  db: Database,
  payload: {
    employeeId: string;
    tanggal: string;
    jamMasuk?: string;
    jamPulang?: string;
    mode?: 'keduanya' | 'masuk_saja' | 'pulang_saja';
    status?: string;
    metodeKerja?: string;
    catatan?: string;
  },
  adminUserId: string
) {
  return runTransaction(db, () => {
    const { employeeId, tanggal, mode = 'keduanya' } = payload;
    if (!employeeId || !tanggal) {
      throw new Error('ID Pegawai dan Tanggal wajib diisi.');
    }

    const emp = queryOne<{ id: string; nama_lengkap: string }>(
      db,
      'SELECT id, nama_lengkap FROM employees WHERE id = ?',
      [employeeId]
    );
    if (!emp) {
      throw new Error('Data pegawai tidak ditemukan.');
    }

    const schedule = queryOne<{ jam_masuk: string; jam_pulang: string }>(
      db,
      'SELECT jam_masuk, jam_pulang FROM work_schedules WHERE is_active = 1 LIMIT 1'
    ) || {
      jam_masuk: '07:30:00',
      jam_pulang: '16:00:00'
    };

    const schedInMinutes = parseTimeToMinutes(schedule.jam_masuk);
    const schedOutMinutes = parseTimeToMinutes(schedule.jam_pulang);

    const existing = queryOne<{
      id: string;
      jam_masuk?: string;
      jam_pulang?: string;
      keterlambatan_menit?: number;
      jam_pulang_wajib?: string;
      status_ganti_jam?: string;
      status?: string;
      metode_kerja?: string;
    }>(
      db,
      'SELECT id, jam_masuk, jam_pulang, keterlambatan_menit, jam_pulang_wajib, status_ganti_jam, status, metode_kerja FROM attendance WHERE employee_id = ? AND tanggal = ?',
      [employeeId, tanggal]
    );

    // Format jam masuk and jam pulang
    let jamMasuk: string | null = null;
    let inMinutes: number | null = null;
    if (payload.jamMasuk && payload.jamMasuk.trim()) {
      const parts = payload.jamMasuk.trim().split(':');
      const h = String(parts[0] || '07').padStart(2, '0');
      const m = String(parts[1] || '30').padStart(2, '0');
      const s = String(parts[2] || '00').padStart(2, '0');
      jamMasuk = `${h}:${m}:${s}`;
      inMinutes = parseTimeToMinutes(jamMasuk);
    }

    let jamPulang: string | null = null;
    let outMinutes: number | null = null;
    if (payload.jamPulang && payload.jamPulang.trim()) {
      const parts = payload.jamPulang.trim().split(':');
      const h = String(parts[0] || '16').padStart(2, '0');
      const m = String(parts[1] || '00').padStart(2, '0');
      const s = String(parts[2] || '00').padStart(2, '0');
      jamPulang = `${h}:${m}:${s}`;
      outMinutes = parseTimeToMinutes(jamPulang);
    }

    // Tentukan nilai efektif jam masuk & jam pulang untuk kalkulasi
    const effectiveJamMasuk = mode === 'pulang_saja' 
      ? (existing?.jam_masuk || null)
      : (jamMasuk || existing?.jam_masuk || null);
    
    const effectiveInMinutes = effectiveJamMasuk ? parseTimeToMinutes(effectiveJamMasuk) : null;

    const effectiveJamPulang = mode === 'masuk_saja'
      ? (existing?.jam_pulang || null)
      : (jamPulang || existing?.jam_pulang || null);

    const effectiveOutMinutes = effectiveJamPulang ? parseTimeToMinutes(effectiveJamPulang) : null;

    // Hitung keterlambatan berdasarkan effective jam masuk
    let lateMinutes = 0;
    if (effectiveInMinutes !== null) {
      lateMinutes = Math.max(0, effectiveInMinutes - schedInMinutes);
    } else if (existing?.keterlambatan_menit) {
      lateMinutes = existing.keterlambatan_menit;
    }

    const requiredOutMinutes = schedOutMinutes + lateMinutes;
    const requiredOutStr = minutesToTimeStr(requiredOutMinutes);

    // Hitung status jika tidak dispesifikasikan secara manual
    let finalStatus = payload.status;
    if (!finalStatus || finalStatus === 'Otomatis' || finalStatus === 'auto') {
      if (effectiveInMinutes !== null) {
        finalStatus = lateMinutes > 0 ? 'Terlambat' : 'Hadir';
      } else if (effectiveJamPulang !== null) {
        finalStatus = 'Hadir (Tanpa Presensi Masuk)';
      } else {
        finalStatus = existing?.status || 'Hadir';
      }
    }

    // Status ganti jam
    let statusGantiJam = 'tidak_perlu';
    if (effectiveInMinutes === null && effectiveJamPulang !== null) {
      statusGantiJam = 'potong_tukin';
    } else if (lateMinutes > 0) {
      if (effectiveOutMinutes !== null) {
        statusGantiJam = effectiveOutMinutes >= requiredOutMinutes ? 'terpenuhi' : 'potong_tukin';
      } else {
        statusGantiJam = 'menunggu';
      }
    }

    const workMethod = payload.metodeKerja || existing?.metode_kerja || 'WFO';
    const catatan = payload.catatan || 'Ditambahkan secara manual oleh Administrator/SDM';
    const nowIso = new Date().toISOString();

    const attId = existing ? existing.id : `att_manual_${tanggal.replace(/-/g, '')}_${employeeId}`;

    if (existing) {
      const newJamMasuk = mode === 'pulang_saja' ? (existing.jam_masuk || null) : (jamMasuk ?? existing.jam_masuk ?? null);
      const newJamPulang = mode === 'masuk_saja' ? (existing.jam_pulang || null) : (jamPulang ?? existing.jam_pulang ?? null);

      executeSql(
        db,
        `UPDATE attendance SET
          jam_masuk = ?,
          jam_pulang = ?,
          status = ?,
          metode_kerja = ?,
          keterlambatan_menit = ?,
          jam_pulang_wajib = ?,
          status_ganti_jam = ?,
          status_validasi_lokasi = 'manual_admin',
          approval_status = 'approved',
          approved_by = ?,
          approved_at = ?,
          approval_note = ?,
          emergency_reason = ?,
          updated_at = ?
         WHERE id = ?`,
        [
          newJamMasuk,
          newJamPulang,
          finalStatus,
          workMethod,
          lateMinutes,
          requiredOutStr,
          statusGantiJam,
          adminUserId,
          nowIso,
          catatan,
          catatan,
          nowIso,
          existing.id
        ]
      );
    } else {
      const finalJamMasuk = mode === 'pulang_saja' ? null : jamMasuk;
      const finalJamPulang = mode === 'masuk_saja' ? null : jamPulang;

      executeSql(
        db,
        `INSERT INTO attendance (
          id, employee_id, tanggal, jam_masuk, jam_pulang, foto_masuk, foto_pulang,
          latitude_masuk, longitude_masuk, latitude_pulang, longitude_pulang,
          jarak_dari_kantor, status_validasi_lokasi, status, metode_kerja,
          keterlambatan_menit, jam_pulang_wajib, status_ganti_jam,
          is_emergency_checkin, emergency_reason, approval_status, approved_by, approved_at, approval_note,
          device_info, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, NULL, NULL,
          -2.069272, 101.403224, -2.069272, 101.403224,
          0, 'manual_admin', ?, ?,
          ?, ?, ?,
          0, ?, 'approved', ?, ?, ?,
          'Input Manual Admin', ?, ?
        )`,
        [
          attId,
          employeeId,
          tanggal,
          finalJamMasuk,
          finalJamPulang,
          finalStatus,
          workMethod,
          lateMinutes,
          requiredOutStr,
          statusGantiJam,
          catatan,
          adminUserId,
          nowIso,
          catatan,
          nowIso,
          nowIso
        ]
      );
    }

    createAuditLog(
      db,
      adminUserId,
      'ADMIN',
      'ATTENDANCE_MANUAL_RECORD',
      'ATTENDANCE',
      null,
      `Input presensi manual (${mode}) untuk ${emp.nama_lengkap} tanggal ${tanggal}: Masuk=${effectiveJamMasuk || '-'}, Pulang=${effectiveJamPulang || '-'}, Status=${finalStatus}. Catatan: ${catatan}`
    );

    // Kirim notifikasi ke pegawai yang bersangkutan
    const user = queryOne<{ id: string }>(
      db,
      'SELECT id FROM users WHERE employee_id = ? LIMIT 1',
      [employeeId]
    );
    if (user) {
      createNotification(
        db,
        user.id,
        'Presensi Ditambahkan Manual oleh Admin',
        `Admin telah menambahkan/menyesuaikan absensi Anda untuk tanggal ${tanggal} (${finalStatus}). Jam Masuk: ${effectiveJamMasuk?.substring(0, 5) || '-'} WIB, Jam Pulang: ${effectiveJamPulang?.substring(0, 5) || '-'} WIB. Catatan: ${catatan}`,
        'info',
        '/riwayat-absensi'
      );
    }

    let detailMsg = '';
    if (mode === 'masuk_saja') {
      detailMsg = ` (Jam Masuk: ${effectiveJamMasuk?.substring(0, 5) || '-'} WIB)`;
    } else if (mode === 'pulang_saja') {
      detailMsg = ` (Jam Pulang: ${effectiveJamPulang?.substring(0, 5) || '-'} WIB)`;
    } else {
      detailMsg = ` (Masuk: ${effectiveJamMasuk?.substring(0, 5) || '-'} WIB, Pulang: ${effectiveJamPulang?.substring(0, 5) || '-'} WIB)`;
    }

    return {
      success: true,
      id: attId,
      message: `Presensi manual untuk ${emp.nama_lengkap} pada tanggal ${tanggal}${detailMsg} berhasil disimpan.`
    };
  });
}

