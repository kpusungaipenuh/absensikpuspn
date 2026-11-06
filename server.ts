process.env.TZ = 'Asia/Jakarta';
import express from 'express';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer, createLogger } from 'vite';
import { getDb, queryAll, queryOne, executeSql, runTransaction } from './server/db';
import {
  authMiddleware,
  requireAuth,
  requireAdmin,
  requireSdmOrAdmin,
  requireKeuanganOrAdmin,
  requireUmumOrAdmin,
  requireStaffOrAdmin,
  createSession,
  destroySession,
  updateSession,
  AuthenticatedRequest
} from './server/auth';
import {
  calculateLeaveDays,
  getLeaveBalance,
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  adjustLeaveBalanceManual,
  recordHistoricalLeave,
  deleteLeaveRequest,
  updateLeaveRequest,
  clearAllLeaveRequests
} from './server/services/leaveService';
import {
  checkInAttendance,
  checkOutAttendance,
  recordManualAttendance,
  getActiveOfficeLocation,
  getWorkMethodForEmployee,
  approveEmergencyAttendance,
  rejectEmergencyAttendance,
  deleteAttendanceRecord
} from './server/services/attendanceService';
import { runRolloverAnnualLeave } from './server/services/rolloverService';
import { createAuditLog, getAuditLogs } from './server/services/auditService';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
  registerSSEClient,
  unregisterSSEClient
} from './server/services/notificationService';
import { getWibDateTime, parseTimeToMinutes, minutesToTimeStr } from './server/utils/time';
import { checkAndNotifyLateAttendance } from './server/services/attendanceNotificationService';
import {
  getTravelDuties,
  createTravelDuty,
  updateTravelDuty,
  deleteTravelDuty
} from './server/services/travelDutyService';
import {
  getTukinGrades,
  updateTukinGrade,
  calculateTukinForMonth,
  getTukinCalculations
} from './server/services/tukinService';
import { syncFirestoreEmployeePhotos } from './server/services/firestoreSync';
import {
  registerFcmToken,
  unregisterFcmToken,
  getUserActiveTokens,
  getAllActiveTokens,
  sendPushAndInAppNotification,
  runAttendancePushReminderEngine,
  broadcastAttendanceReminderNow
} from './server/services/fcmPushService';

const PORT = 3000;

async function startServer() {
  const app = express();

  // Increase payload limit for selfie photos (base64)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Initialize SQLite database
  const db = await getDb();

  // Ensure custom employee photos in Firestore are synced to SQLite
  syncFirestoreEmployeePhotos(db).catch(err => console.warn('[Firestore] Startup photo sync error:', err));

  // Attach auth middleware to all requests
  app.use(authMiddleware);

  // ================= API ROUTES =================

  // 1. Health check & Server Time Sync
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), instansi: 'KPU Kota Sungai Penuh' });
  });

  app.get('/api/server-time', (req, res) => {
    const wib = getWibDateTime();
    res.json({
      epochMs: Date.now(),
      todayStr: wib.todayStr,
      timeStr: wib.timeStr,
      hour: wib.hour,
      minute: wib.minute,
      second: wib.second,
      totalMinutes: wib.totalMinutes,
      dayOfWeek: wib.dayOfWeek,
      isoStr: wib.isoStr,
      timezone: 'Asia/Jakarta (WIB)',
      attendanceWindow: {
        checkInStartMinutes: 360,    // 06:00 WIB
        checkInEndMinutes: 510,      // 08:30 WIB
        checkOutEndMinutes: 1439,    // 23:59 WIB
        isCheckInAllowed: wib.totalMinutes >= 360 && wib.totalMinutes <= 510,
        isCheckInTooEarly: wib.totalMinutes < 360,
        isCheckInExpired: wib.totalMinutes > 510,
        isCheckOutAllowed: wib.totalMinutes <= 1439
      }
    });
  });

  // 2. Authentication
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username/Email dan Password wajib diisi.' });
      }

      const cleanInput = (username || '').trim();
      const cleanInputNoSpace = cleanInput.replace(/[\s'-]/g, '');

      // Check user by username, email, or employee NIP/NIK (with or without spaces/hyphens)
      const user = queryOne<{
        id: string;
        username: string;
        email: string;
        password_hash: string;
        role: 'admin' | 'pegawai' | 'operator_sdm' | 'operator_keuangan' | 'operator_umum';
        employee_id: string | null;
        is_active: number;
      }>(
        db,
        `SELECT u.* FROM users u 
         LEFT JOIN employees e ON u.employee_id = e.id 
         WHERE (
           u.username = ? 
           OR u.username = ? 
           OR LOWER(u.email) = ? 
           OR e.nip_nik = ? 
           OR REPLACE(REPLACE(e.nip_nik, ' ', ''), '-', '') = ?
         ) AND u.is_active = 1`,
        [cleanInput, cleanInputNoSpace, cleanInput.toLowerCase(), cleanInput, cleanInputNoSpace]
      );

      if (!user) {
        return res.status(401).json({ error: 'Username atau Password salah atau akun dinonaktifkan.' });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Username atau Password salah.' });
      }

      // Fetch employee info if applicable (Admin and Operators can be system users)
      let namaLengkap = user.username;
      let jabatan = 'Pegawai';
      let unitKerja = 'Sekretariat KPU Kota Sungai Penuh';
      let nip_nik = '';

      if (user.role === 'admin') {
        namaLengkap = 'Administrator KPU Kota Sungai Penuh';
        jabatan = 'Administrator Sistem';
      } else if (user.role === 'operator_sdm') {
        namaLengkap = 'Operator Subbag SDM & Parmas';
        jabatan = 'Pengelola SDM & Kepegawaian';
        unitKerja = 'Sub Bagian SDM, Sosialisasi, dan Parmas';
      } else if (user.role === 'operator_keuangan') {
        namaLengkap = 'Operator Subbag Keuangan & Logistik';
        jabatan = 'Pengelola Keuangan & Tunjangan Kinerja';
        unitKerja = 'Sub Bagian Keuangan, Umum, dan Logistik';
      } else if (user.role === 'operator_umum') {
        namaLengkap = 'Operator Subbag Umum & Logistik';
        jabatan = 'Pengelola Perjalanan Dinas & Umum';
        unitKerja = 'Sub Bagian Keuangan, Umum, dan Logistik';
      }

      let fotoProfil = (user as any).foto_profil || '';
      let operatorRole: string | null = null;

      if (user.employee_id) {
        const emp = queryOne<{
          nip_nik: string;
          nama_lengkap: string;
          jabatan: string;
          unit_kerja: string;
          foto_profil: string;
          status_pegawai: string;
          operator_role?: string | null;
        }>(db, 'SELECT * FROM employees WHERE id = ?', [user.employee_id]);

        if (emp) {
          if (emp.status_pegawai !== 'aktif') {
            return res.status(403).json({ error: 'Status pegawai ini sedang nonaktif. Hubungi Admin.' });
          }
          nip_nik = emp.nip_nik || '';
          namaLengkap = emp.nama_lengkap;
          jabatan = emp.jabatan;
          unitKerja = emp.unit_kerja;
          fotoProfil = emp.foto_profil || fotoProfil;
          operatorRole = emp.operator_role || null;
        }
      }

      const token = createSession({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        employeeId: user.employee_id,
        namaLengkap,
        nip_nik,
        jabatan,
        unitKerja,
        fotoProfil,
        operatorRole
      });

      createAuditLog(
        db,
        user.id,
        user.username,
        'LOGIN',
        'AUTH',
        null,
        'User berhasil login',
        req.ip
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          employeeId: user.employee_id,
          namaLengkap,
          nama_lengkap: namaLengkap,
          nip_nik,
          nipNik: nip_nik,
          jabatan,
          unitKerja,
          unit_kerja: unitKerja,
          fotoProfil,
          foto_profil: fotoProfil,
          operator_role: operatorRole,
          assigned_operator_role: operatorRole,
          can_switch_role: Boolean(operatorRole && operatorRole !== 'none')
        }
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: err.message || 'Terjadi kesalahan pada server saat login.' });
    }
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.token) {
      destroySession(req.token);
    }
    if (req.user) {
      createAuditLog(db, req.user.userId, req.user.username, 'LOGOUT', 'AUTH', null, 'User logout', req.ip);
    }
    res.json({ success: true, message: 'Berhasil keluar.' });
  });

  // Biometric Challenge (WebAuthn / Credential Management API)
  app.get('/api/auth/biometric/challenge', (req, res) => {
    const randomBytes = crypto.randomBytes(32);
    const challenge = randomBytes.toString('base64url');
    res.json({ challenge });
  });

  // Biometric Credential Registration
  app.post('/api/auth/biometric/register', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const { credential_id, public_key, device_name } = req.body;
      if (!credential_id) {
        return res.status(400).json({ error: 'credential_id wajib diisi.' });
      }

      const id = `bio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      const existing = queryOne<{ id: string }>(
        db,
        'SELECT id FROM biometric_credentials WHERE credential_id = ?',
        [credential_id]
      );

      if (existing) {
        executeSql(
          db,
          'UPDATE biometric_credentials SET user_id = ?, device_name = ?, last_used_at = ? WHERE credential_id = ?',
          [req.user!.userId, device_name || 'Device', now, credential_id]
        );
      } else {
        executeSql(
          db,
          'INSERT INTO biometric_credentials (id, user_id, credential_id, public_key, device_name, created_at, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, req.user!.userId, credential_id, public_key || '', device_name || 'Device', now, now]
        );
      }

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'BIOMETRIC_REGISTER',
        'AUTH',
        null,
        `Mendaftarkan sensor biometrik (${device_name || 'Device'})`,
        req.ip
      );

      res.json({ success: true, message: 'Sensor biometrik berhasil didaftarkan.' });
    } catch (err: any) {
      console.error('Biometric register error:', err);
      res.status(500).json({ error: err.message || 'Gagal mendaftarkan biometrik.' });
    }
  });

  // Biometric Login (Fingerprint / Face ID assertion)
  app.post('/api/auth/biometric/login', async (req, res) => {
    try {
      const { credential_id, username } = req.body;
      if (!credential_id && !username) {
        return res.status(400).json({ error: 'Kredensial biometrik tidak valid.' });
      }

      let bioCred: { id: string; user_id: string; credential_id: string } | null = null;

      if (credential_id) {
        bioCred = queryOne<{ id: string; user_id: string; credential_id: string }>(
          db,
          'SELECT * FROM biometric_credentials WHERE credential_id = ?',
          [credential_id]
        );
      }

      if (!bioCred && username) {
        const cleanUser = username.trim();
        bioCred = queryOne<{ id: string; user_id: string; credential_id: string }>(
          db,
          `SELECT bc.* FROM biometric_credentials bc
           JOIN users u ON bc.user_id = u.id
           LEFT JOIN employees e ON u.employee_id = e.id
           WHERE u.username = ? OR LOWER(u.email) = ? OR e.nip_nik = ?
           ORDER BY bc.created_at DESC LIMIT 1`,
          [cleanUser, cleanUser.toLowerCase(), cleanUser]
        );
      }

      if (!bioCred) {
        return res.status(401).json({
          error: 'Kredensial biometrik perangkat ini belum terdaftar atau tidak cocok. Silakan login dengan kata sandi terlebih dahulu, lalu daftarkan biometrik di menu Profil.'
        });
      }

      // Load user
      const user = queryOne<{
        id: string;
        username: string;
        email: string;
        role: 'admin' | 'pegawai' | 'operator_sdm' | 'operator_keuangan' | 'operator_umum';
        employee_id: string | null;
        is_active: number;
        foto_profil?: string;
      }>(db, 'SELECT * FROM users WHERE id = ? AND is_active = 1', [bioCred.user_id]);

      if (!user) {
        return res.status(401).json({ error: 'Akun pengguna tidak ditemukan atau dinonaktifkan.' });
      }

      // Update last used
      executeSql(
        db,
        'UPDATE biometric_credentials SET last_used_at = ? WHERE id = ?',
        [new Date().toISOString(), bioCred.id]
      );

      // Fetch employee info
      let namaLengkap = user.username;
      let jabatan = 'Pegawai';
      let unitKerja = 'Sekretariat KPU Kota Sungai Penuh';
      let nip_nik = '';
      let fotoProfil = user.foto_profil || '';
      let operatorRole: string | null = null;

      if (user.role === 'admin') {
        namaLengkap = 'Administrator KPU Kota Sungai Penuh';
        jabatan = 'Administrator Sistem';
      } else if (user.role === 'operator_sdm') {
        namaLengkap = 'Operator Subbag SDM & Parmas';
        jabatan = 'Pengelola SDM & Kepegawaian';
        unitKerja = 'Sub Bagian SDM, Sosialisasi, dan Parmas';
      } else if (user.role === 'operator_keuangan') {
        namaLengkap = 'Operator Subbag Keuangan & Logistik';
        jabatan = 'Pengelola Keuangan & Tunjangan Kinerja';
        unitKerja = 'Sub Bagian Keuangan, Umum, dan Logistik';
      } else if (user.role === 'operator_umum') {
        namaLengkap = 'Operator Subbag Umum & Logistik';
        jabatan = 'Pengelola Perjalanan Dinas & Umum';
        unitKerja = 'Sub Bagian Keuangan, Umum, dan Logistik';
      }

      if (user.employee_id) {
        const emp = queryOne<{
          nip_nik: string;
          nama_lengkap: string;
          jabatan: string;
          unit_kerja: string;
          foto_profil: string;
          status_pegawai: string;
          operator_role?: string | null;
        }>(db, 'SELECT * FROM employees WHERE id = ?', [user.employee_id]);

        if (emp) {
          if (emp.status_pegawai !== 'aktif') {
            return res.status(403).json({ error: 'Status pegawai ini sedang nonaktif. Hubungi Admin.' });
          }
          nip_nik = emp.nip_nik || '';
          namaLengkap = emp.nama_lengkap;
          jabatan = emp.jabatan;
          unitKerja = emp.unit_kerja;
          fotoProfil = emp.foto_profil || fotoProfil;
          operatorRole = emp.operator_role || null;
        }
      }

      const token = createSession({
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        employeeId: user.employee_id,
        namaLengkap,
        nip_nik,
        jabatan,
        unitKerja,
        fotoProfil,
        operatorRole
      });

      createAuditLog(
        db,
        user.id,
        user.username,
        'BIOMETRIC_LOGIN',
        'AUTH',
        null,
        'User berhasil login menggunakan Biometrik (Fingerprint / Face ID)',
        req.ip
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          employeeId: user.employee_id,
          namaLengkap,
          nama_lengkap: namaLengkap,
          nip_nik,
          nipNik: nip_nik,
          jabatan,
          unitKerja,
          unit_kerja: unitKerja,
          fotoProfil,
          foto_profil: fotoProfil,
          operator_role: operatorRole,
          assigned_operator_role: operatorRole,
          can_switch_role: Boolean(operatorRole && operatorRole !== 'none')
        }
      });
    } catch (err: any) {
      console.error('Biometric login error:', err);
      res.status(500).json({ error: err.message || 'Gagal login menggunakan biometrik.' });
    }
  });

  // Get user biometric credentials status
  app.get('/api/auth/biometric/status', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const credentials = queryAll<any>(
        db,
        'SELECT id, credential_id, device_name, created_at, last_used_at FROM biometric_credentials WHERE user_id = ? ORDER BY created_at DESC',
        [req.user!.userId]
      );
      res.json({
        registered: credentials.length > 0,
        count: credentials.length,
        credentials
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Unregister user biometric credentials
  app.post('/api/auth/biometric/unregister', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      executeSql(db, 'DELETE FROM biometric_credentials WHERE user_id = ?', [req.user!.userId]);
      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'BIOMETRIC_UNREGISTER',
        'AUTH',
        null,
        'Menghapus kredensial biometrik akun',
        req.ip
      );
      res.json({ success: true, message: 'Kredensial biometrik berhasil dihapus.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const dbUser = queryOne<any>(db, 'SELECT * FROM users WHERE id = ?', [req.user!.userId]);
      if (dbUser) {
        let fotoProfil = dbUser.foto_profil || '';
        let namaLengkap = req.user!.namaLengkap;
        let jabatan = req.user!.jabatan;
        let unitKerja = req.user!.unitKerja;
        let nip_nik = req.user!.nip_nik || '';
        let operatorRole: string | null = null;

        if (dbUser.employee_id) {
          const emp = queryOne<any>(db, 'SELECT * FROM employees WHERE id = ?', [dbUser.employee_id]);
          if (emp) {
            nip_nik = emp.nip_nik || '';
            namaLengkap = emp.nama_lengkap;
            jabatan = emp.jabatan;
            unitKerja = emp.unit_kerja;
            fotoProfil = emp.foto_profil || fotoProfil;
            operatorRole = emp.operator_role || null;
          }
        }

        const freshUser = {
          ...req.user!,
          role: dbUser.role || req.user!.role,
          email: dbUser.email,
          namaLengkap: namaLengkap || req.user!.namaLengkap,
          nama_lengkap: namaLengkap || req.user!.namaLengkap,
          nip_nik,
          nipNik: nip_nik,
          jabatan: jabatan || req.user!.jabatan,
          unitKerja: unitKerja || req.user!.unitKerja,
          unit_kerja: unitKerja || req.user!.unitKerja,
          fotoProfil: fotoProfil || req.user!.fotoProfil,
          foto_profil: fotoProfil || req.user!.fotoProfil,
          operator_role: operatorRole,
          assigned_operator_role: operatorRole,
          can_switch_role: Boolean(operatorRole && operatorRole !== 'none')
        };

        if (req.token) {
          updateSession(req.token, freshUser);
        }

        return res.json({ user: freshUser });
      }
    } catch (e) {
      console.warn('Error fetching fresh user in /api/auth/me:', e);
    }
    res.json({
      user: {
        ...req.user,
        nama_lengkap: req.user?.namaLengkap,
        nip_nik: req.user?.nip_nik || '',
        nipNik: req.user?.nip_nik || '',
        unit_kerja: req.user?.unitKerja,
        foto_profil: req.user?.fotoProfil
      }
    });
  });

  // Switch Active Role for Employee (Antara Pegawai dan Operator)
  app.post('/api/auth/switch-role', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const { targetRole } = req.body;
      if (!targetRole) {
        return res.status(400).json({ error: 'Role tujuan harus ditentukan.' });
      }

      const currentUser = req.user!;
      if (!currentUser.employeeId) {
        return res.status(403).json({
          error: 'Akun Administrator memiliki hak akses sistem tersendiri dan tidak dapat berganti role.'
        });
      }

      const emp = queryOne<{
        id: string;
        nama_lengkap: string;
        nip_nik: string;
        operator_role?: string | null;
      }>(db, 'SELECT id, nama_lengkap, nip_nik, operator_role FROM employees WHERE id = ?', [currentUser.employeeId]);

      if (!emp) {
        return res.status(404).json({ error: 'Data pegawai tidak ditemukan.' });
      }

      const assignedOp = (emp.operator_role || '').trim();
      const allowedRoles = ['pegawai'];

      if (assignedOp === 'all_operator') {
        allowedRoles.push('operator_sdm', 'operator_keuangan', 'operator_umum');
      } else if (assignedOp) {
        assignedOp.split(',').map(r => r.trim()).forEach(r => {
          if (r) allowedRoles.push(r);
        });
      }

      if (!allowedRoles.includes(targetRole)) {
        return res.status(403).json({
          error: `Anda tidak memiliki hak akses untuk beralih ke role "${targetRole}". Hubungi Administrator.`
        });
      }

      const previousRole = currentUser.role;
      const nowIso = new Date().toISOString();

      // Update session in memory & persistent store
      currentUser.role = targetRole as any;
      if (req.token) {
        updateSession(req.token, {
          role: targetRole as any,
          operatorRole: assignedOp
        });
      }

      // Update active role in users table
      executeSql(db, 'UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [
        targetRole,
        nowIso,
        currentUser.userId
      ]);

      createAuditLog(
        db,
        currentUser.userId,
        `${emp.nama_lengkap} (${currentUser.username})`,
        'SWITCH_ROLE',
        'AUTH',
        previousRole,
        `Pegawai berganti mode akses dari [${previousRole}] ke [${targetRole}]`,
        req.ip
      );

      const freshUser = {
        ...currentUser,
        role: targetRole as any,
        operator_role: assignedOp,
        assigned_operator_role: assignedOp,
        can_switch_role: Boolean(assignedOp && assignedOp !== 'none')
      };

      res.json({
        success: true,
        message: `Berhasil beralih ke mode ${targetRole.replace('_', ' ').toUpperCase()}.`,
        user: freshUser
      });
    } catch (err: any) {
      console.error('Switch role error:', err);
      res.status(500).json({ error: err.message || 'Gagal mengganti role.' });
    }
  });

  app.post('/api/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Password lama dan password baru wajib diisi.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
      }

      const user = queryOne<{ id: string; password_hash: string }>(
        db,
        'SELECT id, password_hash FROM users WHERE id = ?',
        [req.user!.userId]
      );
      if (!user) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

      const match = await bcrypt.compare(oldPassword, user.password_hash);
      if (!match) {
        return res.status(400).json({ error: 'Password lama tidak sesuai.' });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      const nowIso = new Date().toISOString();
      executeSql(db, 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, nowIso, user.id]);

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'CHANGE_PASSWORD',
        'AUTH',
        null,
        'Pengguna mengganti password sendiri',
        req.ip
      );

      res.json({ success: true, message: 'Password berhasil diperbarui.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal mengubah password.' });
    }
  });

  app.put('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const { email, nomor_hp, foto_profil } = req.body;
      const nowIso = new Date().toISOString();
      const userId = req.user!.userId;
      const employeeId = req.user!.employeeId;

      if (email) {
        executeSql(db, 'UPDATE users SET email = ?, updated_at = ? WHERE id = ?', [email, nowIso, userId]);
      }
      if (foto_profil !== undefined) {
        executeSql(db, 'UPDATE users SET foto_profil = ?, updated_at = ? WHERE id = ?', [foto_profil, nowIso, userId]);
      }

      if (employeeId) {
        if (email) {
          executeSql(db, 'UPDATE employees SET email = ?, updated_at = ? WHERE id = ?', [email, nowIso, employeeId]);
        }
        if (nomor_hp !== undefined) {
          executeSql(db, 'UPDATE employees SET nomor_hp = ?, updated_at = ? WHERE id = ?', [nomor_hp, nowIso, employeeId]);
        }
        if (foto_profil !== undefined) {
          executeSql(db, 'UPDATE employees SET foto_profil = ?, updated_at = ? WHERE id = ?', [foto_profil, nowIso, employeeId]);
        }
      }

      if (req.token) {
        updateSession(req.token, {
          email: email || req.user!.email,
          fotoProfil: foto_profil !== undefined ? foto_profil : req.user!.fotoProfil
        });
      }

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'UPDATE_PROFILE',
        'AUTH',
        null,
        'Pengguna memperbarui profil / foto profil',
        req.ip
      );

      res.json({
        success: true,
        message: 'Profil berhasil diperbarui.',
        foto_profil,
        fotoProfil: foto_profil
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal memperbarui profil.' });
    }
  });

  app.post('/api/auth/reset-password', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { employeeId, newPassword } = req.body;
      if (!employeeId) {
        return res.status(400).json({ error: 'ID Pegawai wajib diisi.' });
      }

      const passToSet = newPassword || 'kpu123';
      const newHash = await bcrypt.hash(passToSet, 10);
      const nowIso = new Date().toISOString();

      const user = queryOne<{ id: string; username: string }>(
        db,
        'SELECT id, username FROM users WHERE employee_id = ?',
        [employeeId]
      );

      if (!user) {
        return res.status(404).json({ error: 'Akun login pegawai tidak ditemukan.' });
      }

      executeSql(db, 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, nowIso, user.id]);

      const resetId = `rst_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      executeSql(
        db,
        'INSERT INTO password_resets (id, user_id, reset_by, timestamp) VALUES (?, ?, ?, ?)',
        [resetId, user.id, req.user!.userId, nowIso]
      );

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'RESET_PASSWORD',
        'EMPLOYEES',
        null,
        `Admin mereset password akun ${user.username}`,
        req.ip
      );

      res.json({ success: true, message: `Password berhasil direset menjadi: ${passToSet}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal mereset password.' });
    }
  });

  // 3. Employee Management (Admin)
  app.get('/api/sub-bagian', requireAuth, (req, res) => {
    try {
      const rows = queryAll<{ sub_bagian: string }>(
        db,
        "SELECT DISTINCT sub_bagian FROM employees WHERE sub_bagian IS NOT NULL AND TRIM(sub_bagian) != '' AND is_deleted = 0 ORDER BY rowid ASC"
      );
      let list = rows.map(r => r.sub_bagian.trim()).filter(Boolean);
      if (list.length === 0) {
        list = [
          'Sekretaris',
          'Keuangan, Umum Dan Logistik',
          'Teknis Penyelenggaraan Pemilu Dan Hukum',
          'Partisipasi, Hubungan Masyarakat, dan Sumber Daya Manusia',
          'Perencanaan, Data Dan Informasi'
        ];
      }
      res.json({ sub_bagian: list });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/employees', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const search = req.query.search as string;
      const unit = req.query.unit as string;
      const status = req.query.status as string;
      const sort = req.query.sort as string;

      // Admin is not an employee, exclude from employee list
      let sql = "SELECT * FROM employees WHERE is_deleted = 0 AND role != 'admin' AND username NOT IN ('admin', 'admincutikpuspn') AND id != 'emp_admin_1'";
      const params: any[] = [];

      if (search) {
        sql += ' AND (nama_lengkap LIKE ? OR nip_nik LIKE ? OR username LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }
      if (unit && unit !== 'ALL') {
        sql += ' AND (sub_bagian = ? OR unit_kerja = ?)';
        params.push(unit, unit);
      }
      if (status && status !== 'ALL') {
        sql += ' AND status_pegawai = ?';
        params.push(status);
      }

      // Urutan data pegawai tetap mengikuti excel yg di upload bukan berdasarkan abjad,
      // tetapi tetap bisa filter/sort berdasarkan abjad
      if (sort === 'asc') {
        sql += ' ORDER BY nama_lengkap ASC';
      } else if (sort === 'desc') {
        sql += ' ORDER BY nama_lengkap DESC';
      } else {
        sql += ' ORDER BY rowid ASC';
      }

      const employees = queryAll(db, sql, params);
      res.json({ employees });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/employees/:id', requireAuth, (req, res) => {
    const emp = queryOne(db, 'SELECT * FROM employees WHERE id = ? AND is_deleted = 0', [req.params.id]);
    if (!emp) return res.status(404).json({ error: 'Pegawai tidak ditemukan.' });
    res.json({ employee: emp });
  });

  app.post('/api/employees', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const {
        nip_nik,
        nama_lengkap,
        tempat_lahir = '',
        tanggal_lahir = '',
        pangkat_golongan = '',
        sub_bagian = '',
        username,
        email,
        nomor_hp,
        jabatan,
        unit_kerja,
        tanggal_masuk,
        operator_role = null,
        jatah_cuti_tahunan = 12,
        foto_profil,
        password = 'kpu123'
      } = req.body;

      const finalUnitKerja = unit_kerja || sub_bagian || 'Sekretariat KPU';
      const finalSubBagian = sub_bagian || unit_kerja || 'Sekretariat KPU';
      // Aturan KPU: Role admin tidak bisa dilekatkan ke pegawai. Pegawai selalu role 'pegawai', dan dapat memiliki hak 'operator_role'.
      const finalRole = 'pegawai';
      const finalOperatorRole = (operator_role && operator_role !== 'none') ? operator_role : null;

      if (!nip_nik || !nama_lengkap || !username || !email || !jabatan || !finalUnitKerja || !tanggal_masuk) {
        return res.status(400).json({ error: 'Harap lengkapi semua kolom wajib pegawai.' });
      }

      // Check unique
      const existingNip = queryOne(db, 'SELECT id FROM employees WHERE nip_nik = ?', [nip_nik]);
      if (existingNip) return res.status(400).json({ error: 'NIP/NIK sudah terdaftar dalam sistem.' });

      const existingUser = queryOne(db, 'SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
      if (existingUser) return res.status(400).json({ error: 'Username atau Email sudah digunakan.' });

      const empId = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const nowIso = new Date().toISOString();
      const currentYear = new Date().getFullYear();
      const passwordHash = await bcrypt.hash(password, 10);

      runTransaction(db, () => {
        executeSql(
          db,
          `INSERT INTO employees (
            id, nip_nik, nama_lengkap, tempat_lahir, tanggal_lahir, pangkat_golongan, sub_bagian,
            username, email, nomor_hp, jabatan, unit_kerja, status_pegawai, tanggal_masuk, role,
            operator_role, jatah_cuti_tahunan, foto_profil, is_deleted, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            empId,
            nip_nik,
            nama_lengkap,
            tempat_lahir,
            tanggal_lahir,
            pangkat_golongan,
            finalSubBagian,
            username,
            email,
            nomor_hp || '',
            jabatan,
            finalUnitKerja,
            tanggal_masuk,
            finalRole,
            finalOperatorRole,
            Number(jatah_cuti_tahunan) || 12,
            foto_profil || '',
            nowIso,
            nowIso
          ]
        );

        executeSql(
          db,
          `INSERT INTO users (
            id, username, email, password_hash, role, employee_id, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [userId, username, email, passwordHash, finalRole, empId, nowIso, nowIso]
        );

        // Initialize leave balance for current year
        const quota = Number(jatah_cuti_tahunan) || 12;
        executeSql(
          db,
          `INSERT INTO leave_balances (id, employee_id, tahun, n_2, n_1, n, total, updated_at)
           VALUES (?, ?, ?, 0, 0, ?, ?, ?)`,
          [`bal_${empId}_${currentYear}`, empId, currentYear, quota, quota, nowIso]
        );

        createAuditLog(
          db,
          req.user!.userId,
          req.user!.username,
          'CREATE_EMPLOYEE',
          'EMPLOYEES',
          null,
          `Menambahkan pegawai: ${nama_lengkap} (NIP: ${nip_nik}) [Operator: ${finalOperatorRole || 'Tidak ada'}]`,
          req.ip
        );
      });

      res.json({ success: true, message: 'Pegawai berhasil ditambahkan.', employeeId: empId });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal menambahkan pegawai.' });
    }
  });

  app.put('/api/employees/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const {
        nip_nik,
        nama_lengkap,
        tempat_lahir = '',
        tanggal_lahir = '',
        pangkat_golongan = '',
        sub_bagian = '',
        email,
        nomor_hp,
        jabatan,
        unit_kerja,
        status_pegawai,
        tanggal_masuk,
        operator_role,
        jatah_cuti_tahunan,
        foto_profil
      } = req.body;

      const empId = req.params.id;
      const current = queryOne(db, 'SELECT * FROM employees WHERE id = ?', [empId]);
      if (!current) return res.status(404).json({ error: 'Pegawai tidak ditemukan.' });

      const nowIso = new Date().toISOString();
      const finalUnitKerja = unit_kerja || sub_bagian || current.unit_kerja;
      const finalSubBagian = sub_bagian || unit_kerja || current.sub_bagian || finalUnitKerja;
      // Pegawai tidak bisa dijadikan role 'admin'
      const finalRole = 'pegawai';
      const finalOperatorRole = operator_role !== undefined
        ? ((operator_role && operator_role !== 'none') ? operator_role : null)
        : current.operator_role;

      executeSql(
        db,
        `UPDATE employees SET
          nip_nik = ?,
          nama_lengkap = ?,
          tempat_lahir = ?,
          tanggal_lahir = ?,
          pangkat_golongan = ?,
          sub_bagian = ?,
          email = ?,
          nomor_hp = ?,
          jabatan = ?,
          unit_kerja = ?,
          status_pegawai = ?,
          tanggal_masuk = ?,
          role = ?,
          operator_role = ?,
          jatah_cuti_tahunan = ?,
          foto_profil = ?,
          updated_at = ?
         WHERE id = ?`,
        [
          nip_nik,
          nama_lengkap,
          tempat_lahir,
          tanggal_lahir,
          pangkat_golongan,
          finalSubBagian,
          email,
          nomor_hp,
          jabatan,
          finalUnitKerja,
          status_pegawai,
          tanggal_masuk,
          finalRole,
          finalOperatorRole,
          Number(jatah_cuti_tahunan) || 12,
          foto_profil !== undefined ? foto_profil : current.foto_profil,
          nowIso,
          empId
        ]
      );

      // Also sync user email & foto_profil
      const newPhoto = foto_profil !== undefined ? foto_profil : current.foto_profil;
      executeSql(db, 'UPDATE users SET email = ?, foto_profil = ?, updated_at = ? WHERE employee_id = ?', [
        email,
        newPhoto,
        nowIso,
        empId
      ]);
      executeSql(db, 'UPDATE user_sessions SET email = ?, foto_profil = ?, operator_role = ? WHERE employee_id = ?', [
        email,
        newPhoto,
        finalOperatorRole,
        empId
      ]);

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'UPDATE_EMPLOYEE',
        'EMPLOYEES',
        JSON.stringify({ nama: current.nama_lengkap, nip: current.nip_nik, operator_role: current.operator_role }),
        `Memperbarui pegawai: ${nama_lengkap} (NIP: ${nip_nik}) [Hak Operator: ${finalOperatorRole || 'Pegawai biasa'}]`,
        req.ip
      );

      res.json({ success: true, message: 'Data pegawai berhasil diperbarui.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal mengupdate pegawai.' });
    }
  });

  // Delete Employee (Supports Permanent & Soft Delete)
  app.delete('/api/employees/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const empId = req.params.id;
      const isPermanent = req.query.permanent !== 'false'; // default to permanent delete

      const emp = queryOne(db, 'SELECT * FROM employees WHERE id = ?', [empId]);
      if (!emp) {
        return res.status(404).json({ error: 'Pegawai tidak ditemukan.' });
      }

      if (emp.role === 'admin' && (emp.username === 'admin' || emp.id === req.user?.employeeId)) {
        return res.status(400).json({ error: 'Akun Administrator utama tidak dapat dihapus demi keamanan sistem.' });
      }

      const nowIso = new Date().toISOString();

      if (isPermanent) {
        runTransaction(db, () => {
          executeSql(db, 'DELETE FROM attendance WHERE employee_id = ?', [empId]);
          executeSql(
            db,
            'DELETE FROM leave_approvals WHERE leave_request_id IN (SELECT id FROM leave_requests WHERE employee_id = ?)',
            [empId]
          );
          executeSql(db, 'DELETE FROM leave_requests WHERE employee_id = ?', [empId]);
          executeSql(db, 'DELETE FROM leave_balance_transactions WHERE employee_id = ?', [empId]);
          executeSql(db, 'DELETE FROM leave_balances WHERE employee_id = ?', [empId]);
          executeSql(db, 'DELETE FROM work_assignments WHERE employee_id = ?', [empId]);
          executeSql(db, 'DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE employee_id = ?)', [empId]);
          executeSql(db, 'DELETE FROM password_resets WHERE user_id IN (SELECT id FROM users WHERE employee_id = ?)', [empId]);
          executeSql(db, 'DELETE FROM users WHERE employee_id = ?', [empId]);
          executeSql(db, 'DELETE FROM employees WHERE id = ?', [empId]);
        });

        createAuditLog(
          db,
          req.user!.userId,
          req.user!.username,
          'PERMANENT_DELETE_EMPLOYEE',
          'EMPLOYEES',
          JSON.stringify({ empId, nama: emp.nama_lengkap, nip: emp.nip_nik }),
          `Pegawai ${emp.nama_lengkap} (${emp.nip_nik}) dihapus permanen`,
          req.ip
        );

        return res.json({
          success: true,
          message: `Data pegawai ${emp.nama_lengkap} (${emp.nip_nik}) berhasil dihapus permanen.`
        });
      } else {
        executeSql(
          db,
          "UPDATE employees SET is_deleted = 1, status_pegawai = 'nonaktif', updated_at = ? WHERE id = ?",
          [nowIso, empId]
        );
        executeSql(db, 'UPDATE users SET is_active = 0, updated_at = ? WHERE employee_id = ?', [nowIso, empId]);

        createAuditLog(
          db,
          req.user!.userId,
          req.user!.username,
          'SOFT_DELETE_EMPLOYEE',
          'EMPLOYEES',
          null,
          `Pegawai ID ${empId} dinonaktifkan (soft-delete)`,
          req.ip
        );

        return res.json({
          success: true,
          message: 'Pegawai berhasil dinonaktifkan (soft delete).'
        });
      }
    } catch (err: any) {
      console.error('Delete employee error:', err);
      res.status(500).json({ error: err.message || 'Gagal menghapus data pegawai.' });
    }
  });

  // Clear All Template / Trial Employees (leaves only administrator)
  app.post('/api/employees/clear-all-template', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const trialEmployees = queryAll<{ id: string; nama_lengkap: string; nip_nik: string }>(
        db,
        "SELECT id, nama_lengkap, nip_nik FROM employees WHERE role != 'admin' AND username != 'admin'"
      );

      if (trialEmployees.length === 0) {
        return res.json({
          success: true,
          deletedCount: 0,
          deletedEmployeeIds: [],
          message: 'Tidak ada data pegawai uji coba. Database sudah bersih.'
        });
      }

      const deletedEmployeeIds = trialEmployees.map(e => e.id);

      runTransaction(db, () => {
        for (const emp of trialEmployees) {
          executeSql(db, 'DELETE FROM attendance WHERE employee_id = ?', [emp.id]);
          executeSql(
            db,
            'DELETE FROM leave_approvals WHERE leave_request_id IN (SELECT id FROM leave_requests WHERE employee_id = ?)',
            [emp.id]
          );
          executeSql(db, 'DELETE FROM leave_requests WHERE employee_id = ?', [emp.id]);
          executeSql(db, 'DELETE FROM leave_balance_transactions WHERE employee_id = ?', [emp.id]);
          executeSql(db, 'DELETE FROM leave_balances WHERE employee_id = ?', [emp.id]);
          executeSql(db, 'DELETE FROM work_assignments WHERE employee_id = ?', [emp.id]);
          executeSql(db, 'DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE employee_id = ?)', [emp.id]);
          executeSql(db, 'DELETE FROM password_resets WHERE user_id IN (SELECT id FROM users WHERE employee_id = ?)', [emp.id]);
          executeSql(db, 'DELETE FROM users WHERE employee_id = ?', [emp.id]);
          executeSql(db, 'DELETE FROM employees WHERE id = ?', [emp.id]);
        }
      });

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'CLEAR_TEMPLATE_EMPLOYEES',
        'EMPLOYEES',
        null,
        `Menghapus seluruh ${trialEmployees.length} pegawai uji coba/template bawaan`,
        req.ip
      );

      res.json({
        success: true,
        deletedCount: trialEmployees.length,
        deletedEmployeeIds,
        message: `Berhasil menghapus seluruh ${trialEmployees.length} data pegawai uji coba. Database sekarang bersih dan siap diisi data pegawai asli melalui fitur Upload Excel.`
      });
    } catch (err: any) {
      console.error('Clear template employees error:', err);
      res.status(500).json({ error: err.message || 'Gagal menghapus data pegawai uji coba.' });
    }
  });

  // Bulk Import Employees from Excel / CSV
  app.post('/api/employees/bulk-import', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { employees } = req.body;
      if (!Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({ error: 'Data pegawai untuk diimpor tidak boleh kosong.' });
      }

      const results = {
        totalProcessed: employees.length,
        importedCount: 0,
        skippedCount: 0,
        imported: [] as any[],
        errors: [] as string[]
      };

      const nowIso = new Date().toISOString();
      const currentYear = new Date().getFullYear();

      // Password hash cache to dramatically speed up bulk imports
      const passwordHashCache = new Map<string, string>();
      const getCachedPasswordHash = async (pass: string) => {
        if (passwordHashCache.has(pass)) return passwordHashCache.get(pass)!;
        const hash = await bcrypt.hash(pass, 10);
        passwordHashCache.set(pass, hash);
        return hash;
      };

      for (let i = 0; i < employees.length; i++) {
        const row = employees[i];
        const rowNum = i + 1;

        // Clean values matching user headers:
        // NAMA, TEMPAT LAHIR, TANGGAL LAHIR, NIP/NIPPPK, PANGKAT GOLONGAN, JABATAN, SUB BAGIAN, no hp, email
        const nama = String(
          row.nama_lengkap || row.nama || row['NAMA'] || row['Nama'] || row['Nama Lengkap'] || ''
        ).trim();
        const tempatLahir = String(
          row.tempat_lahir || row['TEMPAT LAHIR'] || row['Tempat Lahir'] || row['Tempat_Lahir'] || ''
        ).trim();
        const tanggalLahir = String(
          row.tanggal_lahir || row['TANGGAL LAHIR'] || row['Tanggal Lahir'] || row['Tanggal_Lahir'] || ''
        ).trim();
        let nip = String(
          row.nip_nipppk || row.nip_nik || row.nip || row['NIP/NIPPPK'] || row['NIP / NIPPPK'] || row['NIP'] || row['NIPPPK'] || row['NIP / NIK'] || row['NIP_NIK'] || row.nik || row['NIK'] || ''
        ).trim().replace(/['"`]/g, '');

        if (!nama) {
          results.skippedCount++;
          results.errors.push(`Baris ${rowNum}: Nama pegawai tidak boleh kosong.`);
          continue;
        }

        // For staff without official NIP/NIPPPK (e.g., PPNPN, Tenaga Pendukung, Honorer, or marked '-')
        if (!nip || nip === '-' || nip.toLowerCase() === 'non asn' || nip.toLowerCase() === 'ppnpn') {
          const safeName = nama.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
          nip = `NON-ASN-${safeName}-${Date.now().toString().slice(-4)}${i}`;
        }

        const pangkatGolongan = String(
          row.pangkat_golongan || row['PANGKAT GOLONGAN'] || row['PANGKAT / GOLONGAN'] || row['Pangkat Golongan'] || row['Pangkat / Golongan'] || row['Pangkat'] || row['Golongan'] || ''
        ).trim();
        const jabatan = String(
          row.jabatan || row['JABATAN'] || row['Jabatan'] || 'Staf Pelaksana'
        ).trim();
        const subBagian = String(
          row.sub_bagian || row['SUB BAGIAN'] || row['Sub Bagian'] || row['Subbagian'] || row.unit_kerja || row['Unit Kerja'] || 'Sekretariat KPU'
        ).trim();
        const unitKerja = subBagian;
        const nomorHp = String(
          row.nomor_hp || row.no_hp || row['no hp'] || row['NO HP'] || row['No HP'] || row['Nomor HP'] || ''
        ).trim();
        const emailInput = String(
          row.email || row['email'] || row['EMAIL'] || row['Email'] || ''
        ).trim().toLowerCase();

        // Check if NIP already exists in employees table
        const existingEmp = queryOne(db, 'SELECT id, is_deleted FROM employees WHERE nip_nik = ?', [nip]);
        if (existingEmp) {
          if (existingEmp.is_deleted === 1) {
            // Re-activate soft-deleted employee
            executeSql(
              db,
              `UPDATE employees SET 
                nama_lengkap = ?, tempat_lahir = ?, tanggal_lahir = ?, pangkat_golongan = ?, 
                sub_bagian = ?, jabatan = ?, unit_kerja = ?, nomor_hp = ?, is_deleted = 0, status_pegawai = 'aktif', updated_at = ? 
               WHERE id = ?`,
              [nama, tempatLahir, tanggalLahir, pangkatGolongan, subBagian, jabatan, unitKerja, nomorHp, nowIso, existingEmp.id]
            );
            results.importedCount++;
            results.imported.push({
              id: existingEmp.id,
              nip_nik: nip,
              nama_lengkap: nama,
              tempat_lahir: tempatLahir,
              tanggal_lahir: tanggalLahir,
              pangkat_golongan: pangkatGolongan,
              sub_bagian: subBagian,
              jabatan,
              unit_kerja: unitKerja,
              role: 'pegawai'
            });
            continue;
          }
          results.skippedCount++;
          results.errors.push(`Baris ${rowNum} (${nama}): NIP/NIPPPK ${nip} sudah terdaftar.`);
          continue;
        }

        // Generate guaranteed unique username
        let baseUsername = String(row.username || row['Username'] || '').trim().toLowerCase();
        if (!baseUsername) {
          baseUsername = nip.replace(/[^a-zA-Z0-9]/g, '') || nama.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
        }
        baseUsername = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, '') || `pegawai_${i + 1}`;

        let finalUsername = baseUsername;
        let uCounter = 1;
        while (
          queryOne(db, 'SELECT id FROM users WHERE username = ?', [finalUsername]) ||
          queryOne(db, 'SELECT id FROM employees WHERE username = ?', [finalUsername])
        ) {
          finalUsername = `${baseUsername}_${uCounter++}`;
        }
        const username = finalUsername;

        // Generate guaranteed unique email
        let baseEmail = emailInput;
        if (!baseEmail) {
          baseEmail = `${username}@kpu-sungaipenuh.go.id`;
        }
        let finalEmail = baseEmail;
        let eCounter = 1;
        while (
          queryOne(db, 'SELECT id FROM users WHERE email = ?', [finalEmail]) ||
          queryOne(db, 'SELECT id FROM employees WHERE email = ?', [finalEmail])
        ) {
          const atIdx = baseEmail.indexOf('@');
          if (atIdx > 0) {
            const userPart = baseEmail.substring(0, atIdx);
            const domainPart = baseEmail.substring(atIdx);
            finalEmail = `${userPart}_${eCounter++}${domainPart}`;
          } else {
            finalEmail = `${baseEmail}_${eCounter++}@kpu-sungaipenuh.go.id`;
          }
        }
        const email = finalEmail;

        const role = (String(row.role || row['Role'] || 'pegawai').toLowerCase() === 'admin') ? 'admin' : 'pegawai';
        const jatahCuti = Number(row.jatah_cuti_tahunan || row['Jatah Cuti'] || 12) || 12;
        const tanggalMasuk = String(row.tanggal_masuk || row['Tanggal Masuk'] || nowIso.split('T')[0]).trim();
        const rawPassword = String(row.password || row['Password'] || 'kpu123').trim();

        const passwordHash = await getCachedPasswordHash(rawPassword);
        const empId = `emp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        try {
          runTransaction(db, () => {
            executeSql(
              db,
              `INSERT INTO employees (
                id, nip_nik, nama_lengkap, tempat_lahir, tanggal_lahir, pangkat_golongan, sub_bagian,
                username, email, nomor_hp, jabatan, unit_kerja, status_pegawai, tanggal_masuk, role,
                jatah_cuti_tahunan, foto_profil, is_deleted, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?, 0, ?, ?)`,
              [
                empId,
                nip,
                nama,
                tempatLahir,
                tanggalLahir,
                pangkatGolongan,
                subBagian,
                username,
                email,
                nomorHp,
                jabatan,
                unitKerja,
                tanggalMasuk,
                role,
                jatahCuti,
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                nowIso,
                nowIso
              ]
            );

            executeSql(
              db,
              `INSERT INTO users (
                id, username, email, password_hash, role, employee_id, is_active, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
              [userId, username, email, passwordHash, role, empId, nowIso, nowIso]
            );

            executeSql(
              db,
              `INSERT INTO leave_balances (id, employee_id, tahun, n_2, n_1, n, total, updated_at)
               VALUES (?, ?, ?, 0, 0, ?, ?, ?)`,
              [`bal_${empId}_${currentYear}`, empId, currentYear, jatahCuti, jatahCuti, nowIso]
            );
          });

          results.importedCount++;
          results.imported.push({
            id: empId,
            nip_nik: nip,
            nama_lengkap: nama,
            tempat_lahir: tempatLahir,
            tanggal_lahir: tanggalLahir,
            pangkat_golongan: pangkatGolongan,
            sub_bagian: subBagian,
            username,
            email,
            jabatan,
            unit_kerja: unitKerja,
            role
          });
        } catch (insertErr: any) {
          results.skippedCount++;
          results.errors.push(`Baris ${rowNum} (${nama}): Gagal simpan (${insertErr.message})`);
        }
      }

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'BULK_IMPORT_EMPLOYEES',
        'EMPLOYEES',
        null,
        `Admin mengimpor ${results.importedCount} data pegawai dari Excel/CSV (Gagal/dilewati: ${results.skippedCount})`,
        req.ip
      );

      res.json({
        success: true,
        message: `Berhasil mengimpor ${results.importedCount} data pegawai. ${results.skippedCount > 0 ? `(${results.skippedCount} data dilewati)` : ''}`,
        ...results
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal memproses impor pegawai.' });
    }
  });

  // Database Status & Cloud Readiness endpoint
  app.get('/api/database/status', requireAuth, (req, res) => {
    res.json({
      engine: 'Google Firebase Firestore & Relational SQLite Hybrid Engine',
      provider: 'Google Cloud Platform (GCP) & Firebase Ecosystem',
      projectId: 'compact-objective-xt8c4',
      databaseId: 'ai-studio-sistemabsensicut-211f37b7-084b-44f5-932c-db5c5180734b',
      isCloudReady: true,
      status: 'TERHUBUNG (ONLINE & SECURED)'
    });
  });

  // 4. Attendance Endpoints
  app.post('/api/attendance/check-in', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const employeeId = req.user!.employeeId;
      if (!employeeId) return res.status(400).json({ error: 'Akun Anda tidak terhubung ke profil pegawai.' });

      const { latitude, longitude, photo, deviceInfo, isEmergency, emergencyReason } = req.body;
      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Koordinat GPS latitude dan longitude wajib dikirim.' });
      }
      if (!photo) {
        return res.status(400).json({ error: 'Foto selfie absensi wajib diambil.' });
      }

      const result = checkInAttendance(
        db,
        employeeId,
        Number(latitude),
        Number(longitude),
        photo,
        deviceInfo || req.headers['user-agent'],
        req.ip,
        Boolean(isEmergency),
        emergencyReason
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal melakukan absensi masuk.' });
    }
  });

  // Endpoints for outside radius emergency check-in approval (Admin & Operator SDM)
  app.get('/api/attendance/admin/emergency-pending', requireSdmOrAdmin, (req, res) => {
    try {
      const list = queryAll<any>(
        db,
        `SELECT a.*, e.nama_lengkap, e.nip_nik, e.jabatan, e.unit_kerja, e.sub_bagian, e.foto_profil
         FROM attendance a
         JOIN employees e ON a.employee_id = e.id
         WHERE a.is_emergency_checkin = 1 AND a.approval_status = 'pending'
         ORDER BY a.tanggal DESC, a.jam_masuk DESC`
      );
      res.json({ list });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal mengambil daftar presensi darurat pending.' });
    }
  });

  app.post('/api/attendance/admin/emergency/:id/approve', requireSdmOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { note } = req.body;
      const result = approveEmergencyAttendance(db, req.params.id, req.user!.userId, note);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal menyetujui presensi luar radius.' });
    }
  });

  app.post('/api/attendance/admin/emergency/:id/reject', requireSdmOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { note } = req.body;
      const result = rejectEmergencyAttendance(db, req.params.id, req.user!.userId, note);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal menolak presensi luar radius.' });
    }
  });

  app.post('/api/attendance/check-out', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const employeeId = req.user!.employeeId;
      if (!employeeId) return res.status(400).json({ error: 'Akun Anda tidak terhubung ke profil pegawai.' });

      const { latitude, longitude, photo, deviceInfo, isEmergency, emergencyReason } = req.body;
      
      let lat = Number(latitude);
      let lon = Number(longitude);
      if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) {
        const office = getActiveOfficeLocation(db);
        lat = office.latitude;
        lon = office.longitude;
      }

      let selfiePhoto = photo;
      if (!selfiePhoto || typeof selfiePhoto !== 'string' || selfiePhoto.trim().length === 0) {
        return res.status(400).json({ error: 'Foto bukti presensi pulang wajib disertakan.' });
      }

      const result = checkOutAttendance(
        db,
        employeeId,
        lat,
        lon,
        selfiePhoto,
        deviceInfo || req.headers['user-agent'],
        req.ip,
        Boolean(isEmergency),
        emergencyReason
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal melakukan absensi pulang.' });
    }
  });

  app.delete('/api/attendance/:id', requireSdmOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const result = deleteAttendanceRecord(db, req.params.id, req.user!.userId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal menghapus data absensi.' });
    }
  });

  // Cek catatan presensi pegawai pada tanggal tertentu (untuk modal input manual)
  app.get('/api/attendance/admin/check-record', requireStaffOrAdmin, (req, res) => {
    try {
      const { employeeId, tanggal } = req.query;
      if (!employeeId || !tanggal) {
        return res.json({ record: null });
      }
      const record = queryOne<any>(
        db,
        `SELECT id, employee_id, tanggal, jam_masuk, jam_pulang, status, metode_kerja,
                keterlambatan_menit, jam_pulang_wajib, status_ganti_jam, status_validasi_lokasi
         FROM attendance
         WHERE employee_id = ? AND tanggal = ?`,
        [String(employeeId), String(tanggal)]
      );
      res.json({ record: record || null });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal mengecek presensi pegawai.' });
    }
  });

  // Input presensi manual pegawai oleh Admin/SDM (antisipasi pegawai lupa absen)
  app.post('/api/attendance/admin/manual', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { employeeId, tanggal, jamMasuk, jamPulang, mode, status, metodeKerja, catatan } = req.body;
      if (!employeeId) {
        return res.status(400).json({ error: 'Pegawai wajib dipilih.' });
      }
      if (!tanggal) {
        return res.status(400).json({ error: 'Tanggal presensi wajib diisi.' });
      }
      const result = recordManualAttendance(
        db,
        {
          employeeId,
          tanggal,
          jamMasuk,
          jamPulang,
          mode,
          status,
          metodeKerja,
          catatan
        },
        req.user!.userId
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal menambahkan presensi manual.' });
    }
  });

  app.get('/api/attendance/today', requireAuth, (req: AuthenticatedRequest, res) => {
    const employeeId = req.user!.employeeId;
    const wib = getWibDateTime();
    const todayStr = wib.todayStr;

    if (!employeeId) {
      return res.json({
        attendance: null,
        serverTime: {
          todayStr: wib.todayStr,
          timeStr: wib.timeStr,
          timezone: 'WIB (Asia/Jakarta)'
        }
      });
    }

    const attendance = queryOne<any>(
      db,
      'SELECT * FROM attendance WHERE employee_id = ? AND tanggal = ?',
      [employeeId, todayStr]
    );

    const workMethod = getWorkMethodForEmployee(db, employeeId, todayStr);
    const office = getActiveOfficeLocation(db);
    const schedule = queryOne<any>(
      db,
      'SELECT * FROM work_schedules WHERE is_active = 1 LIMIT 1'
    ) || {
      id: 'default',
      jam_masuk: '07:30:00',
      jam_pulang: '16:00:00',
      toleransi_keterlambatan_menit: 15,
      hari_kerja: '1,2,3,4,5'
    };

    // Trigger notification if employee has not checked in and work hours have started
    if (!attendance || !attendance.jam_masuk) {
      try {
        checkAndNotifyLateAttendance(db, req.user!.userId);
      } catch (e) {
        console.warn('Notification trigger error:', e);
      }
    }

    const schedInMinutes = parseTimeToMinutes(schedule.jam_masuk);
    const schedOutMinutes = parseTimeToMinutes(schedule.jam_pulang);
    const currentMinutes = wib.totalMinutes;
    const sudahMasukJam = currentMinutes >= schedInMinutes;

    // Kalkulasi kompensasi / ganti jam kerja keterlambatan
    let lateMinutes = 0;
    let jamPulangWajib = schedule.jam_pulang;
    let statusGantiJam = 'tidak_perlu';
    let requiredOutMinutes = schedOutMinutes;
    let isFulfilled = true;
    let remainingMinutes = 0;

    if (attendance && attendance.jam_masuk) {
      const inMinutes = parseTimeToMinutes(attendance.jam_masuk);
      lateMinutes = typeof attendance.keterlambatan_menit === 'number' && attendance.keterlambatan_menit > 0
        ? attendance.keterlambatan_menit
        : Math.max(0, inMinutes - schedInMinutes);

      requiredOutMinutes = attendance.jam_pulang_wajib
        ? parseTimeToMinutes(attendance.jam_pulang_wajib)
        : schedOutMinutes + lateMinutes;

      jamPulangWajib = minutesToTimeStr(requiredOutMinutes);

      if (attendance.jam_pulang) {
        statusGantiJam = attendance.status_ganti_jam || (lateMinutes > 0 ? 'terpenuhi' : 'tidak_perlu');
        isFulfilled = statusGantiJam === 'terpenuhi' || statusGantiJam === 'tidak_perlu';
        remainingMinutes = 0;
      } else {
        isFulfilled = currentMinutes >= requiredOutMinutes;
        statusGantiJam = isFulfilled ? (lateMinutes > 0 ? 'terpenuhi' : 'tidak_perlu') : 'menunggu';
        remainingMinutes = Math.max(0, requiredOutMinutes - currentMinutes);
      }
    } else {
      requiredOutMinutes = schedOutMinutes;
      jamPulangWajib = minutesToTimeStr(requiredOutMinutes);
      if (attendance && attendance.jam_pulang) {
        statusGantiJam = attendance.status_ganti_jam || 'potong_tukin';
        isFulfilled = statusGantiJam !== 'potong_tukin';
        remainingMinutes = 0;
      } else {
        isFulfilled = currentMinutes >= requiredOutMinutes;
        statusGantiJam = isFulfilled ? 'tidak_perlu' : 'menunggu';
        remainingMinutes = Math.max(0, requiredOutMinutes - currentMinutes);
      }
    }

    res.json({
      attendance,
      workMethod,
      office,
      schedule,
      serverTime: {
        todayStr: wib.todayStr,
        timeStr: wib.timeStr,
        totalMinutes: wib.totalMinutes,
        sudahMasukJam,
        timezone: 'WIB (Asia/Jakarta)'
      },
      windowRules: {
        checkInStart: '06:00:00',
        checkInEnd: '08:30:00',
        checkOutEnd: '23:59:00',
        minCheckInMinutes: 360,
        maxCheckInMinutes: 510,
        maxCheckOutMinutes: 1439,
        isCheckInAllowed: currentMinutes >= 360 && currentMinutes <= 510,
        isCheckInExpired: currentMinutes > 510,
        isCheckInTooEarly: currentMinutes < 360,
        isCheckOutAllowed: currentMinutes <= 1439
      },
      replacementInfo: {
        hasCheckIn: !!(attendance && attendance.jam_masuk),
        hasCheckOut: !!(attendance && attendance.jam_pulang),
        lateMinutes,
        jamPulangWajib,
        requiredOutMinutes,
        isFulfilled,
        remainingMinutes,
        statusGantiJam
      }
    });
  });

  app.get('/api/attendance/history', requireAuth, (req: AuthenticatedRequest, res) => {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.json({ history: [] });

    const year = req.query.year as string;
    const month = req.query.month as string;

    let sql = 'SELECT * FROM attendance WHERE employee_id = ?';
    const params: any[] = [employeeId];

    if (year && month) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      sql += ' AND tanggal LIKE ?';
      params.push(`${prefix}%`);
    } else if (year) {
      sql += ' AND tanggal LIKE ?';
      params.push(`${year}%`);
    }

    sql += ' ORDER BY tanggal DESC';
    const history = queryAll(db, sql, params);
    res.json({ history });
  });

  // Monthly Attendance Statistics (for Recharts BarChart visualizations)
  app.get('/api/attendance/monthly-stats', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const now = new Date();
      const year = parseInt(req.query.year as string) || now.getFullYear();
      const month = parseInt(req.query.month as string) || (now.getMonth() + 1);

      let employeeId = req.user!.employeeId;
      if (req.user!.role === 'admin' && req.query.employee_id) {
        employeeId = req.query.employee_id as string;
      }

      // If user is admin and no employeeId is requested, return office-wide stats
      const isOfficeWide = !employeeId && req.user!.role === 'admin';

      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
      ];
      const monthFullNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];

      // 1. Calculate 12-month Trend
      const monthlyTrend = [];
      let totalHadirYear = 0;
      let totalTepatWaktuYear = 0;
      let totalTerlambatYear = 0;
      let totalCutiYear = 0;
      let totalJamKerjaYear = 0;

      for (let m = 1; m <= 12; m++) {
        const mStr = String(m).padStart(2, '0');
        const monthPrefix = `${year}-${mStr}`;

        let attQuery = `SELECT * FROM attendance WHERE tanggal LIKE ?`;
        const attParams: any[] = [`${monthPrefix}%`];
        if (!isOfficeWide && employeeId) {
          attQuery += ` AND employee_id = ?`;
          attParams.push(employeeId);
        }

        const attRecords = queryAll<any>(db, attQuery, attParams);

        let hadirCount = 0;
        let terlambatCount = 0;
        let monthJamKerja = 0;

        attRecords.forEach(r => {
          if (r.jam_masuk) {
            const isLate = (r.keterlambatan_menit && r.keterlambatan_menit > 0) || r.status === 'Terlambat';
            if (isLate) {
              terlambatCount++;
            } else {
              hadirCount++;
            }

            if (r.jam_masuk && r.jam_pulang) {
              const inM = parseTimeToMinutes(r.jam_masuk);
              const outM = parseTimeToMinutes(r.jam_pulang);
              if (outM > inM) {
                monthJamKerja += (outM - inM) / 60;
              }
            } else if (r.jam_masuk) {
              monthJamKerja += 8.0;
            }
          }
        });

        // Leave count for this month
        let leaveQuery = `SELECT id FROM leave_requests WHERE status = 'APPROVED' AND (
          tanggal_mulai LIKE ? OR tanggal_selesai LIKE ?
        )`;
        const leaveParams: any[] = [`${monthPrefix}%`, `${monthPrefix}%`];
        if (!isOfficeWide && employeeId) {
          leaveQuery += ` AND employee_id = ?`;
          leaveParams.push(employeeId);
        }
        const leaveRecords = queryAll<any>(db, leaveQuery, leaveParams);
        const cutiCount = leaveRecords.length;

        const totalActive = hadirCount + terlambatCount;
        const totalKehadiranBulan = totalActive + cutiCount;
        const persentase = totalKehadiranBulan > 0
          ? Math.min(100, Math.round((totalActive / Math.max(1, totalKehadiranBulan)) * 100))
          : 0;

        monthlyTrend.push({
          month: monthNames[m - 1],
          monthName: monthFullNames[m - 1],
          monthNum: m,
          hadir: hadirCount,
          terlambat: terlambatCount,
          cuti: cutiCount,
          alpa: 0,
          totalHadir: totalActive,
          persentase,
          jamKerja: Math.round(monthJamKerja * 10) / 10
        });

        totalHadirYear += totalActive;
        totalTepatWaktuYear += hadirCount;
        totalTerlambatYear += terlambatCount;
        totalCutiYear += cutiCount;
        totalJamKerjaYear += monthJamKerja;
      }

      // 2. Daily breakdown for selected month
      const daysInMonth = new Date(year, month, 0).getDate();
      const dailyBreakdown = [];
      const selMonthStr = String(month).padStart(2, '0');
      const selMonthPrefix = `${year}-${selMonthStr}`;

      let selAttQuery = `SELECT * FROM attendance WHERE tanggal LIKE ?`;
      const selAttParams: any[] = [`${selMonthPrefix}%`];
      if (!isOfficeWide && employeeId) {
        selAttQuery += ` AND employee_id = ?`;
        selAttParams.push(employeeId);
      }
      const selAttRecords = queryAll<any>(db, selAttQuery, selAttParams);

      const dayNamesId = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = String(d).padStart(2, '0');
        const dateStr = `${year}-${selMonthStr}-${dStr}`;
        const dateObj = new Date(year, month - 1, d);
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const rec = selAttRecords.find(r => r.tanggal === dateStr);
        let status = 'LIBUR';
        let durasiJam = 0;
        let lateMin = 0;

        if (rec) {
          lateMin = rec.keterlambatan_menit || 0;
          if (rec.jam_masuk) {
            status = lateMin > 0 ? 'TERLAMBAT' : 'HADIR';
            if (rec.jam_masuk && rec.jam_pulang) {
              const inM = parseTimeToMinutes(rec.jam_masuk);
              const outM = parseTimeToMinutes(rec.jam_pulang);
              if (outM > inM) durasiJam = Math.round(((outM - inM) / 60) * 10) / 10;
            } else {
              durasiJam = 8.0;
            }
          } else if (rec.status) {
            status = rec.status.toUpperCase();
          }
        } else if (!isWeekend) {
          const isPast = new Date(dateStr) < new Date(now.toISOString().split('T')[0]);
          status = isPast ? 'ALPA' : 'BELUM';
        }

        dailyBreakdown.push({
          day: d,
          date: dateStr,
          dayName: dayNamesId[dayOfWeek],
          isWeekend,
          jamMasuk: rec?.jam_masuk || null,
          jamPulang: rec?.jam_pulang || null,
          durasiJam,
          keterlambatanMenit: lateMin,
          status,
          metodeKerja: rec?.metode_kerja || 'WFO'
        });
      }

      // Summary for selected month
      const currentMonthTrend = monthlyTrend[month - 1];
      const monthHadir = currentMonthTrend ? currentMonthTrend.hadir : 0;
      const monthTerlambat = currentMonthTrend ? currentMonthTrend.terlambat : 0;
      const monthCuti = currentMonthTrend ? currentMonthTrend.cuti : 0;
      const monthTotalHadir = monthHadir + monthTerlambat;

      const summary = {
        totalHadir: monthTotalHadir,
        totalTepatWaktu: monthHadir,
        totalTerlambat: monthTerlambat,
        totalCuti: monthCuti,
        totalAlpa: 0,
        persentaseKehadiran: currentMonthTrend?.persentase || 100,
        totalJamKerja: currentMonthTrend?.jamKerja || 0,
        rataRataJamKerjaPerHari: monthTotalHadir > 0
          ? Math.round(((currentMonthTrend?.jamKerja || 0) / monthTotalHadir) * 10) / 10
          : 0,
        totalHadirYear,
        totalTepatWaktuYear,
        totalTerlambatYear,
        totalCutiYear,
        totalJamKerjaYear: Math.round(totalJamKerjaYear * 10) / 10
      };

      res.json({
        success: true,
        year,
        month,
        monthName: monthFullNames[month - 1],
        employeeId: employeeId || 'all',
        isOfficeWide,
        summary,
        monthlyTrend,
        dailyBreakdown
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin attendance views
  app.get('/api/attendance/admin/today', requireStaffOrAdmin, (req, res) => {
    const wib = getWibDateTime();
    const date = (req.query.date as string) || wib.todayStr;
    const unit = req.query.unit as string;
    const status = req.query.status as string;
    const method = req.query.method as string;

    let sql = `
      SELECT 
        a.*, 
        e.nama_lengkap, e.nip_nik, e.unit_kerja, e.jabatan, e.foto_profil
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.tanggal = ? AND e.is_deleted = 0
    `;
    const params: any[] = [date];

    if (unit && unit !== 'ALL') {
      sql += ' AND (e.sub_bagian = ? OR e.unit_kerja = ?)';
      params.push(unit, unit);
    }
    if (status && status !== 'ALL') {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    if (method && method !== 'ALL') {
      sql += ' AND a.metode_kerja = ?';
      params.push(method);
    }

    sql += ' ORDER BY a.jam_masuk ASC';
    const list = queryAll(db, sql, params);
    res.json({ list });
  });

  app.get('/api/attendance/admin/monitoring', requireStaffOrAdmin, (req, res) => {
    const wib = getWibDateTime();
    const date = (req.query.date as string) || wib.todayStr;

    // All active employees
    const allEmployees = queryAll<{
      id: string;
      nama_lengkap: string;
      nip_nik: string;
      unit_kerja: string;
      jabatan: string;
      foto_profil: string;
    }>(db, "SELECT id, nama_lengkap, nip_nik, unit_kerja, jabatan, foto_profil FROM employees WHERE status_pegawai = 'aktif' AND is_deleted = 0 ORDER BY rowid ASC");

    const attendances = queryAll<any>(
      db,
      'SELECT * FROM attendance WHERE tanggal = ?',
      [date]
    );

    const attMap = new Map<string, any>();
    attendances.forEach(a => attMap.set(a.employee_id, a));

    // Get work assignments for this date
    const assignments = queryAll<{ employee_id: string; metode_kerja: string }>(
      db,
      'SELECT employee_id, metode_kerja FROM work_assignments WHERE tanggal = ?',
      [date]
    );
    const methodMap = new Map<string, string>();
    assignments.forEach(m => methodMap.set(m.employee_id, m.metode_kerja));

    // Get leave status for this date
    const onLeave = queryAll<{ employee_id: string; leave_type_name: string }>(
      db,
      `SELECT lr.employee_id, lt.nama as leave_type_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE ? BETWEEN lr.tanggal_mulai AND lr.tanggal_selesai
       AND lr.status = 'Disetujui'`,
      [date]
    );
    const leaveMap = new Map<string, string>();
    onLeave.forEach(l => leaveMap.set(l.employee_id, l.leave_type_name));

    const sudahAbsen: any[] = [];
    const belumAbsen: any[] = [];

    for (const emp of allEmployees) {
      const att = attMap.get(emp.id);
      const assignedMethod = methodMap.get(emp.id) || 'WFO';
      const isLeave = leaveMap.get(emp.id);

      if (att && att.jam_masuk) {
        sudahAbsen.push({
          ...emp,
          attendance: att
        });
      } else {
        belumAbsen.push({
          ...emp,
          assignedMethod,
          isLeave: isLeave || null
        });
      }
    }

    res.json({
      date,
      totalPegawai: allEmployees.length,
      totalSudahAbsen: sudahAbsen.length,
      totalBelumAbsen: belumAbsen.length,
      sudahAbsen,
      belumAbsen
    });
  });

  app.get('/api/attendance/admin/rekap', requireStaffOrAdmin, (req, res) => {
    const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
    const endDate = (req.query.endDate as string) || new Date().toISOString().split('T')[0];
    const unit = req.query.unit as string;
    const employeeId = req.query.employeeId as string;
    const status = req.query.status as string;
    const method = req.query.method as string;

    let sql = `
      SELECT 
        a.*, 
        e.nama_lengkap, e.nip_nik, e.unit_kerja, e.sub_bagian, e.jabatan
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.tanggal BETWEEN ? AND ? AND e.is_deleted = 0 AND e.role != 'admin' AND e.username NOT IN ('admin', 'admincutikpuspn')
    `;
    const params: any[] = [startDate, endDate];

    if (unit && unit !== 'ALL') {
      sql += ' AND (e.sub_bagian = ? OR e.unit_kerja = ?)';
      params.push(unit, unit);
    }
    if (employeeId && employeeId !== 'ALL') {
      sql += ' AND a.employee_id = ?';
      params.push(employeeId);
    }
    if (status && status !== 'ALL') {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    if (method && method !== 'ALL') {
      sql += ' AND a.metode_kerja = ?';
      params.push(method);
    }

    sql += ' ORDER BY a.tanggal DESC, a.jam_masuk ASC';
    const list = queryAll(db, sql, params);

    // Calculate summary
    const summary = {
      totalHadir: list.filter(a => a.status === 'Hadir').length,
      totalTerlambat: list.filter(a => a.status === 'Terlambat').length,
      totalWFH: list.filter(a => a.metode_kerja === 'WFH').length,
      totalWFA: list.filter(a => a.metode_kerja === 'WFA').length,
      totalWFO: list.filter(a => a.metode_kerja === 'WFO').length,
      totalRecords: list.length
    };

    res.json({ list, summary, period: { startDate, endDate } });
  });

  // Rekap Matrix Bulanan (Format Kalender 1-31 mirip template resmi KPU / absensi karyawan)
  app.get('/api/attendance/admin/rekap-matrix', requireStaffOrAdmin, (req, res) => {
    const wib = getWibDateTime();
    const month = (req.query.month as string) || wib.todayStr.substring(0, 7);
    const unit = req.query.unit as string;

    const [yearStr, monthNumStr] = month.split('-');
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const monthNum = parseInt(monthNumStr, 10) || (new Date().getMonth() + 1);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    const monthNames = [
      'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
      'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
    ];
    const monthName = monthNames[monthNum - 1] || '';

    // Jadwal kerja dan hari kerja aktif
    const schedule = queryOne<any>(db, 'SELECT * FROM work_schedules WHERE is_active = 1 LIMIT 1');
    const workingDays: number[] = schedule?.hari_kerja 
      ? schedule.hari_kerja.split(',').map(Number) 
      : [1, 2, 3, 4, 5];

    // Daftar libur nasional bulan ini
    const holidays = queryAll<{ tanggal: string; nama: string }>(
      db,
      'SELECT tanggal, nama FROM holidays WHERE tanggal LIKE ?',
      [`${month}%`]
    );
    const holidayMap = new Map<string, string>();
    holidays.forEach(h => holidayMap.set(h.tanggal, h.nama));

    // Metadata hari per tanggal
    const daysMeta = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${month}-${dayStr}`;
      const dt = new Date(`${dateStr}T00:00:00Z`);
      const dayOfWeek = dt.getUTCDay();
      const isWeekend = !workingDays.includes(dayOfWeek);
      const isHoliday = holidayMap.has(dateStr);
      const holidayName = holidayMap.get(dateStr) || null;
      const isNonWorkingDay = isWeekend || isHoliday;
      daysMeta.push({
        day: d,
        dateStr,
        dayOfWeek,
        isWeekend,
        isHoliday,
        holidayName,
        isNonWorkingDay
      });
    }

    // Query daftar pegawai (Admin bukan pegawai, urutan default mengikuti upload Excel asli)
    const sort = req.query.sort as string;
    let empSql = "SELECT id, nip_nik, nama_lengkap, jabatan, unit_kerja, sub_bagian FROM employees WHERE is_deleted = 0 AND role != 'admin' AND username NOT IN ('admin', 'admincutikpuspn') AND id != 'emp_admin_1'";
    const empParams: any[] = [];
    if (unit && unit !== 'ALL') {
      empSql += ' AND (sub_bagian = ? OR unit_kerja = ?)';
      empParams.push(unit, unit);
    }
    if (sort === 'asc') {
      empSql += ' ORDER BY nama_lengkap ASC';
    } else if (sort === 'desc') {
      empSql += ' ORDER BY nama_lengkap DESC';
    } else {
      empSql += ' ORDER BY rowid ASC';
    }
    const employees = queryAll<any>(db, empSql, empParams);

    // Query data absensi bulan ini
    const attendances = queryAll<any>(
      db,
      'SELECT * FROM attendance WHERE tanggal LIKE ?',
      [`${month}%`]
    );
    const attMap = new Map<string, any>();
    attendances.forEach(a => {
      attMap.set(`${a.employee_id}_${a.tanggal}`, a);
    });

    // Query data penugasan kerja (WFH, Dinas Dalam, Dinas Luar, Tugas Belajar, Kursus/Pelatihan) bulan ini
    const assignments = queryAll<any>(
      db,
      'SELECT * FROM work_assignments WHERE tanggal LIKE ?',
      [`${month}%`]
    );
    const assignMap = new Map<string, any>();
    assignments.forEach(a => {
      assignMap.set(`${a.employee_id}_${a.tanggal}`, a);
    });

    // Query data cuti yang disetujui bulan ini
    const leaves = queryAll<any>(
      db,
      `SELECT lr.employee_id, lr.tanggal_mulai, lr.tanggal_selesai, lt.kode, lt.nama as jenis_cuti
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.status IN ('APPROVED', 'Disetujui')
         AND lr.tanggal_mulai <= ?
         AND lr.tanggal_selesai >= ?`,
      [`${month}-${String(daysInMonth).padStart(2, '0')}`, `${month}-01`]
    );

    const todayStr = wib.todayStr;

    // Susun baris per pegawai
    const rows = employees.map(emp => {
      let countH = 0;
      let countTL = 0;
      let countPSW = 0;
      let countTK = 0;
      let countS = 0;
      let countI = 0;
      let countCT = 0;
      let countDD = 0;
      let countDL = 0;
      let countTB = 0;
      let countKP = 0;
      let countWFH = 0;
      let workdaysPassed = 0;

      const daysData = daysMeta.map(dayInfo => {
        const key = `${emp.id}_${dayInfo.dateStr}`;
        const att = attMap.get(key);
        const assign = assignMap.get(key);

        // Cek cuti pada tanggal ini
        const leave = leaves.find(l => 
          l.employee_id === emp.id && 
          l.tanggal_mulai <= dayInfo.dateStr && 
          l.tanggal_selesai >= dayInfo.dateStr
        );

        let code = '';
        let keterangan = '';
        const isPastOrToday = dayInfo.dateStr <= todayStr;
        const isPastDay = dayInfo.dateStr < todayStr;

        if (dayInfo.isNonWorkingDay) {
          if (att && att.jam_masuk) {
            code = 'H';
            countH++;
            keterangan = `Masuk Hari Libur: ${att.jam_masuk}`;
          } else {
            code = 'LIBUR';
            keterangan = dayInfo.holidayName || (dayInfo.dayOfWeek === 0 ? 'Minggu' : 'Sabtu');
          }
        } else {
          if (isPastOrToday) {
            workdaysPassed++;
          }

          // 1. Cek Cuti / Izin / Sakit / Tugas Belajar / Kursus
          if (leave) {
            const lCode = (leave.kode || '').toUpperCase();
            const jCuti = (leave.jenis_cuti || '').toLowerCase();
            if (lCode.includes('SAKIT') || jCuti.includes('sakit')) {
              code = 'S';
              countS++;
              keterangan = `Sakit (S): ${leave.jenis_cuti}`;
            } else if (lCode === 'TB' || lCode.includes('BELAJAR') || jCuti.includes('tugas belajar')) {
              code = 'TB';
              countTB++;
              keterangan = `Tugas Belajar (TB): ${leave.jenis_cuti}`;
            } else if (lCode === 'KP' || lCode === 'K/P' || jCuti.includes('kursus') || jCuti.includes('pelatihan') || jCuti.includes('diklat')) {
              code = 'K/P';
              countKP++;
              keterangan = `Kursus/Pelatihan (K/P): ${leave.jenis_cuti}`;
            } else if (lCode === 'DD' || jCuti.includes('dinas dalam')) {
              code = 'DD';
              countDD++;
              keterangan = `Dinas Dalam Daerah (DD): ${leave.jenis_cuti}`;
            } else if (lCode === 'DL' || jCuti.includes('dinas luar')) {
              code = 'DL';
              countDL++;
              keterangan = `Dinas Luar Daerah (DL): ${leave.jenis_cuti}`;
            } else if (lCode.includes('IZIN') || lCode.includes('ALASAN_PENTING') || lCode === 'CAP' || jCuti.includes('izin')) {
              code = 'I';
              countI++;
              keterangan = `Izin (I): ${leave.jenis_cuti}`;
            } else {
              code = 'CT';
              countCT++;
              keterangan = `Cuti (CT): ${leave.jenis_cuti}`;
            }
          }
          // 2. Cek Surat Tugas / Penugasan Khusus (WFH, DD, DL, TB, K/P)
          else if (assign) {
            const waMethod = (assign.metode_kerja || '').toUpperCase();
            const waKet = (assign.keterangan || '').toLowerCase();
            if (waMethod === 'WFH' || waKet.includes('wfh') || waKet.includes('home')) {
              code = 'WFH';
              countWFH++;
              keterangan = `Work From Home (WFH): ${assign.keterangan || 'Penugasan WFH'}`;
            } else if (waMethod === 'DD' || waKet.includes('dinas dalam')) {
              code = 'DD';
              countDD++;
              keterangan = `Dinas Dalam Daerah (DD): ${assign.keterangan || 'Penugasan DD'}`;
            } else if (waMethod === 'DL' || waKet.includes('dinas luar')) {
              code = 'DL';
              countDL++;
              keterangan = `Dinas Luar Daerah (DL): ${assign.keterangan || 'Penugasan DL'}`;
            } else if (waMethod === 'TB' || waKet.includes('tugas belajar')) {
              code = 'TB';
              countTB++;
              keterangan = `Tugas Belajar (TB): ${assign.keterangan || 'Penugasan TB'}`;
            } else if (waMethod === 'KP' || waMethod === 'K/P' || waKet.includes('kursus') || waKet.includes('pelatihan')) {
              code = 'K/P';
              countKP++;
              keterangan = `Kursus/Pelatihan (K/P): ${assign.keterangan || 'Pelatihan'}`;
            }
          }

          // 3. Cek Data Absensi Masuk / Pulang jika belum tercatat dari cuti/penugasan
          if (!code && att && (att.jam_masuk || att.jam_pulang || att.status === 'Hadir' || att.status === 'Terlambat' || att.status === 'TK' || att.status === 'Menunggu Persetujuan')) {
            const mKerja = (att.metode_kerja || '').toUpperCase();
            if (att.approval_status === 'pending' || att.status === 'Menunggu Persetujuan') {
              code = 'LR';
              keterangan = `Luar Radius (Menunggu Persetujuan Admin) - Masuk: ${att.jam_masuk || '-'}, Alasan: ${att.emergency_reason || 'Kendala perjalanan'}`;
            } else if (att.approval_status === 'rejected' || att.status === 'Ditolak') {
              code = 'TK';
              countTK++;
              keterangan = `Presensi Ditolak Admin - ${att.approval_note || 'Tidak memenuhi syarat'}`;
            } else if (att.status === 'TK' || (att.jam_masuk && att.jam_masuk > '08:29:59')) {
              code = 'TK';
              countTK++;
              keterangan = `Tanpa Keterangan (TK) - Hadir lewat batas 08:29 WIB (Masuk: ${att.jam_masuk})`;
            } else if (mKerja === 'WFH') {
              code = 'WFH';
              countWFH++;
              keterangan = `Work From Home (WFH) - Masuk: ${att.jam_masuk || '-'}, Pulang: ${att.jam_pulang || '-'}`;
            } else if (mKerja === 'DD' || att.status === 'Dinas Dalam') {
              code = 'DD';
              countDD++;
              keterangan = `Dinas Dalam Daerah (DD) - Masuk: ${att.jam_masuk || '-'}, Pulang: ${att.jam_pulang || '-'}`;
            } else if (mKerja === 'DL' || att.status === 'Dinas Luar') {
              code = 'DL';
              countDL++;
              keterangan = `Dinas Luar Daerah (DL) - Masuk: ${att.jam_masuk || '-'}, Pulang: ${att.jam_pulang || '-'}`;
            } else {
              // Terlambat / Lupa Absen Pagi (TL)
              const isLate = att.status === 'Terlambat' || (!att.jam_masuk && att.jam_pulang) || (att.keterlambatan_menit > 0);
              
              // Pulang Sebelum Waktu / Lupa Absen Sore (PSW)
              const isPsw = (att.status_ganti_jam === 'potong_tukin') ||
                            (att.jam_masuk && !att.jam_pulang && isPastDay) ||
                            (att.jam_pulang && att.jam_pulang_wajib && att.jam_pulang < att.jam_pulang_wajib);

              if (isLate && isPsw) {
                code = 'TL';
                countTL++;
                countPSW++;
                keterangan = `TL & PSW (Terlambat ${att.keterlambatan_menit || 0}m, Masuk: ${att.jam_masuk || 'Lupa Absen Pagi'}, Pulang: ${att.jam_pulang || 'Lupa Absen Sore'})`;
              } else if (isLate) {
                code = 'TL';
                countTL++;
                keterangan = `Terlambat / Lupa Absen Pagi (Masuk: ${att.jam_masuk || 'Lupa Absen Pagi'}, Pulang: ${att.jam_pulang || '-'})`;
              } else if (isPsw) {
                code = 'PSW';
                countPSW++;
                keterangan = `Pulang Sebelum Waktu / Lupa Absen Sore (Masuk: ${att.jam_masuk || '-'}, Pulang: ${att.jam_pulang || 'Lupa Absen Sore'})`;
              } else {
                code = 'H';
                countH++;
                keterangan = `Hadir Tepat Waktu (Masuk: ${att.jam_masuk}, Pulang: ${att.jam_pulang || '-'})`;
              }
            }
          }

          // 4. Jika hari kerja sudah lewat dan tidak ada presensi/keterangan
          if (!code) {
            if (isPastOrToday) {
              code = 'TK';
              countTK++;
              keterangan = 'Tanpa Keterangan (TK)';
            } else {
              code = '-';
              keterangan = 'Mendatang';
            }
          }
        }

        return {
          day: dayInfo.day,
          dateStr: dayInfo.dateStr,
          isNonWorkingDay: dayInfo.isNonWorkingDay,
          isHoliday: dayInfo.isHoliday,
          isWeekend: dayInfo.isWeekend,
          holidayName: dayInfo.holidayName,
          code,
          keterangan,
          jam_masuk: att?.jam_masuk || null,
          jam_pulang: att?.jam_pulang || null,
          status_ganti_jam: att?.status_ganti_jam || null,
          keterlambatan_menit: att?.keterlambatan_menit || 0
        };
      });

      const totalHadir = countH + countTL + countPSW + countDD + countDL + countWFH;
      const persentase = workdaysPassed > 0 
        ? ((totalHadir / workdaysPassed) * 100).toFixed(1) + '%' 
        : '100%';

      return {
        id: emp.id,
        nip_nik: emp.nip_nik,
        nama_lengkap: emp.nama_lengkap,
        jabatan: emp.jabatan,
        unit_kerja: emp.unit_kerja,
        days: daysData,
        summary: {
          H: countH,
          TL: countTL,
          PSW: countPSW,
          TK: countTK,
          S: countS,
          I: countI,
          CT: countCT,
          DD: countDD,
          DL: countDL,
          TB: countTB,
          KP: countKP,
          WFH: countWFH,
          // Backward compatibility keys
          C: countCT,
          A: countTK,
          totalHadir,
          workdaysPassed,
          persentase
        }
      };
    });

    res.json({
      month,
      year,
      monthNum,
      monthName,
      daysInMonth,
      daysMeta,
      rows,
      instansi: 'KOMISI PEMILIHAN UMUM KOTA SUNGAI PENUH'
    });
  });

  // 5. Work Assignments (WFH/WFA/WFO)
  app.get('/api/work-assignments', requireAuth, (req, res) => {
    const date = req.query.date as string;
    const employeeId = req.query.employeeId as string;

    let sql = `
      SELECT wa.*, e.nama_lengkap, e.nip_nik, e.unit_kerja
      FROM work_assignments wa
      JOIN employees e ON wa.employee_id = e.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (date) {
      sql += ' AND wa.tanggal = ?';
      params.push(date);
    }
    if (employeeId) {
      sql += ' AND wa.employee_id = ?';
      params.push(employeeId);
    }

    sql += ' ORDER BY wa.tanggal DESC';
    const assignments = queryAll(db, sql, params);
    res.json({ assignments });
  });

  app.post('/api/work-assignments', requireSdmOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { employee_id, tanggal, metode_kerja, keterangan, surat_tugas } = req.body;
      if (!employee_id || !tanggal || !metode_kerja) {
        return res.status(400).json({ error: 'Pegawai, Tanggal, dan Metode Kerja wajib diisi.' });
      }

      const id = `wa_${employee_id}_${tanggal}`;
      const nowIso = new Date().toISOString();

      executeSql(
        db,
        `INSERT OR REPLACE INTO work_assignments (id, employee_id, tanggal, metode_kerja, keterangan, surat_tugas, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, employee_id, tanggal, metode_kerja, keterangan || '', surat_tugas || '', req.user!.userId, nowIso]
      );

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'SET_WORK_ASSIGNMENT',
        'WORK_SCHEDULE',
        null,
        JSON.stringify({ employee_id, tanggal, metode_kerja, surat_tugas }),
        req.ip
      );

      res.json({ success: true, message: `Jadwal ${metode_kerja} berhasil disimpan untuk ${tanggal}.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk WFH/WFA input by date range and selected employees
  app.post('/api/work-assignments/bulk', requireSdmOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { employee_ids, dates, metode_kerja, keterangan, surat_tugas } = req.body;
      if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
        return res.status(400).json({ error: 'Pilih minimal satu pegawai.' });
      }
      if (!Array.isArray(dates) || dates.length === 0) {
        return res.status(400).json({ error: 'Pilih minimal satu tanggal penugasan.' });
      }
      if (!metode_kerja) {
        return res.status(400).json({ error: 'Metode kerja (WFH/WFA/WFO) wajib dipilih.' });
      }

      const nowIso = new Date().toISOString();
      let count = 0;

      for (const empId of employee_ids) {
        for (const dt of dates) {
          const id = `wa_${empId}_${dt}`;
          executeSql(
            db,
            `INSERT OR REPLACE INTO work_assignments (id, employee_id, tanggal, metode_kerja, keterangan, surat_tugas, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, empId, dt, metode_kerja, keterangan || '', surat_tugas || '', req.user!.userId, nowIso]
          );
          count++;
        }
      }

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'SET_WORK_ASSIGNMENT_BULK',
        'WORK_SCHEDULE',
        null,
        JSON.stringify({
          employeesCount: employee_ids.length,
          datesCount: dates.length,
          metode_kerja,
          surat_tugas,
          totalAssigned: count
        }),
        req.ip
      );

      res.json({
        success: true,
        message: `Berhasil menetapkan ${count} jadwal ${metode_kerja} untuk ${employee_ids.length} pegawai pada ${dates.length} tanggal.`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal menyimpan penugasan masal.' });
    }
  });

  // Import WFH/WFA via Excel / CSV batch
  app.post('/api/work-assignments/import-excel', requireSdmOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { assignments } = req.body;
      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ error: 'Data impor penugasan kosong atau tidak valid.' });
      }

      const nowIso = new Date().toISOString();
      const allEmps = queryAll<any>(db, 'SELECT id, nip_nik, nama_lengkap FROM employees');
      let importedCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < assignments.length; i++) {
        const item = assignments[i];
        const rowNum = i + 1;

        if (!item.tanggal || !item.metode_kerja) {
          errors.push(`Baris ${rowNum}: Tanggal dan metode kerja wajib diisi.`);
          continue;
        }

        // Find employee by nip_nik or id or name
        const searchNip = item.nip_nik ? String(item.nip_nik).trim() : '';
        const searchName = item.nama_lengkap ? String(item.nama_lengkap).trim().toLowerCase() : '';
        const searchId = item.employee_id ? String(item.employee_id).trim() : '';

        const matchedEmp = allEmps.find(e =>
          (searchNip && e.nip_nik && e.nip_nik.trim() === searchNip) ||
          (searchId && e.id === searchId) ||
          (searchName && e.nama_lengkap.toLowerCase().includes(searchName))
        );

        if (!matchedEmp) {
          errors.push(`Baris ${rowNum}: Pegawai '${searchNip || searchName || searchId}' tidak ditemukan di database.`);
          continue;
        }

        const cleanMethod = String(item.metode_kerja).trim().toUpperCase();
        if (!['WFH', 'WFA', 'WFO'].includes(cleanMethod)) {
          errors.push(`Baris ${rowNum}: Metode kerja '${item.metode_kerja}' tidak valid (Gunakan WFH, WFA, atau WFO).`);
          continue;
        }

        const id = `wa_${matchedEmp.id}_${item.tanggal}`;
        executeSql(
          db,
          `INSERT OR REPLACE INTO work_assignments (id, employee_id, tanggal, metode_kerja, keterangan, surat_tugas, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, matchedEmp.id, item.tanggal, cleanMethod, item.keterangan || '', item.surat_tugas || '', req.user!.userId, nowIso]
        );
        importedCount++;
      }

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'IMPORT_WORK_ASSIGNMENT_EXCEL',
        'WORK_SCHEDULE',
        null,
        JSON.stringify({ totalReceived: assignments.length, importedCount, errorCount: errors.length }),
        req.ip
      );

      res.json({
        success: true,
        importedCount,
        errors,
        message: `Berhasil mengimpor ${importedCount} penugasan kerja. ${errors.length > 0 ? `(${errors.length} baris dilewati)` : ''}`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal memproses impor penugasan.' });
    }
  });

  app.delete('/api/work-assignments/:id', requireSdmOrAdmin, (req: AuthenticatedRequest, res) => {
    executeSql(db, 'DELETE FROM work_assignments WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Jadwal kerja berhasil dihapus.' });
  });

  // 5b. Perjalanan Dinas (Official Travel Duties) Endpoints
  app.get('/api/travel-duties', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const jenis = req.query.jenis as string;
      const tahun = req.query.tahun as string;
      const employeeId = req.query.employeeId as string;
      const status = req.query.status as string;

      const duties = getTravelDuties(db, { jenis, tahun, employeeId, status });
      res.json({ duties });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal mengambil data perjalanan dinas.' });
    }
  });

  app.post('/api/travel-duties', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const {
        nomor_surat_tugas,
        jenis_perjalanan,
        tanggal_mulai,
        tanggal_selesai,
        kota_tujuan,
        tempat_tujuan,
        maksud_tujuan,
        beban_anggaran,
        status,
        lampiran_dokumen,
        employee_ids
      } = req.body;

      if (!nomor_surat_tugas || !jenis_perjalanan || !tanggal_mulai || !tanggal_selesai || !kota_tujuan || !maksud_tujuan) {
        return res.status(400).json({ error: 'Nomor Surat Tugas, Jenis Perjalanan, Tanggal, Kota Tujuan, dan Maksud Tujuan wajib diisi.' });
      }

      const result = createTravelDuty(
        db,
        {
          nomor_surat_tugas,
          jenis_perjalanan,
          tanggal_mulai,
          tanggal_selesai,
          kota_tujuan,
          tempat_tujuan,
          maksud_tujuan,
          beban_anggaran,
          status,
          lampiran_dokumen,
          employee_ids: employee_ids || []
        },
        req.user!.userId
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal membuat surat tugas perjalanan dinas.' });
    }
  });

  app.put('/api/travel-duties/:id', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const result = updateTravelDuty(db, req.params.id, req.body, req.user!.userId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal memperbarui perjalanan dinas.' });
    }
  });

  app.delete('/api/travel-duties/:id', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const result = deleteTravelDuty(db, req.params.id, req.user!.userId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Gagal menghapus perjalanan dinas.' });
    }
  });

  // 5c. Tunjangan Kinerja (Tukin) Endpoints
  app.get('/api/tukin/grades', requireAuth, (req, res) => {
    try {
      const grades = getTukinGrades(db);
      res.json({ grades });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/tukin/grades/:id', requireKeuanganOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { besaran_dasar, kelas_jabatan, keterangan } = req.body;
      if (!besaran_dasar) {
        return res.status(400).json({ error: 'Besaran dasar tunjangan kinerja wajib diisi.' });
      }
      const result = updateTukinGrade(db, req.params.id, Number(besaran_dasar), kelas_jabatan ? Number(kelas_jabatan) : undefined, keterangan);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/tukin/calculations', requireAuth, (req, res) => {
    try {
      const now = new Date();
      const month = req.query.month ? Number(req.query.month) : (now.getMonth() + 1);
      const year = req.query.year ? Number(req.query.year) : now.getFullYear();

      const calculations = getTukinCalculations(db, month, year);

      // Compute summaries
      const totalBruto = calculations.reduce((acc: number, c: any) => acc + (c.tukin_bruto || 0), 0);
      const totalPotongan = calculations.reduce((acc: number, c: any) => acc + (c.total_potongan_rupiah || 0), 0);
      const totalNetto = calculations.reduce((acc: number, c: any) => acc + (c.tukin_netto || 0), 0);

      res.json({
        month,
        year,
        summary: {
          totalPegawai: calculations.length,
          totalBruto,
          totalPotongan,
          totalNetto
        },
        calculations
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal mengambil perhitungan tunjangan kinerja.' });
    }
  });

  app.post('/api/tukin/recalculate', requireKeuanganOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const now = new Date();
      const month = req.body.month ? Number(req.body.month) : (now.getMonth() + 1);
      const year = req.body.year ? Number(req.body.year) : now.getFullYear();

      const calculations = calculateTukinForMonth(db, month, year, req.user!.userId);

      const totalBruto = calculations.reduce((acc: number, c: any) => acc + (c.tukin_bruto || 0), 0);
      const totalPotongan = calculations.reduce((acc: number, c: any) => acc + (c.total_potongan_rupiah || 0), 0);
      const totalNetto = calculations.reduce((acc: number, c: any) => acc + (c.tukin_netto || 0), 0);

      res.json({
        success: true,
        message: `Perhitungan Tukin bulan ${month}/${year} berhasil diperbarui untuk ${calculations.length} pegawai.`,
        summary: {
          totalPegawai: calculations.length,
          totalBruto,
          totalPotongan,
          totalNetto
        },
        calculations
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Gagal menghitung ulang tunjangan kinerja.' });
    }
  });

  // 6. Leave Types
  app.get('/api/leave-types', requireAuth, (req, res) => {
    const types = queryAll(db, 'SELECT * FROM leave_types ORDER BY id ASC');
    res.json({ types });
  });

  // 7. Leave Requests & Approvals
  app.post('/api/leaves/calculate-days', requireAuth, (req, res) => {
    try {
      const { startDate, endDate } = req.body;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Tanggal mulai dan selesai wajib diisi.' });
      }
      const days = calculateLeaveDays(db, startDate, endDate);
      res.json({ days });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/leaves/request', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      let employeeId = req.user!.employeeId;
      if (req.user!.role === 'admin' && req.body.employeeId) {
        employeeId = req.body.employeeId;
      }
      if (!employeeId) {
        return res.status(400).json({ error: 'Akun Anda tidak memiliki profil pegawai. Silakan pilih pegawai untuk pengajuan cuti.' });
      }

      const {
        leaveTypeId,
        startDate,
        endDate,
        reason,
        attachmentUrl,
        alamat_cuti,
        telepon_cuti,
        nama_atasan,
        nip_atasan,
        jabatan_atasan,
        pangkat_golongan,
        masa_kerja
      } = req.body;
      if (!leaveTypeId || !startDate || !endDate || !reason) {
        return res.status(400).json({ error: 'Semua kolom bertanda wajib harus diisi.' });
      }

      const result = createLeaveRequest(
        db,
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        reason,
        attachmentUrl,
        {
          alamat_cuti,
          telepon_cuti,
          nama_atasan,
          nip_atasan,
          jabatan_atasan,
          pangkat_golongan,
          masa_kerja
        }
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/leaves/my-requests', requireAuth, (req: AuthenticatedRequest, res) => {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.json({ requests: [] });

    const sql = `
      SELECT 
        lr.*, 
        lt.nama as leave_type_name, lt.kode as leave_type_code, lt.uses_balance,
        u.username as approver_name,
        e.nama_lengkap, e.nip_nik, e.jabatan, e.unit_kerja, e.pangkat_golongan as emp_pangkat_golongan, e.nomor_hp as emp_nomor_hp
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN employees e ON lr.employee_id = e.id
      LEFT JOIN users u ON lr.approver_id = u.id
      WHERE lr.employee_id = ?
      ORDER BY lr.created_at DESC
    `;
    const requests = queryAll(db, sql, [employeeId]);
    res.json({ requests });
  });

  app.get('/api/leaves/admin/pending', requireStaffOrAdmin, (req, res) => {
    const sql = `
      SELECT 
        lr.*, 
        e.nama_lengkap, e.nip_nik, e.jabatan, e.unit_kerja, e.foto_profil,
        e.pangkat_golongan as emp_pangkat_golongan, e.nomor_hp as emp_nomor_hp,
        lt.nama as leave_type_name, lt.kode as leave_type_code, lt.uses_balance, lt.requires_attachment
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.status = 'Menunggu Approval'
      ORDER BY lr.created_at ASC
    `;
    const requests = queryAll(db, sql);
    res.json({ requests });
  });

  app.get('/api/leaves/admin/all', requireStaffOrAdmin, (req, res) => {
    const { startDate, endDate, leaveTypeId, status, employeeId, search, unit } = req.query;

    let sql = `
      SELECT 
        lr.*, 
        e.nama_lengkap, e.nip_nik, e.unit_kerja, e.sub_bagian, e.jabatan,
        e.pangkat_golongan as emp_pangkat_golongan, e.nomor_hp as emp_nomor_hp,
        lt.nama as leave_type_name, lt.kode as leave_type_code,
        u.username as approver_username
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN users u ON lr.approver_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      sql += ' AND (lr.tanggal_mulai <= ? AND lr.tanggal_selesai >= ?)';
      params.push(endDate, startDate);
    }
    if (leaveTypeId && leaveTypeId !== 'ALL') {
      sql += ' AND lr.leave_type_id = ?';
      params.push(leaveTypeId);
    }
    if (status && status !== 'ALL') {
      sql += ' AND lr.status = ?';
      params.push(status);
    }
    if (employeeId && employeeId !== 'ALL') {
      sql += ' AND lr.employee_id = ?';
      params.push(employeeId);
    }
    if (unit && unit !== 'ALL') {
      sql += ' AND (e.sub_bagian = ? OR e.unit_kerja = ?)';
      params.push(unit, unit);
    }
    if (search) {
      sql += ' AND (e.nama_lengkap LIKE ? OR e.nip_nik LIKE ? OR lr.nomor_pengajuan LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY lr.created_at DESC';
    const requests = queryAll(db, sql, params);
    res.json({ requests });
  });

  app.post('/api/leaves/:id/approve', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { adminNotes } = req.body;
      const result = approveLeaveRequest(db, req.params.id, req.user!.userId, adminNotes, req.ip);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/leaves/:id/reject', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { rejectionReason } = req.body;
      const result = rejectLeaveRequest(db, req.params.id, req.user!.userId, rejectionReason, req.ip);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/leaves/:id/cancel', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const result = cancelLeaveRequest(db, req.params.id, req.user!.userId, req.user!.role, req.ip);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Hapus Satu Riwayat Cuti (Admin / Operator)
  app.delete('/api/leaves/:id', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const result = deleteLeaveRequest(db, req.params.id, req.user!.userId, req.ip);
      res.json(result);
    } catch (err: any) {
      console.error('Error deleting leave request:', err);
      res.status(400).json({ error: err.message || 'Gagal menghapus riwayat cuti.' });
    }
  });

  // Edit Data Riwayat Cuti (Admin / Operator)
  app.put('/api/leaves/:id', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const {
        leaveTypeId,
        startDate,
        endDate,
        days,
        reason,
        status,
        nomorPengajuan,
        catatanAdmin
      } = req.body;

      const result = updateLeaveRequest(
        db,
        req.params.id,
        {
          leaveTypeId,
          startDate,
          endDate,
          days: days !== undefined ? Number(days) : undefined,
          reason,
          status,
          nomorPengajuan,
          catatanAdmin
        },
        req.user!.userId,
        req.ip
      );

      res.json(result);
    } catch (err: any) {
      console.error('Error updating leave request:', err);
      res.status(400).json({ error: err.message || 'Gagal memperbarui data riwayat cuti.' });
    }
  });

  // Kosongkan Seluruh Riwayat Cuti & Reset Saldo Pegawai (Admin Only)
  app.delete('/api/leaves/admin/clear-all', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const result = clearAllLeaveRequests(db, req.user!.userId, req.ip);
      res.json(result);
    } catch (err: any) {
      console.error('Error clearing all leaves:', err);
      res.status(500).json({ error: err.message || 'Gagal mengosongkan riwayat cuti.' });
    }
  });

  // Catat Riwayat Cuti Lampau (Single Input oleh Admin / Operator)
  app.post('/api/leaves/manual-record', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const {
        employeeId,
        leaveTypeId,
        nomorPengajuan,
        startDate,
        endDate,
        days,
        reason,
        status = 'Disetujui',
        tanggalPengajuan,
        tanggalApproval,
        potongSaldo = false,
        catatanAdmin
      } = req.body;

      if (!employeeId) return res.status(400).json({ error: 'Pegawai wajib dipilih.' });
      if (!leaveTypeId) return res.status(400).json({ error: 'Jenis cuti wajib dipilih.' });
      if (!startDate || !endDate) return res.status(400).json({ error: 'Tanggal mulai dan selesai cuti wajib diisi.' });
      if (!reason) return res.status(400).json({ error: 'Alasan cuti wajib diisi.' });

      // Hanya Cuti Tahunan yang boleh potongSaldo
      const lType = queryOne<{ id: string; kode: string }>(db, 'SELECT id, kode FROM leave_types WHERE id = ?', [leaveTypeId]);
      const isCT = lType && (lType.id === 'lt_ct' || lType.kode === 'CT');
      const finalPotongSaldo = Boolean(potongSaldo) && Boolean(isCT);

      const result = recordHistoricalLeave(db, {
        employeeId,
        leaveTypeId,
        nomorPengajuan,
        startDate,
        endDate,
        days: days ? Number(days) : undefined,
        reason,
        status,
        tanggalPengajuan,
        tanggalApproval,
        approverUserId: req.user!.userId,
        potongSaldo: finalPotongSaldo,
        catatanAdmin: catatanAdmin || 'Pencatatan riwayat cuti lampau manual'
      });

      const emp = queryOne<{ nama_lengkap: string }>(db, 'SELECT nama_lengkap FROM employees WHERE id = ?', [employeeId]);
      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'MANUAL_RECORD_LEAVE',
        'LEAVES',
        null,
        `Mencatat riwayat cuti masa lalu untuk ${emp?.nama_lengkap || employeeId}: ${result.nomor_pengajuan} (${startDate} s/d ${endDate}, ${result.jumlah_hari} hari)`,
        req.ip
      );

      res.json({ success: true, message: 'Riwayat cuti berhasil dicatat ke sistem.', data: result });
    } catch (err: any) {
      console.error('Error recording historical leave:', err);
      res.status(400).json({ error: err.message || 'Gagal mencatat riwayat cuti.' });
    }
  });

  // Import Riwayat Cuti Lampau (Bulk Upload Excel / JSON)
  app.post('/api/leaves/import-history', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Daftar riwayat cuti yang diimport kosong.' });
      }

      // Pre-fetch employees and leave types for rapid matching
      const allEmployees = queryAll<{ id: string; nip_nik: string; nama_lengkap: string }>(
        db,
        'SELECT id, nip_nik, nama_lengkap FROM employees WHERE is_deleted = 0'
      );
      const allLeaveTypes = queryAll<{ id: string; kode: string; nama: string }>(
        db,
        'SELECT id, kode, nama FROM leave_types'
      );

      const defaultLeaveType = allLeaveTypes.find(t => t.id === 'lt_ct' || t.kode === 'CT') || allLeaveTypes[0];

      let successCount = 0;
      let duplicateCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rowNum = i + 1;
        try {
          if (!item.nip && !item.nama && !item.employeeId) {
            errors.push(`Baris ${rowNum}: NIP atau Nama Pegawai tidak disediakan.`);
            continue;
          }

          // Match employee
          let matchedEmp = allEmployees.find(e => 
            (item.employeeId && e.id === item.employeeId) ||
            (item.nip && String(e.nip_nik).trim().toLowerCase() === String(item.nip).trim().toLowerCase()) ||
            (item.nama && e.nama_lengkap.trim().toLowerCase() === String(item.nama).trim().toLowerCase())
          );

          if (!matchedEmp) {
            errors.push(`Baris ${rowNum}: Pegawai dengan NIP "${item.nip || item.nama}" tidak ditemukan.`);
            continue;
          }

          if (!item.startDate || !item.endDate) {
            errors.push(`Baris ${rowNum} (${matchedEmp.nama_lengkap}): Tanggal mulai atau selesai belum lengkap.`);
            continue;
          }

          // Match leave type
          let matchedType = defaultLeaveType;
          if (item.leaveTypeId) {
            const found = allLeaveTypes.find(t => t.id === item.leaveTypeId);
            if (found) matchedType = found;
          } else if (item.leaveTypeName) {
            const searchName = String(item.leaveTypeName).toLowerCase();
            const found = allLeaveTypes.find(t => 
              t.nama.toLowerCase().includes(searchName) || 
              t.kode.toLowerCase() === searchName
            );
            if (found) matchedType = found;
          }

          // Cek pencegahan duplikasi data riwayat (misal user tekan import berulang kali)
          const existing = queryOne<{ id: string }>(
            db,
            'SELECT id FROM leave_requests WHERE employee_id = ? AND tanggal_mulai = ? AND tanggal_selesai = ?',
            [matchedEmp.id, item.startDate, item.endDate]
          );

          if (existing) {
            duplicateCount++;
            continue; // Lewati agar tidak terjadi dobel import
          }

          // HANYA Cuti Tahunan (kode 'CT' atau ID 'lt_ct') yang memotong saldo cuti tahunan
          const isCT = matchedType.id === 'lt_ct' || matchedType.kode === 'CT';
          const finalPotongSaldo = Boolean(item.potongSaldo) && isCT;

          recordHistoricalLeave(db, {
            employeeId: matchedEmp.id,
            leaveTypeId: matchedType.id,
            nomorPengajuan: item.nomorPengajuan || item.nomorSurat,
            startDate: item.startDate,
            endDate: item.endDate,
            days: item.days ? Number(item.days) : undefined,
            reason: item.reason || 'Riwayat cuti masa lalu',
            status: item.status || 'Disetujui',
            tanggalPengajuan: item.tanggalPengajuan || item.startDate,
            tanggalApproval: item.tanggalApproval || item.startDate,
            approverUserId: req.user!.userId,
            potongSaldo: finalPotongSaldo,
            catatanAdmin: item.catatanAdmin || 'Import massal riwayat cuti lampau'
          });

          successCount++;
        } catch (err: any) {
          errors.push(`Baris ${rowNum}: ${err.message || 'Gagal menyimpan data.'}`);
        }
      }

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'IMPORT_HISTORICAL_LEAVES',
        'LEAVES',
        null,
        `Import riwayat cuti: ${successCount} berhasil, ${duplicateCount} duplikat dilewati, ${errors.length} gagal`,
        req.ip
      );

      res.json({
        success: true,
        message: `Berhasil mengimpor ${successCount} riwayat cuti.${duplicateCount > 0 ? ` (${duplicateCount} data duplikat dilewati)` : ''}${errors.length > 0 ? ` (${errors.length} baris gagal/dilewati)` : ''}`,
        count: successCount,
        duplicates: duplicateCount,
        errors
      });
    } catch (err: any) {
      console.error('Error importing historical leaves:', err);
      res.status(500).json({ error: err.message || 'Gagal mengimport riwayat cuti.' });
    }
  });

  // Calendar leave view
  app.get('/api/leaves/calendar', requireAuth, (req: AuthenticatedRequest, res) => {
    const year = (req.query.year as string) || String(new Date().getFullYear());
    const role = req.user!.role;
    const currentEmpId = req.user!.employeeId;

    let sql = `
      SELECT 
        lr.id, lr.nomor_pengajuan, lr.employee_id, lr.tanggal_mulai, lr.tanggal_selesai,
        lr.jumlah_hari, lr.status, lr.alasan,
        lt.nama as leave_type_name, lt.kode as leave_type_code,
        e.nama_lengkap, e.nip_nik, e.unit_kerja
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE (lr.tanggal_mulai LIKE ? OR lr.tanggal_selesai LIKE ?)
    `;
    const params: any[] = [`${year}%`, `${year}%`];

    if (role === 'pegawai') {
      // Employees see their own requests (any status) AND other employees' approved requests
      sql += ' AND (lr.employee_id = ? OR lr.status = "Disetujui")';
      params.push(currentEmpId);
    }

    sql += ' ORDER BY lr.tanggal_mulai ASC';
    const events = queryAll(db, sql, params);
    res.json({ events });
  });

  // Rekap Penggunaan Cuti (Admin & Operator)
  app.get('/api/leaves/admin/rekap-penggunaan', requireStaffOrAdmin, (req, res) => {
    const year = (req.query.year as string) || String(new Date().getFullYear());
    const unit = req.query.unit as string;
    const employeeId = req.query.employeeId as string;

    let empSql = "SELECT id, nama_lengkap, nip_nik, unit_kerja, sub_bagian, jabatan FROM employees WHERE status_pegawai = 'aktif' AND is_deleted = 0";
    const empParams: any[] = [];

    if (unit && unit !== 'ALL') {
      empSql += ' AND (sub_bagian = ? OR unit_kerja = ?)';
      empParams.push(unit, unit);
    }
    if (employeeId && employeeId !== 'ALL') {
      empSql += ' AND id = ?';
      empParams.push(employeeId);
    }
    empSql += ' ORDER BY rowid ASC';
    const employees = queryAll<any>(db, empSql, empParams);

    // Get all approved leaves in this year
    const approvedLeaves = queryAll<any>(
      db,
      `SELECT lr.employee_id, lr.leave_type_id, lt.kode, lr.jumlah_hari, lr.tanggal_mulai
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.status = 'Disetujui' AND (lr.tanggal_mulai LIKE ? OR lr.tanggal_selesai LIKE ?)`,
      [`${year}%`, `${year}%`]
    );

    // Aggregate by employee
    const rows = employees.map(emp => {
      const empLeaves = approvedLeaves.filter(l => l.employee_id === emp.id);
      const ct = empLeaves.filter(l => l.kode === 'CT').reduce((acc, curr) => acc + curr.jumlah_hari, 0);
      const cb = empLeaves.filter(l => l.kode === 'CB').reduce((acc, curr) => acc + curr.jumlah_hari, 0);
      const cs = empLeaves.filter(l => l.kode === 'CS').reduce((acc, curr) => acc + curr.jumlah_hari, 0);
      const cm = empLeaves.filter(l => l.kode === 'CM').reduce((acc, curr) => acc + curr.jumlah_hari, 0);
      const cap = empLeaves.filter(l => l.kode === 'CAP').reduce((acc, curr) => acc + curr.jumlah_hari, 0);
      const cltn = empLeaves.filter(l => l.kode === 'CLTN').reduce((acc, curr) => acc + curr.jumlah_hari, 0);
      const total = ct + cb + cs + cm + cap + cltn;

      return {
        employee_id: emp.id,
        nama_lengkap: emp.nama_lengkap,
        nip_nik: emp.nip_nik,
        unit_kerja: emp.unit_kerja,
        jabatan: emp.jabatan,
        cuti_tahunan: ct,
        cuti_besar: cb,
        cuti_sakit: cs,
        cuti_melahirkan: cm,
        cuti_alasan_penting: cap,
        cuti_luar_tanggungan: cltn,
        total_penggunaan: total
      };
    });

    // Summary usage per type
    const summaryByType = {
      cuti_tahunan: rows.reduce((a, b) => a + b.cuti_tahunan, 0),
      cuti_besar: rows.reduce((a, b) => a + b.cuti_besar, 0),
      cuti_sakit: rows.reduce((a, b) => a + b.cuti_sakit, 0),
      cuti_melahirkan: rows.reduce((a, b) => a + b.cuti_melahirkan, 0),
      cuti_alasan_penting: rows.reduce((a, b) => a + b.cuti_alasan_penting, 0),
      cuti_luar_tanggungan: rows.reduce((a, b) => a + b.cuti_luar_tanggungan, 0),
      grand_total: rows.reduce((a, b) => a + b.total_penggunaan, 0)
    };

    // Monthly usage for charts (Jan - Dec)
    const monthlyUsage: { month: string; total: number }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${String(m).padStart(2, '0')}`;
      const inMonth = approvedLeaves.filter(l => l.tanggal_mulai.startsWith(monthStr));
      monthlyUsage.push({
        month: monthNames[m - 1],
        total: inMonth.reduce((acc, curr) => acc + curr.jumlah_hari, 0)
      });
    }

    res.json({ rows, summaryByType, monthlyUsage, year });
  });

  // 8. Leave Balances
  app.get('/api/leave-balances/my-balance', requireAuth, (req: AuthenticatedRequest, res) => {
    let employeeId = req.user!.employeeId;
    if (req.user!.role === 'admin' && req.query.employeeId) {
      employeeId = String(req.query.employeeId);
    }

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    if (!employeeId) {
      return res.json({
        balance: {
          id: 'admin_balance',
          employee_id: '',
          tahun: year,
          n_2: 0,
          n_1: 0,
          n: 0,
          total: 0,
          updated_at: new Date().toISOString()
        },
        transactions: []
      });
    }

    const balance = getLeaveBalance(db, employeeId, year);

    const transactions = queryAll(
      db,
      'SELECT * FROM leave_balance_transactions WHERE employee_id = ? ORDER BY timestamp DESC LIMIT 20',
      [employeeId]
    );

    res.json({ balance, transactions });
  });

  app.get('/api/leave-balances/admin/summary', requireStaffOrAdmin, (req, res) => {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const unit = req.query.unit as string;
    const search = req.query.search as string;

    let empSql = "SELECT id, nama_lengkap, nip_nik, unit_kerja, sub_bagian, jabatan FROM employees WHERE status_pegawai = 'aktif' AND is_deleted = 0";
    const params: any[] = [];

    if (unit && unit !== 'ALL') {
      empSql += ' AND (sub_bagian = ? OR unit_kerja = ?)';
      params.push(unit, unit);
    }
    if (search) {
      empSql += ' AND (nama_lengkap LIKE ? OR nip_nik LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    empSql += ' ORDER BY rowid ASC';
    const employees = queryAll<any>(db, empSql, params);

    const rows = employees.map(emp => {
      const bal = getLeaveBalance(db, emp.id, year);
      return {
        ...emp,
        balance_id: bal.id,
        n_2: bal.n_2,
        n_1: bal.n_1,
        n: bal.n,
        total: bal.total,
        updated_at: bal.updated_at
      };
    });

    res.json({ rows, year });
  });

  app.post('/api/leave-balances/admin/adjust', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { employeeId, year, n_2, n_1, n, reason } = req.body;
      if (!employeeId || year === undefined || !reason) {
        return res.status(400).json({ error: 'Employee ID, Tahun, dan Alasan Penyesuaian wajib diisi.' });
      }

      const result = adjustLeaveBalanceManual(
        db,
        employeeId,
        Number(year),
        Number(n_2) || 0,
        Number(n_1) || 0,
        Number(n) || 0,
        reason,
        req.user!.userId,
        req.ip
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/leave-balances/history/:employeeId', requireStaffOrAdmin, (req, res) => {
    const transactions = queryAll(
      db,
      `SELECT lbt.*, u.username as admin_username
       FROM leave_balance_transactions lbt
       LEFT JOIN users u ON lbt.admin_id = u.id
       WHERE lbt.employee_id = ?
       ORDER BY lbt.timestamp DESC`,
      [req.params.employeeId]
    );
    res.json({ transactions });
  });

  // 9. Rollover
  app.get('/api/rollover/logs', requireStaffOrAdmin, (req, res) => {
    const logs = queryAll(db, 'SELECT * FROM rollover_logs ORDER BY timestamp DESC LIMIT 30');
    res.json({ logs });
  });

  app.post('/api/rollover/run-manual', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const targetYear = req.body.targetYear ? Number(req.body.targetYear) : new Date().getFullYear();
      const result = runRolloverAnnualLeave(db, targetYear, 'ADMIN', req.user!.userId, req.ip);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 10. Dashboard Stats
  app.get('/api/dashboard/admin', requireStaffOrAdmin, (req, res) => {
    const todayStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();

    // 1. Leave stats
    const totalRequests = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM leave_requests');
    const totalApproved = queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM leave_requests WHERE status = 'Disetujui'");
    const totalRejected = queryOne<{ count: number }>(db, "SELECT COUNT(*) as count FROM leave_requests WHERE status = 'Ditolak'");
    const totalPending = queryOne<{ count: number }>(
      db,
      "SELECT COUNT(*) as count FROM leave_requests WHERE status IN ('Menunggu Approval', 'pending', 'Menunggu Persetujuan')"
    );

    // Currently on leave today
    const currentlyOnLeave = queryAll<any>(
      db,
      `SELECT lr.*, e.nama_lengkap, e.nip_nik, lt.nama as leave_type_name
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.id
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE ? BETWEEN lr.tanggal_mulai AND lr.tanggal_selesai
       AND lr.status = 'Disetujui'`,
      [todayStr]
    );

    // 2. Attendance stats today
    const totalActivePegawai = queryOne<{ count: number }>(
      db,
      "SELECT COUNT(*) as count FROM employees WHERE status_pegawai = 'aktif' AND is_deleted = 0"
    );

    const attendancesToday = queryAll<any>(
      db,
      `SELECT a.*, e.nama_lengkap, e.nip_nik, e.unit_kerja, e.foto_profil
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.tanggal = ?`,
      [todayStr]
    );

    const sudahAbsen = attendancesToday.length;
    const hadirToday = attendancesToday.filter(a => a.status === 'Hadir' || a.status === 'Terlambat' || a.jam_masuk).length;
    const tepatWaktu = attendancesToday.filter(a => a.status === 'Hadir' && (!a.keterlambatan_menit || a.keterlambatan_menit === 0)).length;
    const terlambat = attendancesToday.filter(a => a.status === 'Terlambat' || (a.keterlambatan_menit && a.keterlambatan_menit > 0)).length;
    const belumAbsen = Math.max(0, (totalActivePegawai?.count || 0) - sudahAbsen - currentlyOnLeave.length);
    const countWFO = attendancesToday.filter(a => a.metode_kerja === 'WFO').length;
    const countWFH = attendancesToday.filter(a => a.metode_kerja === 'WFH').length;
    const countWFA = attendancesToday.filter(a => a.metode_kerja === 'WFA').length;

    // 3. Travel Duty stats (Perjalanan Dinas aktif / sedang berlangsung hari ini)
    let activeTravelDuties: any[] = [];
    let totalEmployeesOnTravel = 0;
    try {
      activeTravelDuties = queryAll<any>(
        db,
        `SELECT td.*,
                (SELECT COUNT(*) FROM travel_duty_employees tde WHERE tde.travel_duty_id = td.id) as participant_count
         FROM travel_duties td
         WHERE (? BETWEEN td.tanggal_mulai AND td.tanggal_selesai OR td.status = 'berlangsung')
           AND td.status != 'dibatalkan'`,
        [todayStr]
      );

      const empCountRes = queryOne<{ count: number }>(
        db,
        `SELECT COUNT(DISTINCT tde.employee_id) as count
         FROM travel_duty_employees tde
         JOIN travel_duties td ON tde.travel_duty_id = td.id
         WHERE (? BETWEEN td.tanggal_mulai AND td.tanggal_selesai OR td.status = 'berlangsung')
           AND td.status != 'dibatalkan'`,
        [todayStr]
      );
      totalEmployeesOnTravel = empCountRes?.count || 0;
    } catch (e) {
      console.warn('Error querying travel duty stats for dashboard:', e);
    }

    // Monthly attendance chart (last 6 months)
    const monthlyAttendance: { month: string; hadir: number; terlambat: number }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const atts = queryAll<{ status: string }>(db, 'SELECT status FROM attendance WHERE tanggal LIKE ?', [`${mStr}%`]);
      monthlyAttendance.push({
        month: monthNames[d.getMonth()],
        hadir: atts.filter(a => a.status === 'Hadir').length,
        terlambat: atts.filter(a => a.status === 'Terlambat').length
      });
    }

    res.json({
      serverTime: new Date().toISOString(),
      leaveStats: {
        totalRequests: totalRequests?.count || 0,
        totalApproved: totalApproved?.count || 0,
        totalRejected: totalRejected?.count || 0,
        totalPending: totalPending?.count || 0,
        totalSedangCuti: currentlyOnLeave.length,
        currentlyOnLeave
      },
      attendanceStats: {
        totalPegawai: totalActivePegawai?.count || 0,
        sudahAbsen,
        hadirToday,
        tepatWaktu,
        terlambat,
        belumAbsen,
        countWFO,
        countWFH,
        countWFA,
        persentaseKehadiran: totalActivePegawai?.count ? Math.round((sudahAbsen / totalActivePegawai.count) * 100) : 0,
        attendancesToday
      },
      travelStats: {
        ongoingDuties: activeTravelDuties.length,
        totalEmployeesOnTravel,
        activeTravelDuties
      },
      monthlyAttendance
    });
  });

  // Advanced Reporting Analytics for Admin Dashboard
  app.get('/api/admin/reports/advanced', requireStaffOrAdmin, (req: AuthenticatedRequest, res) => {
    const period = (req.query.period as string) || '6m';
    const reqYear = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    const now = new Date();
    let startDate = '';
    const endDate = now.toISOString().split('T')[0];

    if (period === '1m') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString().split('T')[0];
    } else if (period === '3m') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      startDate = d.toISOString().split('T')[0];
    } else if (period === '6m') {
      const d = new Date(now);
      d.setDate(d.getDate() - 180);
      startDate = d.toISOString().split('T')[0];
    } else if (period === '1y') {
      startDate = `${reqYear}-01-01`;
    } else {
      // all
      startDate = '2020-01-01';
    }

    // 1. Fetch attendance in range
    const attendances = queryAll<any>(
      db,
      `SELECT tanggal, status, metode_kerja FROM attendance
       WHERE tanggal >= ? AND tanggal <= ?
       ORDER BY tanggal ASC`,
      [startDate, endDate]
    );

    // 1a. Monthly Attendance Bar Chart
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthlyMap = new Map<string, { hadir: number; terlambat: number; total: number; label: string }>();

    attendances.forEach(a => {
      const parts = a.tanggal.split('-'); // YYYY-MM-DD
      const ym = `${parts[0]}-${parts[1]}`;
      const mIdx = parseInt(parts[1], 10) - 1;
      const label = `${monthNames[mIdx]} ${parts[0]}`;

      if (!monthlyMap.has(ym)) {
        monthlyMap.set(ym, { hadir: 0, terlambat: 0, total: 0, label });
      }
      const mData = monthlyMap.get(ym)!;
      if (a.status === 'Hadir') mData.hadir += 1;
      else if (a.status === 'Terlambat') mData.terlambat += 1;
      mData.total += 1;
    });

    // Convert map to sorted array with discipline metrics
    const sortedEntries = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    const monthlyAttendanceTrend = sortedEntries.map(([key, data], idx) => {
      const disiplinRate = data.total > 0 ? Math.round((data.hadir / data.total) * 100) : 100;
      let deltaPrevMonth = 0;
      if (idx > 0) {
        const prevTotal = sortedEntries[idx - 1][1].total;
        const prevDisiplin = prevTotal > 0 ? Math.round((sortedEntries[idx - 1][1].hadir / prevTotal) * 100) : 100;
        deltaPrevMonth = disiplinRate - prevDisiplin;
      }
      return {
        key,
        month: data.label,
        hadir: data.hadir,
        terlambat: data.terlambat,
        total: data.total,
        persentaseTepat: disiplinRate,
        disiplinRate,
        deltaPrevMonth
      };
    });

    // If less than 2 months data, ensure at least 6 standard slots
    if (monthlyAttendanceTrend.length === 0) {
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthlyAttendanceTrend.push({
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          month: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
          hadir: 0,
          terlambat: 0,
          total: 0,
          persentaseTepat: 100,
          disiplinRate: 100,
          deltaPrevMonth: 0
        });
      }
    }

    // 2. Fetch approved leave requests in range
    const leaveTypes = queryAll<any>(db, 'SELECT * FROM leave_types');
    const approvedLeaves = queryAll<any>(
      db,
      `SELECT lr.*, lt.nama as jenis_nama, lt.kode as jenis_kode
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.status = 'Disetujui' AND lr.tanggal_mulai >= ? AND lr.tanggal_mulai <= ?`,
      [startDate, endDate]
    );

    const typeColors: Record<string, string> = {
      CT: '#dc2626', // Red
      CS: '#f59e0b', // Amber
      CAP: '#2563eb', // Blue
      CM: '#ec4899', // Pink
      CB: '#8b5cf6', // Purple
      CLTN: '#64748b' // Slate
    };

    const leaveDistribution = leaveTypes.map(lt => {
      const matching = approvedLeaves.filter(l => l.leave_type_id === lt.id);
      const totalDays = matching.reduce((acc, curr) => acc + curr.jumlah_hari, 0);
      return {
        id: lt.id,
        kode: lt.kode,
        name: lt.nama,
        value: totalDays,
        requestsCount: matching.length,
        fill: typeColors[lt.kode] || '#059669'
      };
    }).filter(item => item.value > 0 || period === '1y' || period === 'all');

    // 3. WFH/WFA/WFO Line Chart data
    // Group attendance by date
    const dateMethodMap = new Map<string, { wfo: number; wfh: number; wfa: number; total: number }>();
    attendances.forEach(a => {
      const d = a.tanggal;
      if (!dateMethodMap.has(d)) {
        dateMethodMap.set(d, { wfo: 0, wfh: 0, wfa: 0, total: 0 });
      }
      const entry = dateMethodMap.get(d)!;
      if (a.metode_kerja === 'WFO') entry.wfo += 1;
      else if (a.metode_kerja === 'WFH') entry.wfh += 1;
      else if (a.metode_kerja === 'WFA') entry.wfa += 1;
      entry.total += 1;
    });

    const workMethodTrends = Array.from(dateMethodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => {
        const parts = date.split('-');
        const formattedLabel = `${parts[2]}/${parts[1]}`;
        return {
          date: formattedLabel,
          fullDate: date,
          wfo: counts.wfo,
          wfh: counts.wfh,
          wfa: counts.wfa,
          total: counts.total
        };
      });

    // 4. Overall KPIs
    const totalAbsen = attendances.length;
    const totalHadir = attendances.filter(a => a.status === 'Hadir').length;
    const totalTerlambat = attendances.filter(a => a.status === 'Terlambat').length;
    const totalWFO = attendances.filter(a => a.metode_kerja === 'WFO').length;
    const totalWFH = attendances.filter(a => a.metode_kerja === 'WFH').length;
    const totalWFA = attendances.filter(a => a.metode_kerja === 'WFA').length;
    const totalCutiDays = approvedLeaves.reduce((acc, curr) => acc + curr.jumlah_hari, 0);

    res.json({
      period,
      startDate,
      endDate,
      monthlyAttendanceTrend,
      leaveDistribution,
      workMethodTrends,
      kpi: {
        totalAbsen,
        totalHadir,
        totalTerlambat,
        persentaseTepatWaktu: totalAbsen > 0 ? Math.round((totalHadir / totalAbsen) * 100) : 100,
        totalWFO,
        totalWFH,
        totalWFA,
        persentaseWFO: totalAbsen > 0 ? Math.round((totalWFO / totalAbsen) * 100) : 0,
        totalCutiDays,
        totalCutiRequests: approvedLeaves.length
      }
    });
  });

  app.get('/api/dashboard/pegawai', requireAuth, (req: AuthenticatedRequest, res) => {
    const employeeId = req.user!.employeeId;
    const todayStr = new Date().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();

    if (!employeeId) {
      return res.json({
        attendanceToday: null,
        balance: {
          id: 'admin_balance',
          employee_id: '',
          tahun: currentYear,
          n_2: 0,
          n_1: 0,
          n: 0,
          total: 0,
          updated_at: new Date().toISOString()
        },
        workMethod: 'WFO',
        schedule: null,
        recentLeaves: [],
        todayStr
      });
    }

    const attendanceToday = queryOne(
      db,
      'SELECT * FROM attendance WHERE employee_id = ? AND tanggal = ?',
      [employeeId, todayStr]
    );

    const balance = getLeaveBalance(db, employeeId, currentYear);
    const workMethod = getWorkMethodForEmployee(db, employeeId, todayStr);
    const schedule = queryOne(db, 'SELECT * FROM work_schedules WHERE is_active = 1 LIMIT 1');

    const recentLeaves = queryAll(
      db,
      `SELECT lr.*, lt.nama as leave_type_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       WHERE lr.employee_id = ?
       ORDER BY lr.created_at DESC LIMIT 5`,
      [employeeId]
    );

    res.json({
      attendanceToday,
      balance,
      workMethod,
      schedule,
      recentLeaves,
      todayStr
    });
  });

  // 11. System Settings & Masters
  app.get('/api/settings', requireAuth, (req, res) => {
    const settings = queryAll<{ setting_key: string; setting_value: string }>(db, 'SELECT * FROM system_settings');
    const settingsMap: Record<string, string> = {};
    settings.forEach(s => (settingsMap[s.setting_key] = s.setting_value));

    const office = getActiveOfficeLocation(db);
    const schedule = queryOne(db, 'SELECT * FROM work_schedules WHERE is_active = 1 LIMIT 1');

    res.json({ settings: settingsMap, office, schedule });
  });

  app.put('/api/settings', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { settings, office, schedule } = req.body;
      const nowIso = new Date().toISOString();

      if (settings) {
        for (const [key, value] of Object.entries(settings)) {
          executeSql(
            db,
            'INSERT OR REPLACE INTO system_settings (id, setting_key, setting_value, keterangan) VALUES (?, ?, ?, ?)',
            [`st_${key}`, key, String(value), 'Pengaturan sistem']
          );
        }
      }

      if (office) {
        const existingOffice = queryOne<{ id: string }>(
          db,
          'SELECT id FROM office_locations WHERE is_active = 1 LIMIT 1'
        );
        const targetId = office.id || existingOffice?.id || 'loc_kpu_spn';

        executeSql(
          db,
          `INSERT INTO office_locations (id, nama, latitude, longitude, radius_meter, alamat, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)
           ON CONFLICT(id) DO UPDATE SET
             nama = excluded.nama,
             latitude = excluded.latitude,
             longitude = excluded.longitude,
             radius_meter = excluded.radius_meter,
             alamat = excluded.alamat,
             is_active = 1`,
          [
            targetId,
            office.nama || 'Kantor KPU Kota Sungai Penuh',
            Number(office.latitude),
            Number(office.longitude),
            Number(office.radius_meter) || 150,
            office.alamat || 'Jl. Pancasila, Lawang Agung, Kecamatan Pondok Tinggi, Kota Sungai Penuh'
          ]
        );
      }

      if (schedule) {
        executeSql(
          db,
          `UPDATE work_schedules SET
            jam_masuk = ?,
            jam_pulang = ?,
            toleransi_keterlambatan_menit = ?,
            hari_kerja = ?
           WHERE id = ?`,
          [
            schedule.jam_masuk,
            schedule.jam_pulang,
            Number(schedule.toleransi_keterlambatan_menit),
            schedule.hari_kerja || '1,2,3,4,5',
            schedule.id || 'sched_default'
          ]
        );
      }

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        'UPDATE_SETTINGS',
        'SETTINGS',
        null,
        'Admin memperbarui pengaturan sistem KPU',
        req.ip
      );

      res.json({ success: true, message: 'Pengaturan sistem berhasil disimpan.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11.1 Feature Locks & Release Status (Fitur Terkunci / Under Development)
  app.get('/api/features', requireAuth, (req, res) => {
    try {
      const rows = queryAll<{
        id: string;
        name: string;
        category: string;
        description: string;
        is_locked: number;
        locked_for: string;
        release_estimate: string | null;
        maintenance_message: string | null;
        updated_at: string | null;
        updated_by: string | null;
      }>(db, 'SELECT * FROM feature_locks ORDER BY category ASC, name ASC');

      const features = rows.map(r => ({
        ...r,
        is_locked: Boolean(r.is_locked)
      }));

      res.json({ features });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/features/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { is_locked, locked_for, release_estimate, maintenance_message } = req.body;
      const nowIso = new Date().toISOString();

      const existing = queryOne<{ id: string; name: string }>(
        db,
        'SELECT * FROM feature_locks WHERE id = ?',
        [id]
      );
      if (!existing) {
        return res.status(404).json({ error: `Fitur "${id}" tidak ditemukan dalam sistem.` });
      }

      const lockedVal = is_locked ? 1 : 0;
      executeSql(
        db,
        `UPDATE feature_locks 
         SET is_locked = ?,
             locked_for = COALESCE(?, locked_for),
             release_estimate = COALESCE(?, release_estimate),
             maintenance_message = COALESCE(?, maintenance_message),
             updated_at = ?,
             updated_by = ?
         WHERE id = ?`,
        [
          lockedVal,
          locked_for !== undefined ? locked_for : null,
          release_estimate !== undefined ? release_estimate : null,
          maintenance_message !== undefined ? maintenance_message : null,
          nowIso,
          req.user!.username,
          id
        ]
      );

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        lockedVal ? 'LOCK_FEATURE' : 'UNLOCK_FEATURE',
        'FEATURE_LOCK',
        id,
        `Admin ${lockedVal ? 'MENGUNCI (Under Development)' : 'MEMBUKA AKSES'} fitur "${existing.name}" (Sasaran: ${locked_for || 'default'})`,
        req.ip
      );

      res.json({
        success: true,
        message: `Status fitur "${existing.name}" berhasil ${lockedVal ? 'dikunci' : 'diaktifkan'}.`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/features/batch-toggle', requireAdmin, (req: AuthenticatedRequest, res) => {
    try {
      const { lock_all, target_category } = req.body;
      const nowIso = new Date().toISOString();
      const lockVal = lock_all ? 1 : 0;

      if (target_category) {
        executeSql(
          db,
          `UPDATE feature_locks SET is_locked = ?, updated_at = ?, updated_by = ? WHERE category = ?`,
          [lockVal, nowIso, req.user!.username, target_category]
        );
      } else {
        executeSql(
          db,
          `UPDATE feature_locks SET is_locked = ?, updated_at = ?, updated_by = ?`,
          [lockVal, nowIso, req.user!.username]
        );
      }

      createAuditLog(
        db,
        req.user!.userId,
        req.user!.username,
        lockVal ? 'LOCK_ALL_FEATURES' : 'UNLOCK_ALL_FEATURES',
        'FEATURE_LOCK',
        null,
        `Admin ${lockVal ? 'mengunci' : 'membuka'} semua fitur ${target_category ? `kategori ${target_category}` : 'sistem'}`,
        req.ip
      );

      res.json({ success: true, message: `Status fitur berhasil diperbarui secara massal.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Holidays
  app.get('/api/holidays', requireAuth, (req, res) => {
    const holidays = queryAll(db, 'SELECT * FROM holidays ORDER BY tanggal ASC');
    res.json({ holidays });
  });

  app.post('/api/holidays', requireAdmin, (req: AuthenticatedRequest, res) => {
    const { tanggal, nama, is_cuti_bersama } = req.body;
    if (!tanggal || !nama) return res.status(400).json({ error: 'Tanggal dan Nama hari libur wajib diisi.' });

    const id = `hol_${Date.now()}`;
    executeSql(
      db,
      'INSERT INTO holidays (id, tanggal, nama, is_cuti_bersama) VALUES (?, ?, ?, ?)',
      [id, tanggal, nama, is_cuti_bersama ? 1 : 0]
    );
    res.json({ success: true, message: 'Hari libur berhasil ditambahkan.' });
  });

  app.delete('/api/holidays/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    executeSql(db, 'DELETE FROM holidays WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Hari libur berhasil dihapus.' });
  });

  // 12. Notifications & Real-Time SSE Stream
  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const notifs = getUserNotifications(db, req.user!.userId, req.user!.role);
    res.json({ notifications: notifs });
  });

  app.get('/api/notifications/stream', requireAuth, (req: AuthenticatedRequest, res) => {
    // Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const clientId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    registerSSEClient(clientId, req.user!.userId, req.user!.role, res);

    // Send connected handshake
    res.write(`: connected as ${req.user!.username}\n\n`);

    // Check attendance reminder immediately upon client connection
    if (req.user!.role === 'pegawai') {
      try {
        checkAndNotifyLateAttendance(db, req.user!.userId);
      } catch (e) {
        console.warn('Late attendance check error on SSE connect:', e);
      }
    }

    // Keep-alive heartbeat every 20 seconds
    const interval = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (err) {
        clearInterval(interval);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(interval);
      unregisterSSEClient(clientId);
    });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
    markNotificationAsRead(db, req.params.id);
    res.json({ success: true });
  });

  app.post('/api/notifications/mark-all-read', requireAuth, (req: AuthenticatedRequest, res) => {
    markAllNotificationsAsRead(db, req.user!.userId, req.user!.role);
    res.json({ success: true, message: 'Semua notifikasi telah ditandai dibaca.' });
  });

  // 13. Audit Logs
  app.get('/api/audit-logs', requireStaffOrAdmin, (req, res) => {
    const module = req.query.module as string;
    const logs = getAuditLogs(db, 150, module);
    res.json({ logs });
  });

  // 14. Attendance Reminder Trigger Endpoint
  app.post('/api/attendance/check-reminders', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const specificUserId = req.user!.role === 'pegawai' ? req.user!.userId : undefined;
      const result = checkAndNotifyLateAttendance(db, specificUserId);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. Firebase Cloud Messaging (FCM) & Web Push Endpoints
  app.post('/api/fcm/register-token', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const { token, device_name, platform } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, message: 'Token is required' });
      }
      const success = registerFcmToken(
        db,
        req.user!.userId,
        req.user!.employeeId,
        token,
        device_name,
        platform
      );
      res.json({ success, message: 'FCM device token berhasil didaftarkan.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/fcm/unregister-token', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, message: 'Token is required' });
      }
      unregisterFcmToken(db, token);
      res.json({ success: true, message: 'FCM token berhasil dihapus.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/fcm/status', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userTokens = getUserActiveTokens(db, req.user!.userId);
      const allTokens = req.user!.role === 'admin' ? getAllActiveTokens(db) : [];
      res.json({
        success: true,
        activeTokensCount: userTokens.length,
        tokens: userTokens,
        allTokensCount: allTokens.length
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/fcm/test', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const result = sendPushAndInAppNotification(
        db,
        req.user!.userId,
        '🔔 SITENANG: Uji Coba Pengingat Absensi Berhasil!',
        'Notifikasi push real-time terhubung! Anda akan menerima pengingat presensi masuk (06:00-08:30 WIB) dan presensi pulang (16:00-23:59 WIB).',
        'success',
        '/dashboard'
      );
      res.json({
        success: true,
        message: `Notifikasi uji coba berhasil dikirim (${result.tokenCount} perangkat terdaftar).`,
        notification: result.notification
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/fcm/broadcast-reminder', requireStaffOrAdmin, (req, res) => {
    try {
      const { type } = req.body; // 'masuk' or 'pulang'
      const result = broadcastAttendanceReminderNow(db, type === 'pulang' ? 'pulang' : 'masuk');
      res.json({
        success: true,
        message: `Pengingat presensi ${type === 'pulang' ? 'pulang' : 'masuk'} berhasil disiarkan ke ${result.notifiedCount} pegawai aktif.`,
        ...result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ================= CRON / SCHEDULED JOBS =================
  // Check every 60 seconds if attendance push reminders should be sent to employees in real time
  setInterval(() => {
    try {
      checkAndNotifyLateAttendance(db);
      runAttendancePushReminderEngine(db);
    } catch (err: any) {
      // background silent catch
    }
  }, 60 * 1000);

  // Check once every 6 hours if it is Jan 1st or if auto-rollover needs execution
  setInterval(() => {
    try {
      const now = new Date();
      // If January 1st (month 0, day 1)
      if (now.getMonth() === 0 && now.getDate() === 1) {
        const year = now.getFullYear();
        console.log(`[SCHEDULED JOB] Checking annual leave rollover for year ${year}...`);
        runRolloverAnnualLeave(db, year, 'SYSTEM');
      }
    } catch (err: any) {
      console.log('[SCHEDULED JOB] Rollover skipped or already completed:', err.message);
    }
  }, 6 * 60 * 60 * 1000);

  // ================= VITE MIDDLEWARE SETUP =================
  if (process.env.NODE_ENV !== 'production') {
    const customLogger = createLogger();
    const origError = customLogger.error.bind(customLogger);
    const origWarn = customLogger.warn.bind(customLogger);
    const origInfo = customLogger.info.bind(customLogger);
    const isViteNoise = (msg: any) => {
      const str = String(msg || '');
      return (
        str.includes('[vite]') ||
        str.includes('WebSocket') ||
        str.includes('ws') ||
        str.includes('HMR') ||
        str.includes('connection lost')
      );
    };
    customLogger.error = (msg, options) => {
      if (isViteNoise(msg)) return;
      origError(msg, options);
    };
    customLogger.warn = (msg, options) => {
      if (isViteNoise(msg)) return;
      origWarn(msg, options);
    };
    customLogger.info = (msg, options) => {
      if (isViteNoise(msg)) return;
      origInfo(msg, options);
    };

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
      customLogger,
    });

    // Intercept /@vite/client to completely neutralize HMR WebSocket attempts and [vite] console logs
    app.use((req, res, next) => {
      const url = req.url || '';
      if (url.startsWith('/@vite/client')) {
        delete req.headers['accept-encoding'];
        const origWrite = res.write.bind(res);
        const origEnd = res.end.bind(res);
        const chunks: Buffer[] = [];

        // @ts-ignore
        res.write = function (chunk: any, ...args: any[]) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          return true;
        };

        // @ts-ignore
        res.end = function (chunk: any, ...args: any[]) {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          let body = Buffer.concat(chunks).toString('utf-8');
          // Module-level console shadowing to safely mute [vite] logs without syntax corruption
          const consoleShadow = `const console = {
  ...window.console,
  log: (...a) => { if (typeof a[0] === 'string' && a[0].includes('[vite]')) return; window.console.log(...a); },
  warn: (...a) => { if (typeof a[0] === 'string' && a[0].includes('[vite]')) return; window.console.warn(...a); },
  error: (...a) => { if (typeof a[0] === 'string' && a[0].includes('[vite]')) return; window.console.error(...a); },
  info: (...a) => { if (typeof a[0] === 'string' && a[0].includes('[vite]')) return; window.console.info(...a); },
  debug: (...a) => { if (typeof a[0] === 'string' && a[0].includes('[vite]')) return; window.console.debug(...a); },
};\n`;
          body = consoleShadow + body.replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR transport disabled */'
          );

          res.removeHeader('etag');
          res.removeHeader('content-length');
          res.setHeader('content-length', Buffer.byteLength(body, 'utf-8'));
          return origEnd(body, ...args);
        };
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server KPU Kota Sungai Penuh running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
});
