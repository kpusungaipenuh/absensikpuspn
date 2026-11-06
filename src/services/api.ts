import {
  User,
  Employee,
  AttendanceRecord,
  TodayAttendanceResponse,
  LeaveType,
  LeaveRequest,
  LeaveBalance,
  LeaveBalanceTransaction,
  WorkAssignment,
  OfficeLocation,
  WorkSchedule,
  RolloverLog,
  AuditLog,
  NotificationItem,
  Holiday,
  TravelDuty,
  TukinGrade,
  TukinCalculationItem,
  FeatureLock
} from '../types';
import {
  saveAttendanceHistoryToIndexedDB,
  getAttendanceHistoryFromIndexedDB,
  saveTodayAttendanceToIndexedDB,
  getTodayAttendanceFromIndexedDB
} from './attendanceOfflineDb';

function getInitialToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Restore user session only if active session exists or user opted into "remember me"
  const sessionToken = sessionStorage.getItem('kpu_auth_token');
  if (sessionToken) return sessionToken;

  const isRemembered = localStorage.getItem('kpu_remember_me') === 'true';
  if (isRemembered) {
    return localStorage.getItem('kpu_auth_token') || null;
  }
  return null;
}

let authToken: string | null = getInitialToken();

export function setApiToken(token: string | null, rememberMe: boolean = false) {
  authToken = token;
  if (token) {
    sessionStorage.setItem('kpu_auth_token', token);
    if (rememberMe) {
      localStorage.setItem('kpu_auth_token', token);
      localStorage.setItem('kpu_remember_me', 'true');
    } else {
      localStorage.removeItem('kpu_auth_token');
      localStorage.removeItem('kpu_remember_me');
    }
  } else {
    sessionStorage.removeItem('kpu_auth_token');
    localStorage.removeItem('kpu_auth_token');
    localStorage.removeItem('kpu_remember_me');
  }
}

export function getApiToken(): string | null {
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const method = (options.method || 'GET').toUpperCase();
  let response: Response | undefined;
  let lastError: any = null;
  const maxAttempts = method === 'GET' ? 3 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      response = await fetch(endpoint, {
        ...options,
        headers
      });
      break;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxAttempts) {
        // Wait briefly before retrying GET request
        await new Promise(res => setTimeout(res, attempt * 600));
      }
    }
  }

  if (!response) {
    throw new Error(
      lastError?.message && lastError.message !== 'Failed to fetch'
        ? lastError.message
        : 'Gagal terhubung ke server. Periksa koneksi jaringan.'
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && (data.error?.includes('Sesi tidak valid') || data.error?.includes('telah berakhir'))) {
      setApiToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:session_expired', { detail: data.error }));
      }
    }
    throw new Error(data.error || `HTTP error ${response.status}: ${response.statusText}`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),
  getBiometricChallenge: () =>
    request<{ challenge: string }>('/api/auth/biometric/challenge'),
  registerBiometricKey: (data: { credential_id: string; public_key?: string; device_name?: string }) =>
    request<{ success: boolean; message: string }>('/api/auth/biometric/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  loginWithBiometric: (data: { credential_id: string; username?: string }) =>
    request<{ token: string; user: User }>('/api/auth/biometric/login', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getBiometricStatus: () =>
    request<{ registered: boolean; count: number; credentials: any[] }>('/api/auth/biometric/status'),
  unregisterBiometric: () =>
    request<{ success: boolean; message: string }>('/api/auth/biometric/unregister', {
      method: 'POST'
    }),
  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  getServerTime: () =>
    request<{
      epochMs: number;
      todayStr: string;
      timeStr: string;
      hour: number;
      minute: number;
      second: number;
      totalMinutes: number;
      dayOfWeek: number;
      isoStr: string;
      timezone: string;
      attendanceWindow: {
        checkInStartMinutes: number;
        checkInEndMinutes: number;
        checkOutEndMinutes: number;
        isCheckInAllowed: boolean;
        isCheckInTooEarly: boolean;
        isCheckInExpired: boolean;
        isCheckOutAllowed: boolean;
      };
    }>('/api/server-time'),
  getCurrentUser: () =>
    request<{ user: User }>('/api/auth/me'),
  switchRole: (targetRole: string) =>
    request<{ success: boolean; message: string; user: User }>('/api/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ targetRole })
    }),
  updateProfile: (data: { email?: string; nomor_hp?: string; foto_profil?: string }) =>
    request<{ success: boolean; message: string; foto_profil?: string }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  changePassword: (payload: { oldPassword: string; newPassword: string }) =>
    request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  resetPassword: (employeeId: string, newPassword?: string) =>
    request<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ employeeId, newPassword })
    }),

  // Employees
  getSubBagianList: () => request<{ sub_bagian: string[] }>('/api/sub-bagian'),
  getEmployees: (params?: { search?: string; unit?: string; status?: string; sort?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.unit) q.set('unit', params.unit);
    if (params?.status) q.set('status', params.status);
    if (params?.sort) q.set('sort', params.sort);
    return request<{ employees: Employee[] }>(`/api/employees?${q.toString()}`);
  },
  getEmployee: (id: string) =>
    request<{ employee: Employee }>(`/api/employees/${id}`),
  createEmployee: (data: Partial<Employee> & { password?: string }) =>
    request<{ success: boolean; message: string; employeeId: string }>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateEmployee: (id: string, data: Partial<Employee>) =>
    request<{ success: boolean; message: string }>(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteEmployee: (id: string, permanent: boolean = true) =>
    request<{ success: boolean; message: string }>(`/api/employees/${id}?permanent=${permanent}`, {
      method: 'DELETE'
    }),
  clearTemplateEmployees: () =>
    request<{
      success: boolean;
      message: string;
      deletedCount: number;
      deletedEmployeeIds: string[];
    }>('/api/employees/clear-all-template', {
      method: 'POST'
    }),
  bulkImportEmployees: (employees: any[]) =>
    request<{
      success: boolean;
      totalProcessed: number;
      importedCount: number;
      skippedCount: number;
      imported: any[];
      errors: string[];
      message: string;
    }>('/api/employees/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ employees })
    }),
  getDatabaseStatus: () =>
    request<{
      engine: string;
      provider: string;
      projectId: string;
      databaseId: string;
      isCloudReady: boolean;
      status: string;
    }>('/api/database/status'),

  // Attendance
  checkIn: async (payload: { latitude: number; longitude: number; photo: string; deviceInfo?: string; isEmergency?: boolean; emergencyReason?: string }) => {
    const res = await request<any>('/api/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res && res.id) {
      const attRecord: AttendanceRecord = {
        id: res.id,
        employee_id: res.employee_id || '',
        tanggal: res.tanggal,
        jam_masuk: res.jam_masuk,
        jam_pulang: null,
        foto_masuk: payload.photo,
        foto_pulang: null,
        jarak_dari_kantor: res.jarak_dari_kantor,
        status_validasi_lokasi: res.status_validasi_lokasi || 'valid',
        status: res.status,
        metode_kerja: res.metode_kerja,
        keterlambatan_menit: res.keterlambatan_menit,
        jam_pulang_wajib: res.jam_pulang_wajib,
        status_ganti_jam: res.status_ganti_jam,
        approval_status: res.approval_status,
        created_at: new Date().toISOString()
      };
      saveTodayAttendanceToIndexedDB({ attendance: attRecord }).catch(() => {});
      saveAttendanceHistoryToIndexedDB([attRecord]).catch(() => {});
    }
    return res;
  },
  checkOut: async (payload: { latitude: number; longitude: number; photo: string; deviceInfo?: string; isEmergency?: boolean; emergencyReason?: string }) => {
    const res = await request<any>('/api/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res && res.id) {
      const fullRecord = res.attendance || {
        id: res.id,
        tanggal: res.tanggal,
        jam_masuk: res.jam_masuk,
        jam_pulang: res.jam_pulang,
        foto_pulang: payload.photo,
        status: res.status || 'Hadir',
        jarak_dari_kantor: res.jarak_dari_kantor,
        keterlambatan_menit: res.keterlambatan_menit,
        jam_pulang_wajib: res.jam_pulang_wajib,
        status_ganti_jam: res.status_ganti_jam
      };
      saveTodayAttendanceToIndexedDB({ attendance: fullRecord }).catch(() => {});
      saveAttendanceHistoryToIndexedDB([fullRecord]).catch(() => {});
    }
    return res;
  },
  deleteAttendance: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/attendance/${id}`, {
      method: 'DELETE'
    }),
  getPendingEmergencyAttendance: () =>
    request<{ list: AttendanceRecord[] }>('/api/attendance/admin/emergency-pending'),
  approveEmergencyAttendance: (id: string, note?: string) =>
    request<{ success: boolean; message: string }>(`/api/attendance/admin/emergency/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note })
    }),
  rejectEmergencyAttendance: (id: string, note?: string) =>
    request<{ success: boolean; message: string }>(`/api/attendance/admin/emergency/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note })
    }),
  recordManualAttendance: (payload: {
    employeeId: string;
    tanggal: string;
    jamMasuk?: string;
    jamPulang?: string;
    mode?: 'keduanya' | 'masuk_saja' | 'pulang_saja';
    status?: string;
    metodeKerja?: string;
    catatan?: string;
  }) =>
    request<{ success: boolean; message: string; id: string }>('/api/attendance/admin/manual', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  checkEmployeeAttendanceRecord: (employeeId: string, tanggal: string) =>
    request<{ record: AttendanceRecord | null }>(
      `/api/attendance/admin/check-record?employeeId=${encodeURIComponent(employeeId)}&tanggal=${encodeURIComponent(tanggal)}`
    ),
  getTodayAttendance: async (): Promise<TodayAttendanceResponse & { isOffline?: boolean }> => {
    // If browser is offline, instantly return cached today attendance from IndexedDB
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = await getTodayAttendanceFromIndexedDB();
      if (cached) {
        return {
          attendance: cached.attendance,
          workMethod: cached.workMethod || 'WFO',
          office: (cached as any).office || {
            nama: 'Kantor KPU',
            latitude: -6.1983,
            longitude: 106.8327,
            radiusMeter: 100,
            alamat: 'Jl. Imam Bonjol No. 29'
          },
          schedule: cached.schedule,
          serverTime: cached.serverTime,
          replacementInfo: cached.replacementInfo,
          isOffline: true
        } as any;
      }
    }

    try {
      const res = await request<TodayAttendanceResponse>('/api/attendance/today');
      if (res) {
        saveTodayAttendanceToIndexedDB({
          attendance: res.attendance,
          workMethod: (res as any).workMethod,
          schedule: res.schedule,
          serverTime: res.serverTime,
          replacementInfo: (res as any).replacementInfo
        }).catch(e => console.warn('Failed to save today attendance to IndexedDB:', e));
      }
      return { ...res, isOffline: false };
    } catch (err) {
      // Network error or server unreachable -> graceful fallback to IndexedDB
      const cached = await getTodayAttendanceFromIndexedDB();
      if (cached) {
        return {
          attendance: cached.attendance,
          workMethod: cached.workMethod || 'WFO',
          office: (cached as any).office || {
            nama: 'Kantor KPU',
            latitude: -6.1983,
            longitude: 106.8327,
            radiusMeter: 100,
            alamat: 'Jl. Imam Bonjol No. 29'
          },
          schedule: cached.schedule,
          serverTime: cached.serverTime,
          replacementInfo: cached.replacementInfo,
          isOffline: true
        } as any;
      }
      throw err;
    }
  },
  checkReminders: () =>
    request<{ success: boolean; notifiedCount: number }>('/api/attendance/check-reminders', {
      method: 'POST'
    }),
  getMyAttendanceHistory: async (
    year?: number,
    month?: number
  ): Promise<{ history: AttendanceRecord[]; isOffline?: boolean; lastSync?: number | null }> => {
    const q = new URLSearchParams();
    if (year) q.set('year', String(year));
    if (month) q.set('month', String(month));

    // If browser is offline, directly load from IndexedDB
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offline = await getAttendanceHistoryFromIndexedDB({ year, month });
      return { history: offline.records, isOffline: true, lastSync: offline.lastSync };
    }

    try {
      const res = await request<{ history: AttendanceRecord[] }>(`/api/attendance/history?${q.toString()}`);
      const historyList = res.history || [];

      // Persist to IndexedDB asynchronously
      saveAttendanceHistoryToIndexedDB(historyList, { year, month }).catch(err => {
        console.warn('Failed to persist attendance history to IndexedDB:', err);
      });

      return { history: historyList, isOffline: false, lastSync: Date.now() };
    } catch (err) {
      console.warn('Network error fetching attendance history, falling back to IndexedDB:', err);
      const offline = await getAttendanceHistoryFromIndexedDB({ year, month });
      if (offline.records && offline.records.length > 0) {
        return { history: offline.records, isOffline: true, lastSync: offline.lastSync };
      }
      // If none found for specific year/month filter, fallback to any available records
      const allOffline = await getAttendanceHistoryFromIndexedDB();
      if (allOffline.records && allOffline.records.length > 0) {
        return { history: allOffline.records, isOffline: true, lastSync: allOffline.lastSync };
      }
      throw err;
    }
  },
  getMonthlyAttendanceStats: (params?: { year?: number; month?: number; employeeId?: string }) => {
    const q = new URLSearchParams();
    if (params?.year) q.set('year', String(params.year));
    if (params?.month) q.set('month', String(params.month));
    if (params?.employeeId) q.set('employee_id', params.employeeId);
    return request<{
      success: boolean;
      year: number;
      month: number;
      monthName: string;
      employeeId: string;
      isOfficeWide: boolean;
      summary: {
        totalHadir: number;
        totalTepatWaktu: number;
        totalTerlambat: number;
        totalCuti: number;
        totalAlpa: number;
        persentaseKehadiran: number;
        totalJamKerja: number;
        rataRataJamKerjaPerHari: number;
        totalHadirYear: number;
        totalTepatWaktuYear: number;
        totalTerlambatYear: number;
        totalCutiYear: number;
        totalJamKerjaYear: number;
      };
      monthlyTrend: Array<{
        month: string;
        monthName: string;
        monthNum: number;
        hadir: number;
        terlambat: number;
        cuti: number;
        alpa: number;
        totalHadir: number;
        persentase: number;
        jamKerja: number;
      }>;
      dailyBreakdown: Array<{
        day: number;
        date: string;
        dayName: string;
        isWeekend: boolean;
        jamMasuk: string | null;
        jamPulang: string | null;
        durasiJam: number;
        keterlambatanMenit: number;
        status: string;
        metodeKerja: string;
      }>;
    }>(`/api/attendance/monthly-stats?${q.toString()}`);
  },
  getAdminTodayAttendance: (params?: { date?: string; unit?: string; status?: string; method?: string }) => {
    const q = new URLSearchParams();
    if (params?.date) q.set('date', params.date);
    if (params?.unit) q.set('unit', params.unit);
    if (params?.status) q.set('status', params.status);
    if (params?.method) q.set('method', params.method);
    return request<{ list: AttendanceRecord[] }>(`/api/attendance/admin/today?${q.toString()}`);
  },
  getMonitoringAttendance: (date?: string) => {
    const q = date ? `?date=${date}` : '';
    return request<{
      date: string;
      totalPegawai: number;
      totalSudahAbsen: number;
      totalBelumAbsen: number;
      sudahAbsen: any[];
      belumAbsen: any[];
    }>(`/api/attendance/admin/monitoring${q}`);
  },
  getRekapAttendance: (params?: {
    startDate?: string;
    endDate?: string;
    unit?: string;
    employeeId?: string;
    status?: string;
    method?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.unit) q.set('unit', params.unit);
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.status) q.set('status', params.status);
    if (params?.method) q.set('method', params.method);
    return request<{
      list: AttendanceRecord[];
      summary: {
        totalHadir: number;
        totalTerlambat: number;
        totalWFH: number;
        totalWFA: number;
        totalWFO: number;
        totalRecords: number;
      };
      period: { startDate: string; endDate: string };
    }>(`/api/attendance/admin/rekap?${q.toString()}`);
  },
  getRekapAttendanceMatrix: (params?: { month?: string; unit?: string; sort?: string }) => {
    const q = new URLSearchParams();
    if (params?.month) q.set('month', params.month);
    if (params?.unit) q.set('unit', params.unit);
    if (params?.sort) q.set('sort', params.sort);
    return request<{
      month: string;
      year: number;
      monthNum: number;
      monthName: string;
      daysInMonth: number;
      daysMeta: {
        day: number;
        dateStr: string;
        dayOfWeek: number;
        isWeekend: boolean;
        isHoliday: boolean;
        holidayName: string | null;
        isNonWorkingDay: boolean;
      }[];
      rows: {
        id: string;
        nip_nik: string;
        nama_lengkap: string;
        jabatan: string;
        unit_kerja: string;
        days: {
          day: number;
          dateStr: string;
          isNonWorkingDay: boolean;
          isHoliday: boolean;
          isWeekend: boolean;
          holidayName: string | null;
          code: string;
          keterangan: string;
          jam_masuk: string | null;
          jam_pulang: string | null;
          status_ganti_jam: string | null;
          keterlambatan_menit: number;
        }[];
        summary: {
          H: number;
          TL: number;
          totalHadir: number;
          C: number;
          S: number;
          I: number;
          A: number;
          workdaysPassed: number;
          persentase: string;
        };
      }[];
      instansi: string;
    }>(`/api/attendance/admin/rekap-matrix?${q.toString()}`);
  },

  // Work Assignments (WFH/WFA/WFO)
  getWorkAssignments: (date?: string, employeeId?: string) => {
    const q = new URLSearchParams();
    if (date) q.set('date', date);
    if (employeeId) q.set('employeeId', employeeId);
    return request<{ assignments: WorkAssignment[] }>(`/api/work-assignments?${q.toString()}`);
  },
  saveWorkAssignment: (data: { employee_id: string; tanggal: string; metode_kerja: string; keterangan?: string; surat_tugas?: string }) =>
    request<{ success: boolean; message: string }>('/api/work-assignments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  saveBulkWorkAssignments: (data: { employee_ids: string[]; dates: string[]; metode_kerja: string; keterangan?: string; surat_tugas?: string }) =>
    request<{ success: boolean; message: string }>('/api/work-assignments/bulk', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  importWorkAssignmentsExcel: (assignments: any[]) =>
    request<{ success: boolean; importedCount: number; errors: string[]; message: string }>('/api/work-assignments/import-excel', {
      method: 'POST',
      body: JSON.stringify({ assignments })
    }),
  deleteWorkAssignment: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/work-assignments/${id}`, {
      method: 'DELETE'
    }),

  // Perjalanan Dinas (Official Travel Duties)
  getTravelDuties: (params?: { jenis?: string; tahun?: string; employeeId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.jenis) q.set('jenis', params.jenis);
    if (params?.tahun) q.set('tahun', params.tahun);
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.status) q.set('status', params.status);
    return request<{ duties: TravelDuty[] }>(`/api/travel-duties?${q.toString()}`);
  },
  createTravelDuty: (data: any) =>
    request<{ id: string; success: boolean }>('/api/travel-duties', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateTravelDuty: (id: string, data: any) =>
    request<{ success: boolean }>(`/api/travel-duties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteTravelDuty: (id: string) =>
    request<{ success: boolean }>(`/api/travel-duties/${id}`, {
      method: 'DELETE'
    }),

  // Tunjangan Kinerja (Tukin)
  getTukinGrades: () =>
    request<{ grades: TukinGrade[] }>('/api/tukin/grades'),
  updateTukinGrade: (id: string, data: { besaran_dasar: number; kelas_jabatan?: number; keterangan?: string }) =>
    request<{ success: boolean }>(`/api/tukin/grades/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  getTukinCalculations: (month?: number, year?: number) => {
    const q = new URLSearchParams();
    if (month) q.set('month', String(month));
    if (year) q.set('year', String(year));
    return request<{
      month: number;
      year: number;
      summary: {
        totalPegawai: number;
        totalBruto: number;
        totalPotongan: number;
        totalNetto: number;
      };
      calculations: TukinCalculationItem[];
    }>(`/api/tukin/calculations?${q.toString()}`);
  },
  recalculateTukin: (month: number, year: number) =>
    request<{
      success: boolean;
      message: string;
      summary: {
        totalPegawai: number;
        totalBruto: number;
        totalPotongan: number;
        totalNetto: number;
      };
      calculations: TukinCalculationItem[];
    }>('/api/tukin/recalculate', {
      method: 'POST',
      body: JSON.stringify({ month, year })
    }),

  // Leaves
  getLeaveTypes: () =>
    request<{ types: LeaveType[] }>('/api/leave-types'),
  calculateLeaveDays: (startDate: string, endDate: string) =>
    request<{ days: number }>('/api/leaves/calculate-days', {
      method: 'POST',
      body: JSON.stringify({ startDate, endDate })
    }),
  submitLeaveRequest: (data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
    attachmentUrl?: string;
    employeeId?: string;
    alamat_cuti?: string;
    telepon_cuti?: string;
    nama_atasan?: string;
    nip_atasan?: string;
    jabatan_atasan?: string;
    pangkat_golongan?: string;
    masa_kerja?: string;
  }) =>
    request<any>('/api/leaves/request', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getMyLeaveRequests: () =>
    request<{ requests: LeaveRequest[] }>('/api/leaves/my-requests'),
  getAdminPendingLeaves: () =>
    request<{ requests: LeaveRequest[] }>('/api/leaves/admin/pending'),
  getAdminAllLeaves: (params?: {
    startDate?: string;
    endDate?: string;
    leaveTypeId?: string;
    status?: string;
    employeeId?: string;
    search?: string;
    unit?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.leaveTypeId) q.set('leaveTypeId', params.leaveTypeId);
    if (params?.status) q.set('status', params.status);
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.search) q.set('search', params.search);
    if (params?.unit) q.set('unit', params.unit);
    return request<{ requests: LeaveRequest[] }>(`/api/leaves/admin/all?${q.toString()}`);
  },
  approveLeave: (id: string, adminNotes?: string) =>
    request<{ success: boolean; status: string; balanceAfter?: number }>(`/api/leaves/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ adminNotes })
    }),
  rejectLeave: (id: string, rejectionReason: string) =>
    request<{ success: boolean; status: string }>(`/api/leaves/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason })
    }),
  cancelLeave: (id: string) =>
    request<{ success: boolean; status: string }>(`/api/leaves/${id}/cancel`, {
      method: 'POST'
    }),
  deleteLeave: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/leaves/${id}`, {
      method: 'DELETE'
    }),
  updateLeave: (id: string, data: {
    leaveTypeId?: string;
    startDate?: string;
    endDate?: string;
    days?: number;
    reason?: string;
    status?: string;
    nomorPengajuan?: string;
    catatanAdmin?: string;
  }) =>
    request<{ success: boolean; message: string }>(`/api/leaves/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  clearAllLeaves: () =>
    request<{ success: boolean; message: string }>('/api/leaves/admin/clear-all', {
      method: 'DELETE'
    }),
  recordManualLeave: (data: {
    employeeId: string;
    leaveTypeId: string;
    nomorPengajuan?: string;
    startDate: string;
    endDate: string;
    days?: number;
    reason: string;
    status?: string;
    tanggalPengajuan?: string;
    tanggalApproval?: string;
    potongSaldo?: boolean;
    catatanAdmin?: string;
  }) =>
    request<{ success: boolean; message: string; data: any }>('/api/leaves/manual-record', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  importHistoricalLeaves: (items: any[]) =>
    request<{ success: boolean; message: string; count: number; errors: string[] }>('/api/leaves/import-history', {
      method: 'POST',
      body: JSON.stringify({ items })
    }),
  getLeaveCalendar: (year?: number) =>
    request<{ events: any[] }>(`/api/leaves/calendar?year=${year || new Date().getFullYear()}`),
  getRekapPenggunaanCuti: (params?: { year?: number; unit?: string; employeeId?: string }) => {
    const q = new URLSearchParams();
    if (params?.year) q.set('year', String(params.year));
    if (params?.unit) q.set('unit', params.unit);
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    return request<{
      rows: any[];
      summaryByType: Record<string, number>;
      monthlyUsage: { month: string; total: number }[];
      year: number;
    }>(`/api/leaves/admin/rekap-penggunaan?${q.toString()}`);
  },

  // Leave Balances
  getMyLeaveBalance: (year?: number, employeeId?: string) => {
    const q = new URLSearchParams();
    q.set('year', String(year || new Date().getFullYear()));
    if (employeeId) q.set('employeeId', employeeId);
    return request<{ balance: LeaveBalance; transactions: LeaveBalanceTransaction[] }>(
      `/api/leave-balances/my-balance?${q.toString()}`
    );
  },
  getAdminBalancesSummary: (year?: number, unit?: string, search?: string) => {
    const q = new URLSearchParams();
    if (year) q.set('year', String(year));
    if (unit) q.set('unit', unit);
    if (search) q.set('search', search);
    return request<{ rows: any[]; year: number }>(`/api/leave-balances/admin/summary?${q.toString()}`);
  },
  adjustLeaveBalance: (payload: {
    employeeId: string;
    year: number;
    n_2: number;
    n_1: number;
    n: number;
    reason: string;
  }) =>
    request<any>('/api/leave-balances/admin/adjust', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getEmployeeBalanceHistory: (employeeId: string) =>
    request<{ transactions: LeaveBalanceTransaction[] }>(`/api/leave-balances/history/${employeeId}`),

  // Rollover
  getRolloverLogs: () =>
    request<{ logs: RolloverLog[] }>('/api/rollover/logs'),
  runManualRollover: (targetYear: number) =>
    request<any>('/api/rollover/run-manual', {
      method: 'POST',
      body: JSON.stringify({ targetYear })
    }),

  // Dashboards
  getAdminDashboardStats: (date?: string) =>
    request<any>(`/api/dashboard/admin${date ? `?date=${date}` : ''}`),
  getPegawaiDashboardStats: () =>
    request<any>('/api/dashboard/pegawai'),

  // Settings & Masters
  getSettings: () =>
    request<{ settings: Record<string, string>; office: OfficeLocation; schedule: WorkSchedule }>(
      '/api/settings'
    ),
  saveSettings: (payload: {
    settings?: Record<string, string>;
    office?: Partial<OfficeLocation>;
    schedule?: Partial<WorkSchedule>;
  }) =>
    request<{ success: boolean; message: string }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  getHolidays: () =>
    request<{ holidays: Holiday[] }>('/api/holidays'),
  addHoliday: (data: { tanggal: string; nama: string; is_cuti_bersama?: boolean }) =>
    request<{ success: boolean; message: string }>('/api/holidays', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  deleteHoliday: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/holidays/${id}`, {
      method: 'DELETE'
    }),

  // Notifications & FCM Push
  getNotifications: () =>
    request<{ notifications: NotificationItem[] }>('/api/notifications'),
  markNotificationRead: (id: string) =>
    request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    request<{ success: boolean; message: string }>('/api/notifications/mark-all-read', { method: 'POST' }),
  registerFcmToken: (data: { token: string; device_name?: string; platform?: string }) =>
    request<{ success: boolean; message: string }>('/api/fcm/register-token', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  unregisterFcmToken: (token: string) =>
    request<{ success: boolean; message: string }>('/api/fcm/unregister-token', {
      method: 'POST',
      body: JSON.stringify({ token })
    }),
  getFcmStatus: () =>
    request<{ success: boolean; activeTokensCount: number; tokens: any[] }>('/api/fcm/status'),
  testFcmPush: () =>
    request<{ success: boolean; message: string }>('/api/fcm/test', { method: 'POST' }),
  broadcastAttendanceReminder: (type: 'masuk' | 'pulang') =>
    request<{ success: boolean; message: string; notifiedCount: number }>('/api/fcm/broadcast-reminder', {
      method: 'POST',
      body: JSON.stringify({ type })
    }),

  // Advanced Reporting Analytics
  getAdvancedReports: (params?: { period?: string; year?: number }) => {
    const q = new URLSearchParams();
    if (params?.period) q.set('period', params.period);
    if (params?.year) q.set('year', String(params.year));
    return request<{
      period: string;
      startDate: string;
      endDate: string;
      monthlyAttendanceTrend: {
        key: string;
        month: string;
        hadir: number;
        terlambat: number;
        total: number;
        persentaseTepat: number;
      }[];
      leaveDistribution: {
        id: string;
        kode: string;
        name: string;
        value: number;
        requestsCount: number;
        fill: string;
      }[];
      workMethodTrends: {
        date: string;
        fullDate: string;
        wfo: number;
        wfh: number;
        wfa: number;
        total: number;
      }[];
      kpi: {
        totalAbsen: number;
        totalHadir: number;
        totalTerlambat: number;
        persentaseTepatWaktu: number;
        totalWFO: number;
        totalWFH: number;
        totalWFA: number;
        persentaseWFO: number;
        totalCutiDays: number;
        totalCutiRequests: number;
      };
    }>(`/api/admin/reports/advanced?${q.toString()}`);
  },

  // Audit Logs
  getAuditLogs: (param?: string | { module?: string; action?: string; limit?: number }) => {
    const mod = typeof param === 'string' ? param : param?.module;
    return request<{ logs: AuditLog[] }>(`/api/audit-logs${mod ? `?module=${mod}` : ''}`);
  },

  // Feature Locks & Flags
  getFeatures: () => {
    return request<{ features: FeatureLock[] }>('/api/features');
  },
  updateFeature: (id: string, data: Partial<FeatureLock>) => {
    return request<{ success: boolean; message: string }>(`/api/features/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  batchToggleFeatures: (data: { lock_all: boolean; target_category?: string }) => {
    return request<{ success: boolean; message: string }>('/api/features/batch-toggle', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};
