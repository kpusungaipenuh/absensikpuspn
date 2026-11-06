import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { Database } from 'sql.js';
import { executeSql, saveDb } from '../db';

export async function syncFirestoreEmployeePhotos(db: Database): Promise<number> {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return 0;
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config.apiKey || !config.projectId) return 0;

    const app = !getApps().length ? initializeApp(config) : getApp();
    const firestore = getFirestore(app, config.firestoreDatabaseId || '(default)');
    const snap = await getDocs(collection(firestore, 'employees'));

    let updatedCount = 0;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.foto_profil && data.foto_profil.length > 50) {
        const empId = data.id || docSnap.id;
        const nip = data.nip_nik;

        if (empId) {
          executeSql(db, 'UPDATE employees SET foto_profil = ? WHERE id = ?', [data.foto_profil, empId]);
          executeSql(db, 'UPDATE users SET foto_profil = ? WHERE employee_id = ?', [data.foto_profil, empId]);
          executeSql(db, 'UPDATE user_sessions SET foto_profil = ? WHERE employee_id = ?', [data.foto_profil, empId]);
        }
        if (nip) {
          executeSql(db, 'UPDATE employees SET foto_profil = ? WHERE nip_nik = ?', [data.foto_profil, nip]);
          executeSql(db, 'UPDATE users SET foto_profil = ? WHERE username = ?', [data.foto_profil, nip]);
          executeSql(db, 'UPDATE user_sessions SET foto_profil = ? WHERE username = ?', [data.foto_profil, nip]);
        }
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      saveDb(db);
      console.log(`[Firestore Sync] Successfully synchronized ${updatedCount} employee photos to SQLite database.`);
    }
    return updatedCount;
  } catch (err) {
    console.warn('[Firestore Sync] Photo sync notice:', err);
    return 0;
  }
}
