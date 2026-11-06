import { Database } from 'sql.js';
import { executeSql, queryAll } from '../db';
import type { Response } from 'express';

interface SSEClient {
  id: string;
  userId: string;
  role: string;
  res: Response;
}

const sseClients: Map<string, SSEClient> = new Map();

export function registerSSEClient(clientId: string, userId: string, role: string, res: Response) {
  sseClients.set(clientId, { id: clientId, userId, role, res });
}

export function unregisterSSEClient(clientId: string) {
  sseClients.delete(clientId);
}

export function createNotification(
  db: Database,
  userId: string,
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  actionUrl?: string
) {
  const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();

  executeSql(
    db,
    `INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [id, userId, title, message, type, now]
  );

  // Broadcast to matching SSE clients in real-time
  const payload = {
    id,
    user_id: userId,
    title,
    message,
    type,
    is_read: 0,
    created_at: now,
    action_url: actionUrl
  };

  const sseData = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`;

  sseClients.forEach(client => {
    try {
      if (userId === 'ADMIN' && client.role === 'admin') {
        client.res.write(sseData);
      } else if (client.userId === userId) {
        client.res.write(sseData);
      }
    } catch (err) {
      console.warn('Error pushing SSE notification to client', client.id, err);
    }
  });

  return payload;
}

export function getUserNotifications(db: Database, userId: string, role: string) {
  if (role === 'admin') {
    return queryAll(
      db,
      "SELECT * FROM notifications WHERE user_id = ? OR user_id = 'ADMIN' ORDER BY created_at DESC LIMIT 40",
      [userId]
    );
  }
  return queryAll(
    db,
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40',
    [userId]
  );
}

export function markNotificationAsRead(db: Database, notificationId: string) {
  executeSql(db, 'UPDATE notifications SET is_read = 1 WHERE id = ?', [notificationId]);
}

export function markAllNotificationsAsRead(db: Database, userId: string, role: string) {
  if (role === 'admin') {
    executeSql(db, "UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id = 'ADMIN'", [userId]);
  } else {
    executeSql(db, 'UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
  }
}
