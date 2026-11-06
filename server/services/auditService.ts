import { Database } from 'sql.js';
import { executeSql, queryAll } from '../db';

export function createAuditLog(
  db: Database,
  userId: string | null,
  username: string,
  action: string,
  module: string,
  oldValue: string | null,
  newValue: string | null,
  ipAddress?: string
) {
  const id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();

  executeSql(
    db,
    `INSERT INTO audit_logs (id, user_id, username, action, module, old_value, new_value, ip_address, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, username, action, module, oldValue, newValue, ipAddress || '127.0.0.1', now]
  );
}

export function getAuditLogs(db: Database, limit: number = 150, moduleFilter?: string) {
  let sql = `
    SELECT 
      a.id,
      a.user_id,
      a.username,
      COALESCE(e.nama_lengkap, u.username, a.username) as user_nama,
      e.nama_lengkap as employee_nama,
      e.nip_nik as employee_nip,
      COALESCE(u.role, e.operator_role, 'pegawai') as user_role,
      a.action,
      a.module,
      a.old_value,
      a.new_value,
      a.new_value as keterangan,
      a.ip_address,
      a.timestamp
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN employees e ON u.employee_id = e.id
  `;
  const params: any[] = [];
  if (moduleFilter && moduleFilter !== 'ALL') {
    sql += ' WHERE a.module = ?';
    params.push(moduleFilter);
  }
  sql += ' ORDER BY a.timestamp DESC LIMIT ?';
  params.push(limit);

  return queryAll(db, sql, params);
}
