import { AttendanceRecord } from '../types';

const DB_NAME = 'absensi_kpu_offline_db';
const DB_VERSION = 1;

// Object store names
const STORE_HISTORY = 'attendance_history';
const STORE_METADATA = 'attendance_meta';
const STORE_TODAY = 'attendance_today';

interface StoredAttendanceRecord extends AttendanceRecord {
  _cachedAt: number;
  _yearMonth: string; // "YYYY-MM"
  _employeeIdKey: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open and initialize the IndexedDB database for attendance offline storage
 */
export function getOfflineDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // 1. Attendance History Store
        if (!db.objectStoreNames.contains(STORE_HISTORY)) {
          const historyStore = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
          historyStore.createIndex('tanggal', 'tanggal', { unique: false });
          historyStore.createIndex('employee_id', 'employee_id', { unique: false });
          historyStore.createIndex('year_month', '_yearMonth', { unique: false });
          historyStore.createIndex('emp_year_month', '_employeeIdKey', { unique: false });
        }

        // 2. Metadata Store (last sync timestamps, user info, etc.)
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
        }

        // 3. Today Attendance Store
        if (!db.objectStoreNames.contains(STORE_TODAY)) {
          db.createObjectStore(STORE_TODAY, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        dbPromise = null;
        reject(request.error);
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Format year & month helper (e.g. 2026, 9 -> "2026-09")
 */
function toYearMonth(year?: number, month?: number): string {
  if (!year || !month) return '';
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Save an array of AttendanceRecord items to IndexedDB
 */
export async function saveAttendanceHistoryToIndexedDB(
  records: AttendanceRecord[],
  options?: { employeeId?: string; year?: number; month?: number }
): Promise<void> {
  if (!Array.isArray(records) || records.length === 0) {
    // If empty array for specific month, still update last sync metadata
    if (options?.year && options?.month) {
      await setLastSyncTime(options.employeeId, options.year, options.month);
    }
    return;
  }

  try {
    const db = await getOfflineDb();
    const now = Date.now();
    const targetYm = options?.year && options?.month ? toYearMonth(options.year, options.month) : '';

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_HISTORY, STORE_METADATA], 'readwrite');
      const store = tx.objectStore(STORE_HISTORY);
      const metaStore = tx.objectStore(STORE_METADATA);

      tx.onerror = () => {
        console.error('Transaction error saving attendance history:', tx.error);
        reject(tx.error);
      };

      tx.oncomplete = () => {
        resolve();
      };

      for (const rec of records) {
        if (!rec.id && !rec.tanggal) continue;
        const recordId = rec.id || `${rec.employee_id || 'me'}_${rec.tanggal}`;
        
        let ym = '';
        if (rec.tanggal) {
          const parts = rec.tanggal.split('-');
          if (parts.length >= 2) {
            ym = `${parts[0]}-${parts[1]}`;
          }
        }
        if (!ym && targetYm) {
          ym = targetYm;
        }

        const empKey = options?.employeeId || rec.employee_id || 'default';
        const compositeKey = `${empKey}_${ym}`;

        const item: StoredAttendanceRecord = {
          ...rec,
          id: recordId,
          _cachedAt: now,
          _yearMonth: ym,
          _employeeIdKey: compositeKey,
        };

        store.put(item);
      }

      // Save sync metadata
      const metaKey = options?.year && options?.month 
        ? `sync_${options.employeeId || 'all'}_${options.year}_${options.month}` 
        : `sync_${options?.employeeId || 'all'}_general`;

      metaStore.put({
        key: metaKey,
        lastSync: now,
        count: records.length,
        updatedAt: new Date().toISOString()
      });

      metaStore.put({
        key: 'global_last_sync',
        lastSync: now,
        count: records.length,
        updatedAt: new Date().toISOString()
      });
    });
  } catch (err) {
    console.warn('Failed to save attendance history to IndexedDB:', err);
  }
}

/**
 * Retrieve cached AttendanceRecord items from IndexedDB
 */
export async function getAttendanceHistoryFromIndexedDB(options?: {
  employeeId?: string;
  year?: number;
  month?: number;
}): Promise<{ records: AttendanceRecord[]; lastSync: number | null }> {
  try {
    const db = await getOfflineDb();
    const targetYm = options?.year && options?.month ? toYearMonth(options.year, options.month) : '';

    return new Promise<{ records: AttendanceRecord[]; lastSync: number | null }>((resolve, reject) => {
      const tx = db.transaction([STORE_HISTORY, STORE_METADATA], 'readonly');
      const store = tx.objectStore(STORE_HISTORY);
      const metaStore = tx.objectStore(STORE_METADATA);

      let records: StoredAttendanceRecord[] = [];
      let lastSync: number | null = null;

      tx.onerror = () => {
        console.error('Transaction error reading attendance history:', tx.error);
        reject(tx.error);
      };

      tx.oncomplete = () => {
        // Filter and sort by tanggal descending
        let filtered = records;
        if (targetYm) {
          filtered = records.filter(r => {
            if (r._yearMonth === targetYm) return true;
            if (r.tanggal && r.tanggal.startsWith(targetYm)) return true;
            return false;
          });
        }
        if (options?.employeeId) {
          filtered = filtered.filter(r => !r.employee_id || r.employee_id === options.employeeId);
        }

        // Sort descending by tanggal
        filtered.sort((a, b) => {
          const dateA = a.tanggal || '';
          const dateB = b.tanggal || '';
          return dateB.localeCompare(dateA);
        });

        resolve({ records: filtered, lastSync });
      };

      // 1. Fetch metadata for last sync
      const metaKey = options?.year && options?.month 
        ? `sync_${options.employeeId || 'all'}_${options.year}_${options.month}` 
        : `sync_${options?.employeeId || 'all'}_general`;

      const metaReq = metaStore.get(metaKey);
      metaReq.onsuccess = () => {
        if (metaReq.result?.lastSync) {
          lastSync = metaReq.result.lastSync;
        } else {
          // fallback to global
          const globalMetaReq = metaStore.get('global_last_sync');
          globalMetaReq.onsuccess = () => {
            if (globalMetaReq.result?.lastSync) {
              lastSync = globalMetaReq.result.lastSync;
            }
          };
        }
      };

      // 2. Query records
      if (targetYm && store.indexNames.contains('year_month')) {
        const index = store.index('year_month');
        const req = index.getAll(IDBKeyRange.only(targetYm));
        req.onsuccess = () => {
          if (req.result && req.result.length > 0) {
            records = req.result;
          } else {
            // Fallback to getAll in case records were saved without index
            const fallbackReq = store.getAll();
            fallbackReq.onsuccess = () => {
              records = fallbackReq.result || [];
            };
          }
        };
      } else {
        const req = store.getAll();
        req.onsuccess = () => {
          records = req.result || [];
        };
      }
    });
  } catch (err) {
    console.warn('Failed to read attendance history from IndexedDB:', err);
    return { records: [], lastSync: null };
  }
}

/**
 * Cache today's attendance record & auxiliary info (work method, schedule, etc.)
 */
export async function saveTodayAttendanceToIndexedDB(data: {
  attendance: AttendanceRecord | null;
  workMethod?: string;
  schedule?: any;
  serverTime?: any;
  replacementInfo?: any;
}): Promise<void> {
  try {
    const db = await getOfflineDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_TODAY], 'readwrite');
      const store = tx.objectStore(STORE_TODAY);

      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();

      store.put({
        key: 'today_attendance',
        data,
        updatedAt: Date.now(),
        dateStr: new Date().toISOString().split('T')[0]
      });
    });
  } catch (err) {
    console.warn('Failed to save today attendance to IndexedDB:', err);
  }
}

/**
 * Read cached today's attendance from IndexedDB
 */
export async function getTodayAttendanceFromIndexedDB(): Promise<{
  attendance: AttendanceRecord | null;
  workMethod?: string;
  schedule?: any;
  serverTime?: any;
  replacementInfo?: any;
  savedAt: number;
} | null> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_TODAY], 'readonly');
      const store = tx.objectStore(STORE_TODAY);
      const req = store.get('today_attendance');

      tx.onerror = () => reject(tx.error);
      req.onsuccess = () => {
        if (!req.result) {
          resolve(null);
          return;
        }
        resolve({
          ...req.result.data,
          savedAt: req.result.updatedAt
        });
      };
    });
  } catch (err) {
    console.warn('Failed to read today attendance from IndexedDB:', err);
    return null;
  }
}

/**
 * Helper to update last sync time
 */
async function setLastSyncTime(employeeId?: string, year?: number, month?: number): Promise<void> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_METADATA], 'readwrite');
      const metaStore = tx.objectStore(STORE_METADATA);
      const now = Date.now();
      const metaKey = year && month 
        ? `sync_${employeeId || 'all'}_${year}_${month}` 
        : `sync_${employeeId || 'all'}_general`;

      metaStore.put({
        key: metaKey,
        lastSync: now,
        updatedAt: new Date().toISOString()
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // non-fatal
  }
}

/**
 * Get offline storage stats
 */
export async function getAttendanceStorageStats(): Promise<{
  totalRecords: number;
  lastSync: number | null;
  isSupported: boolean;
}> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return { totalRecords: 0, lastSync: null, isSupported: false };
  }

  try {
    const db = await getOfflineDb();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_HISTORY, STORE_METADATA], 'readonly');
      const historyStore = tx.objectStore(STORE_HISTORY);
      const metaStore = tx.objectStore(STORE_METADATA);

      let totalRecords = 0;
      let lastSync: number | null = null;

      const countReq = historyStore.count();
      countReq.onsuccess = () => {
        totalRecords = countReq.result || 0;
      };

      const metaReq = metaStore.get('global_last_sync');
      metaReq.onsuccess = () => {
        if (metaReq.result?.lastSync) {
          lastSync = metaReq.result.lastSync;
        }
      };

      tx.oncomplete = () => {
        resolve({ totalRecords, lastSync, isSupported: true });
      };

      tx.onerror = () => {
        resolve({ totalRecords: 0, lastSync: null, isSupported: true });
      };
    });
  } catch {
    return { totalRecords: 0, lastSync: null, isSupported: false };
  }
}

/**
 * Clear cached attendance data in IndexedDB
 */
export async function clearAttendanceOfflineCache(): Promise<void> {
  try {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_HISTORY, STORE_METADATA, STORE_TODAY], 'readwrite');
      tx.objectStore(STORE_HISTORY).clear();
      tx.objectStore(STORE_METADATA).clear();
      tx.objectStore(STORE_TODAY).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to clear attendance offline cache:', err);
  }
}
