import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDocFromServer,
  collection,
  writeBatch,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with long-polling enabled to ensure reliable connectivity behind proxies/iframes
function createFirestoreInstance(): Firestore {
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, dbId);
  } catch (_err) {
    return getFirestore(app, dbId);
  }
}

export const db = createFirestoreInstance();

// Validate connection to Firestore as required by system guidelines
export async function testConnection(): Promise<boolean> {
  try {
    const testRef = doc(db, 'test', 'connection');
    await getDocFromServer(testRef);
    console.log('[Firestore] Connected to database successfully');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Client is offline or unreachable. Operating in offline mode.');
      return false;
    }
    // Document not found or existing is fine (it means connected to server successfully)
    return true;
  }
}

// Helper to batch sync employees to Firestore
export async function syncEmployeesToFirestore(employees: any[]): Promise<number> {
  if (!employees || employees.length === 0) return 0;
  try {
    const batch = writeBatch(db);
    let count = 0;
    for (const emp of employees) {
      if (count >= 400) break; // Firestore batch limit is 500
      const ref = doc(db, 'employees', emp.id || `emp_${emp.nip_nik}`);
      batch.set(
        ref,
        {
          id: emp.id || `emp_${emp.nip_nik}`,
          nip_nik: emp.nip_nik,
          nip_nipppk: emp.nip_nik,
          nama_lengkap: emp.nama_lengkap,
          tempat_lahir: emp.tempat_lahir || '',
          tanggal_lahir: emp.tanggal_lahir || '',
          pangkat_golongan: emp.pangkat_golongan || '',
          sub_bagian: emp.sub_bagian || emp.unit_kerja || '',
          jabatan: emp.jabatan,
          unit_kerja: emp.unit_kerja || emp.sub_bagian || '',
          email: emp.email || '',
          nomor_hp: emp.nomor_hp || '',
          status_pegawai: emp.status_pegawai || 'aktif',
          role: emp.role || 'pegawai',
          foto_profil: emp.foto_profil || '',
          updated_at: new Date().toISOString()
        },
        { merge: true }
      );
      count++;
    }
    await batch.commit();
    return count;
  } catch (err) {
    console.warn('[Firestore] Batch sync warning:', err);
    return 0;
  }
}

// Single employee update in Firestore
export async function updateEmployeeInFirestore(emp: any): Promise<boolean> {
  if (!emp || (!emp.id && !emp.nip_nik)) return false;
  try {
    const docId = emp.id || `emp_${emp.nip_nik}`;
    const ref = doc(db, 'employees', docId);
    await setDoc(
      ref,
      {
        id: docId,
        nip_nik: emp.nip_nik,
        nama_lengkap: emp.nama_lengkap,
        tempat_lahir: emp.tempat_lahir || '',
        tanggal_lahir: emp.tanggal_lahir || '',
        pangkat_golongan: emp.pangkat_golongan || '',
        sub_bagian: emp.sub_bagian || emp.unit_kerja || '',
        jabatan: emp.jabatan || '',
        unit_kerja: emp.unit_kerja || emp.sub_bagian || '',
        email: emp.email || '',
        nomor_hp: emp.nomor_hp || '',
        status_pegawai: emp.status_pegawai || 'aktif',
        role: emp.role || 'pegawai',
        foto_profil: emp.foto_profil || '',
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('[Firestore] Update employee warning:', err);
    return false;
  }
}

// Delete single employee from Firestore
export async function deleteEmployeeFromFirestore(employeeId: string, nipNik?: string): Promise<boolean> {
  try {
    const idToDelete = employeeId || (nipNik ? `emp_${nipNik}` : '');
    if (!idToDelete) return false;
    const ref = doc(db, 'employees', idToDelete);
    await deleteDoc(ref);
    if (nipNik && idToDelete !== `emp_${nipNik}`) {
      try {
        await deleteDoc(doc(db, 'employees', `emp_${nipNik}`));
      } catch (_) {}
    }
    return true;
  } catch (e) {
    console.warn('[Firestore] Delete employee warning:', e);
    return false;
  }
}

// Clear list of employees from Firestore
export async function clearEmployeesFromFirestore(employeeIds: string[]): Promise<number> {
  if (!employeeIds || employeeIds.length === 0) return 0;
  try {
    const batch = writeBatch(db);
    let count = 0;
    for (const id of employeeIds) {
      if (count >= 400) break;
      const ref = doc(db, 'employees', id);
      batch.delete(ref);
      count++;
    }
    await batch.commit();
    return count;
  } catch (e) {
    console.warn('[Firestore] Clear employees warning:', e);
    return 0;
  }
}

// Office location sync
export async function saveOfficeLocationToFirestore(office: any): Promise<boolean> {
  if (!office) return false;
  try {
    const ref = doc(db, 'settings', 'office_location');
    await setDoc(
      ref,
      {
        id: office.id || 'loc_kpu_spn',
        nama: office.nama || 'Kantor KPU Kota Sungai Penuh',
        latitude: Number(office.latitude),
        longitude: Number(office.longitude),
        radius_meter: Number(office.radius_meter) || 150,
        alamat: office.alamat || '',
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('[Firestore] Save office warning:', err);
    return false;
  }
}

// Work schedule sync
export async function saveWorkScheduleToFirestore(schedule: any): Promise<boolean> {
  if (!schedule) return false;
  try {
    const ref = doc(db, 'settings', 'work_schedule');
    await setDoc(
      ref,
      {
        id: schedule.id || 'sched_default',
        jam_masuk: schedule.jam_masuk,
        jam_pulang: schedule.jam_pulang,
        toleransi_keterlambatan_menit: Number(schedule.toleransi_keterlambatan_menit) || 15,
        hari_kerja: schedule.hari_kerja || '1,2,3,4,5',
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('[Firestore] Save schedule warning:', err);
    return false;
  }
}

// System key-value settings sync
export async function saveSystemSettingsToFirestore(settings: Record<string, any>): Promise<boolean> {
  if (!settings) return false;
  try {
    const ref = doc(db, 'settings', 'system_parameters');
    await setDoc(
      ref,
      {
        ...settings,
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('[Firestore] Save system settings warning:', err);
    return false;
  }
}

// Holiday sync
export async function saveHolidayToFirestore(holiday: any): Promise<boolean> {
  if (!holiday) return false;
  try {
    const docId = holiday.id || `hol_${holiday.tanggal?.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const ref = doc(db, 'settings', docId);
    await setDoc(
      ref,
      {
        id: docId,
        tanggal: holiday.tanggal,
        nama: holiday.nama,
        is_cuti_bersama: Boolean(holiday.is_cuti_bersama),
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('[Firestore] Save holiday warning:', err);
    return false;
  }
}

// Holiday delete
export async function deleteHolidayFromFirestore(holidayId: string): Promise<boolean> {
  if (!holidayId) return false;
  try {
    await deleteDoc(doc(db, 'settings', holidayId));
    return true;
  } catch (err) {
    console.warn('[Firestore] Delete holiday warning:', err);
    return false;
  }
}

// Feature locks sync
export async function saveFeatureLockToFirestore(featureId: string, featureData: any): Promise<boolean> {
  if (!featureId) return false;
  try {
    const ref = doc(db, 'settings', `feature_${featureId}`);
    await setDoc(
      ref,
      {
        id: featureId,
        ...featureData,
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('[Firestore] Save feature lock warning:', err);
    return false;
  }
}

// Work Assignment (WFH/WFA) sync
export async function saveWorkAssignmentToFirestore(assignment: any): Promise<boolean> {
  if (!assignment) return false;
  try {
    const docId = assignment.id || `wa_${Date.now()}`;
    const ref = doc(db, 'settings', `wa_${docId}`);
    await setDoc(
      ref,
      {
        id: docId,
        ...assignment,
        updated_at: new Date().toISOString()
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('[Firestore] Save work assignment warning:', err);
    return false;
  }
}

// Initial test on load (non-blocking)
testConnection().catch(() => {});
