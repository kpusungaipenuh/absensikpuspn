import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Database } from 'sql.js';
import { queryOne, executeSql, getDbSync, saveDb } from './db';
import { createAuditLog } from './services/auditService';

// In-memory active session token map + SQLite persistent table
export type UserRole = 'admin' | 'operator_sdm' | 'operator_keuangan' | 'operator_umum' | 'pegawai';

interface SessionData {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
  employeeId: string | null;
  namaLengkap: string;
  nip_nik?: string;
  jabatan?: string;
  unitKerja?: string;
  fotoProfil?: string;
  operatorRole?: string | null;
  expiresAt: number;
}

const sessions = new Map<string, SessionData>();

// Session timeout: 7 days for stable operational experience
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createSession(data: Omit<SessionData, 'expiresAt'>): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const sessionData: SessionData = { ...data, expiresAt };
  sessions.set(token, sessionData);

  const db = getDbSync();
  if (db) {
    try {
      executeSql(
        db,
        `INSERT OR REPLACE INTO user_sessions (
          token, user_id, username, email, role, employee_id, nama_lengkap, nip_nik, jabatan, unit_kerja, foto_profil, operator_role, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          token,
          data.userId,
          data.username,
          data.email,
          data.role,
          data.employeeId,
          data.namaLengkap,
          data.nip_nik || null,
          data.jabatan || null,
          data.unitKerja || null,
          data.fotoProfil || null,
          data.operatorRole || null,
          expiresAt,
          new Date().toISOString()
        ]
      );
      saveDb(db);
    } catch (err) {
      console.warn('Could not persist session to SQLite:', err);
    }
  }

  return token;
}

export function getSession(token: string): SessionData | null {
  if (!token) return null;

  // 1. Check in-memory map
  const session = sessions.get(token);
  if (session) {
    if (Date.now() > session.expiresAt) {
      destroySession(token);
      return null;
    }
    return session;
  }

  // 2. Check SQLite persistent database
  const db = getDbSync();
  if (db) {
    try {
      const row = queryOne<{
        token: string;
        user_id: string;
        username: string;
        email: string;
        role: UserRole;
        employee_id: string | null;
        nama_lengkap: string;
        nip_nik: string | null;
        jabatan: string | null;
        unit_kerja: string | null;
        foto_profil: string | null;
        operator_role: string | null;
        expires_at: number;
      }>(db, 'SELECT * FROM user_sessions WHERE token = ?', [token]);

      if (row) {
        if (Date.now() > row.expires_at) {
          executeSql(db, 'DELETE FROM user_sessions WHERE token = ?', [token]);
          saveDb(db);
          return null;
        }

        const restoredSession: SessionData = {
          userId: row.user_id,
          username: row.username,
          email: row.email,
          role: row.role,
          employeeId: row.employee_id,
          namaLengkap: row.nama_lengkap,
          nip_nik: row.nip_nik || undefined,
          jabatan: row.jabatan || undefined,
          unitKerja: row.unit_kerja || undefined,
          fotoProfil: row.foto_profil || undefined,
          operatorRole: row.operator_role || undefined,
          expiresAt: row.expires_at
        };

        sessions.set(token, restoredSession);
        return restoredSession;
      }
    } catch (err) {
      console.warn('Error reading session from DB:', err);
    }
  }

  return null;
}

export function destroySession(token: string): boolean {
  sessions.delete(token);
  const db = getDbSync();
  if (db) {
    try {
      executeSql(db, 'DELETE FROM user_sessions WHERE token = ?', [token]);
      saveDb(db);
    } catch (err) {
      console.warn('Error deleting session from DB:', err);
    }
  }
  return true;
}

export function updateSession(token: string, updates: Partial<SessionData>): void {
  const session = sessions.get(token);
  if (session) {
    Object.assign(session, updates);
  }
  const db = getDbSync();
  if (db) {
    try {
      executeSql(
        db,
        `UPDATE user_sessions SET
          nama_lengkap = COALESCE(?, nama_lengkap),
          foto_profil = COALESCE(?, foto_profil),
          jabatan = COALESCE(?, jabatan),
          unit_kerja = COALESCE(?, unit_kerja),
          role = COALESCE(?, role),
          operator_role = COALESCE(?, operator_role)
        WHERE token = ?`,
        [
          updates.namaLengkap || null,
          updates.fotoProfil || null,
          updates.jabatan || null,
          updates.unitKerja || null,
          updates.role || null,
          updates.operatorRole || null,
          token
        ]
      );
      saveDb(db);
    } catch (err) {
      console.warn('Error updating session in DB:', err);
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: SessionData;
  token?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    const session = getSession(token);
    if (session) {
      req.user = session;
      req.token = token;
    }
  }

  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir. Harap login kembali.' });
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak. Fitur ini hanya untuk Administrator.' });
  }
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Akses ditolak. Fitur ini membutuhkan hak akses: ${allowedRoles.join(', ')}.`
      });
    }
    next();
  };
}

export const requireSdmOrAdmin = requireRole(['admin', 'operator_sdm']);
export const requireKeuanganOrAdmin = requireRole(['admin', 'operator_keuangan']);
export const requireUmumOrAdmin = requireRole(['admin', 'operator_umum']);
export const requireStaffOrAdmin = requireRole(['admin', 'operator_sdm', 'operator_keuangan', 'operator_umum']);

export function requirePegawai(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir.' });
  }
  next();
}
