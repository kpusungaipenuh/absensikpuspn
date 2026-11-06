export type Role = 'admin' | 'operator_sdm' | 'operator_keuangan' | 'operator_umum' | 'pegawai';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  employeeId: string | null;
  namaLengkap: string;
  nama_lengkap?: string;
  nip_nik?: string;
  nipNik?: string;
  jabatan?: string;
  unitKerja?: string;
  unit_kerja?: string;
  fotoProfil?: string;
  foto_profil?: string;
  operator_role?: 'operator_sdm' | 'operator_keuangan' | 'operator_umum' | 'all_operator' | string | null;
  assigned_operator_role?: string | null;
  operator_roles?: string[];
  can_switch_role?: boolean;
}

export interface Employee {
  id: string;
  nip_nik: string;
  nama_lengkap: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  pangkat_golongan?: string;
  sub_bagian?: string;
  username: string;
  email: string;
  nomor_hp: string;
  jabatan: string;
  unit_kerja: string;
  status_pegawai: 'aktif' | 'nonaktif';
  tanggal_masuk: string;
  role: Role;
  operator_role?: 'operator_sdm' | 'operator_keuangan' | 'operator_umum' | 'all_operator' | string | null;
  jatah_cuti_tahunan: number;
  foto_profil: string;
  is_deleted?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  tanggal: string;
  jam_masuk?: string | null;
  jam_pulang?: string | null;
  foto_masuk?: string | null;
  foto_pulang?: string | null;
  latitude_masuk?: number | null;
  longitude_masuk?: number | null;
  latitude_pulang?: number | null;
  longitude_pulang?: number | null;
  jarak_dari_kantor?: number | null;
  status_validasi_lokasi: string;
  status: 'Hadir' | 'Terlambat' | 'Tidak Hadir' | 'Cuti' | 'WFH' | 'WFA' | 'Dinas' | 'Izin' | 'Menunggu Persetujuan' | 'Ditolak' | string;
  metode_kerja: 'WFO' | 'WFH' | 'WFA';
  keterlambatan_menit?: number;
  jam_pulang_wajib?: string | null;
  status_ganti_jam?: 'tidak_perlu' | 'menunggu' | 'terpenuhi' | 'kurang';
  is_emergency_checkin?: number;
  emergency_reason?: string | null;
  approval_status?: 'approved' | 'pending' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  approval_note?: string | null;
  device_info?: string;
  nama_lengkap?: string;
  nip_nik?: string;
  unit_kerja?: string;
  jabatan?: string;
  foto_profil?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceReplacementInfo {
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  lateMinutes: number;
  jamPulangWajib: string;
  requiredOutMinutes: number;
  isFulfilled: boolean;
  remainingMinutes: number;
  statusGantiJam: 'tidak_perlu' | 'menunggu' | 'terpenuhi' | 'kurang';
}

export interface TodayAttendanceResponse {
  attendance: AttendanceRecord | null;
  workMethod: string;
  office: OfficeLocation;
  schedule?: WorkSchedule;
  serverTime?: {
    todayStr: string;
    timeStr: string;
    totalMinutes: number;
    sudahMasukJam: boolean;
    timezone: string;
  };
  replacementInfo?: AttendanceReplacementInfo;
}

export interface LeaveType {
  id: string;
  kode: string;
  nama: string;
  uses_balance: number;
  requires_attachment: number;
  keterangan: string;
}

export interface LeaveRequest {
  id: string;
  nomor_pengajuan: string;
  employee_id: string;
  leave_type_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_hari: number;
  alasan: string;
  lampiran_url?: string | null;
  status: 'Menunggu Approval' | 'Disetujui' | 'Ditolak' | 'Dibatalkan';
  tanggal_pengajuan: string;
  approver_id?: string | null;
  tanggal_approval?: string | null;
  catatan_admin?: string | null;
  created_at: string;
  updated_at: string;
  nama_lengkap?: string;
  nip_nik?: string;
  jabatan?: string;
  unit_kerja?: string;
  foto_profil?: string;
  leave_type_name?: string;
  leave_type_code?: string;
  uses_balance?: number;
  requires_attachment?: number;
  approver_username?: string;
  alamat_cuti?: string;
  telepon_cuti?: string;
  nama_atasan?: string;
  nip_atasan?: string;
  jabatan_atasan?: string;
  pangkat_golongan?: string;
  masa_kerja?: string;
  emp_pangkat_golongan?: string;
  emp_nomor_hp?: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  tahun: number;
  n_2: number;
  n_1: number;
  n: number;
  total: number;
  updated_at: string;
}

export interface LeaveBalanceTransaction {
  id: string;
  employee_id: string;
  leave_request_id?: string | null;
  type: string;
  n_2_sebelum: number;
  n_2_sesudah: number;
  n_1_sebelum: number;
  n_1_sesudah: number;
  n_sebelum: number;
  n_sesudah: number;
  total_sebelum: number;
  total_sesudah: number;
  alasan: string;
  admin_id?: string | null;
  admin_username?: string;
  timestamp: string;
}

export interface WorkAssignment {
  id: string;
  employee_id: string;
  tanggal: string;
  metode_kerja: 'WFO' | 'WFH' | 'WFA';
  keterangan?: string;
  nama_lengkap?: string;
  nip_nik?: string;
  unit_kerja?: string;
}

export interface OfficeLocation {
  id: string;
  nama: string;
  latitude: number;
  longitude: number;
  radius_meter: number;
  alamat: string;
}

export interface WorkSchedule {
  id: string;
  jam_masuk: string;
  jam_pulang: string;
  toleransi_keterlambatan_menit: number;
  hari_kerja: string;
}

export interface RolloverLog {
  id: string;
  tahun_proses: number;
  tanggal_proses: string;
  status: 'SUCCESS' | 'FAILED';
  jumlah_pegawai_diproses: number;
  triggered_by: 'SYSTEM' | 'ADMIN';
  admin_id?: string | null;
  detail_perubahan: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  username: string;
  user_nama?: string;
  employee_nama?: string;
  employee_nip?: string;
  user_role?: string;
  action: string;
  module: string;
  old_value?: string | null;
  new_value?: string | null;
  keterangan?: string;
  ip_address?: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: number;
  action_url?: string;
  created_at: string;
}

export interface Holiday {
  id: string;
  tanggal: string;
  nama: string;
  is_cuti_bersama: number;
}

// ---------------------------------------------------------------------------
// Perjalanan Dinas (SPPD / Surat Tugas)
// ---------------------------------------------------------------------------
export interface TravelDutyEmployee {
  id: string;
  travel_duty_id?: string;
  employee_id?: string;
  peran?: string; // 'Ketua Tim' | 'Anggota' | 'Pendamping' | 'Pengemudi' | string
  nama_lengkap: string;
  nip_nik?: string;
  jabatan?: string;
  pangkat_golongan?: string;
  unit_kerja?: string;
}

export interface TravelDuty {
  id: string;
  nomor_surat_tugas: string;
  nomor_sppd?: string;
  jenis_perjalanan: 'dalam_kota' | 'luar_kota';
  tanggal_berangkat: string;
  tanggal_kembali: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  durasi_hari?: number;
  lama_hari?: number;
  tempat_berangkat: string;
  tempat_tujuan: string;
  kota_tujuan?: string;
  maksud_tujuan: string;
  alat_angkut?: string;
  beban_anggaran?: string;
  total_biaya?: number;
  status: 'terjadwal' | 'berjalan' | 'selesai' | 'dibatalkan';
  keterangan?: string;
  lampiran_dokumen?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  pegawai?: TravelDutyEmployee[];
  assigned_employees?: TravelDutyEmployee[];
}

// ---------------------------------------------------------------------------
// Tunjangan Kinerja (Tukin) & Potongan Kehadiran
// ---------------------------------------------------------------------------
export interface TukinGrade {
  id: string;
  kelas_jabatan: number;
  kategori: string;
  besaran_dasar: number;
  keterangan?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TukinCalculationItem {
  id?: string;
  employee_id: string;
  nip_nik: string;
  nama_lengkap: string;
  jabatan: string;
  kelas_jabatan: number;
  unit_kerja: string;
  pangkat_golongan?: string;
  tukin_dasar: number;
  tukin_bruto?: number;
  hari_kerja_efektif: number;
  hari_kerja?: number;
  hari_hadir: number;
  hari_dinas: number;
  hari_cuti: number;
  hari_tk: number;
  total_tl_menit: number;
  potongan_tl_persen: number;
  total_psw_menit: number;
  potongan_psw_persen: number;
  potongan_tk_persen: number;
  total_potongan_persen: number;
  total_potongan_rupiah: number;
  tukin_bersih: number;
  tukin_netto?: number;
  status_pembayaran?: 'draft' | 'final' | 'dibayarkan';
  catatan?: string;
}

export interface TukinMonthlySummary {
  month: number;
  year: number;
  monthName: string;
  totalPegawai: number;
  totalBruto: number;
  totalPotongan: number;
  totalNetto: number;
  items: TukinCalculationItem[];
}

// ---------------------------------------------------------------------------
// Manajemen Kunci Fitur & Kesiapan Rilis (Feature Flags)
// ---------------------------------------------------------------------------
export interface FeatureLock {
  id: string;
  name: string;
  category: string;
  description: string;
  is_locked: boolean;
  locked_for: 'all_non_admin' | 'pegawai_only' | 'everyone';
  release_estimate?: string;
  maintenance_message?: string;
  updated_at?: string;
  updated_by?: string;
}

