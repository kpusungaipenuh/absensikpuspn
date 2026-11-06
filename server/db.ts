import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

let dbInstance: Database | null = null;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'kpu_database.sqlite');

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
      dbInstance.run('PRAGMA foreign_keys = ON;');
      console.log('Loaded existing SQLite database from:', DB_FILE);
      try {
        ensureColumnsExist(dbInstance);
      } catch (colErr) {
        console.warn('ensureColumnsExist warning:', colErr);
      }
      return dbInstance;
    } catch (err) {
      console.error('Error loading existing database, checking backup:', err);
      const bakFile = `${DB_FILE}.bak`;
      if (fs.existsSync(bakFile)) {
        try {
          const bakBuffer = fs.readFileSync(bakFile);
          dbInstance = new SQL.Database(bakBuffer);
          dbInstance.run('PRAGMA foreign_keys = ON;');
          console.log('Loaded SQLite database from backup:', bakFile);
          ensureColumnsExist(dbInstance);
          return dbInstance;
        } catch (bakErr) {
          console.error('Error loading backup database:', bakErr);
        }
      }
    }
  }

  // Initialize new database
  dbInstance = new SQL.Database();
  dbInstance.run('PRAGMA foreign_keys = ON;');
  console.log('Initializing fresh SQLite database...');
  await initSchemaAndSeed(dbInstance);
  ensureColumnsExist(dbInstance);
  saveDb(dbInstance);

  return dbInstance;
}

function ensureColumnsExist(db: Database) {
  try {
    const employeeCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(employees);').map(c => c.name);
    if (!employeeCols.includes('tempat_lahir')) {
      db.run('ALTER TABLE employees ADD COLUMN tempat_lahir TEXT;');
    }
    if (!employeeCols.includes('tanggal_lahir')) {
      db.run('ALTER TABLE employees ADD COLUMN tanggal_lahir TEXT;');
    }
    if (!employeeCols.includes('pangkat_golongan')) {
      db.run('ALTER TABLE employees ADD COLUMN pangkat_golongan TEXT;');
    }
    if (!employeeCols.includes('sub_bagian')) {
      db.run('ALTER TABLE employees ADD COLUMN sub_bagian TEXT;');
    }
    if (!employeeCols.includes('operator_role')) {
      db.run('ALTER TABLE employees ADD COLUMN operator_role TEXT;');
    }
    // Pastikan role pegawai tidak ada yang bernilai 'admin' (Admin khusus non-pegawai)
    db.run("UPDATE employees SET role = 'pegawai' WHERE role = 'admin';");

    const sessionCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(user_sessions);').map(c => c.name);
    if (sessionCols.length > 0 && !sessionCols.includes('operator_role')) {
      db.run('ALTER TABLE user_sessions ADD COLUMN operator_role TEXT;');
    }

    const attendanceCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(attendance);').map(c => c.name);
    if (!attendanceCols.includes('keterlambatan_menit')) {
      db.run('ALTER TABLE attendance ADD COLUMN keterlambatan_menit INTEGER DEFAULT 0;');
    }
    if (!attendanceCols.includes('jam_pulang_wajib')) {
      db.run('ALTER TABLE attendance ADD COLUMN jam_pulang_wajib TEXT;');
    }
    if (!attendanceCols.includes('status_ganti_jam')) {
      db.run("ALTER TABLE attendance ADD COLUMN status_ganti_jam TEXT DEFAULT 'tidak_perlu';");
    }
    if (!attendanceCols.includes('is_emergency_checkin')) {
      db.run('ALTER TABLE attendance ADD COLUMN is_emergency_checkin INTEGER DEFAULT 0;');
    }
    if (!attendanceCols.includes('emergency_reason')) {
      db.run('ALTER TABLE attendance ADD COLUMN emergency_reason TEXT;');
    }
    if (!attendanceCols.includes('approval_status')) {
      db.run("ALTER TABLE attendance ADD COLUMN approval_status TEXT DEFAULT 'approved';");
    }
    if (!attendanceCols.includes('approved_by')) {
      db.run('ALTER TABLE attendance ADD COLUMN approved_by TEXT;');
    }
    if (!attendanceCols.includes('approved_at')) {
      db.run('ALTER TABLE attendance ADD COLUMN approved_at TEXT;');
    }
    if (!attendanceCols.includes('approval_note')) {
      db.run('ALTER TABLE attendance ADD COLUMN approval_note TEXT;');
    }

    const workCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(work_assignments);').map(c => c.name);
    if (!workCols.includes('surat_tugas')) {
      db.run('ALTER TABLE work_assignments ADD COLUMN surat_tugas TEXT;');
    }

    const userCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(users);').map(c => c.name);
    if (!userCols.includes('foto_profil')) {
      db.run('ALTER TABLE users ADD COLUMN foto_profil TEXT;');
    }

    const leaveCols = queryAll<{ name: string }>(db, 'PRAGMA table_info(leave_requests);').map(c => c.name);
    if (!leaveCols.includes('durasi_hari')) {
      db.run('ALTER TABLE leave_requests ADD COLUMN durasi_hari INTEGER DEFAULT 0;');
      db.run('UPDATE leave_requests SET durasi_hari = COALESCE(jumlah_hari, 0);');
    }
    if (!leaveCols.includes('alamat_cuti')) {
      db.run('ALTER TABLE leave_requests ADD COLUMN alamat_cuti TEXT;');
    }
    if (!leaveCols.includes('telepon_cuti')) {
      db.run('ALTER TABLE leave_requests ADD COLUMN telepon_cuti TEXT;');
    }
    if (!leaveCols.includes('nama_atasan')) {
      db.run('ALTER TABLE leave_requests ADD COLUMN nama_atasan TEXT;');
    }
    if (!leaveCols.includes('nip_atasan')) {
      db.run('ALTER TABLE leave_requests ADD COLUMN nip_atasan TEXT;');
    }
    if (!leaveCols.includes('jabatan_atasan')) {
      db.run('ALTER TABLE leave_requests ADD COLUMN jabatan_atasan TEXT;');
    }
    if (!leaveCols.includes('pangkat_golongan')) {
      db.run('ALTER TABLE leave_requests ADD COLUMN pangkat_golongan TEXT;');
    }
    if (!leaveCols.includes('masa_kerja')) {
      db.run('ALTER TABLE leave_requests ADD COLUMN masa_kerja TEXT;');
    }

    // Create fcm_tokens table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS fcm_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        employee_id TEXT,
        token TEXT NOT NULL UNIQUE,
        device_name TEXT,
        platform TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Create travel_duties and travel_duty_employees tables if they don't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS travel_duties (
        id TEXT PRIMARY KEY,
        nomor_surat_tugas TEXT NOT NULL,
        jenis_perjalanan TEXT NOT NULL,
        tanggal_mulai TEXT NOT NULL,
        tanggal_selesai TEXT NOT NULL,
        kota_tujuan TEXT NOT NULL,
        tempat_tujuan TEXT,
        maksud_tujuan TEXT NOT NULL,
        beban_anggaran TEXT,
        status TEXT DEFAULT 'terjadwal',
        lampiran_dokumen TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS travel_duty_employees (
        id TEXT PRIMARY KEY,
        travel_duty_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        peran TEXT DEFAULT 'Anggota',
        FOREIGN KEY (travel_duty_id) REFERENCES travel_duties(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      );

      CREATE TABLE IF NOT EXISTS tukin_grades (
        id TEXT PRIMARY KEY,
        jabatan TEXT NOT NULL UNIQUE,
        kelas_jabatan INTEGER,
        besaran_dasar REAL NOT NULL,
        keterangan TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tukin_calculations (
        id TEXT PRIMARY KEY,
        bulan INTEGER NOT NULL,
        tahun INTEGER NOT NULL,
        employee_id TEXT NOT NULL,
        tukin_bruto REAL NOT NULL,
        hari_kerja INTEGER NOT NULL,
        hari_hadir INTEGER NOT NULL,
        hari_dinas INTEGER DEFAULT 0,
        hari_cuti INTEGER DEFAULT 0,
        hari_tk INTEGER DEFAULT 0,
        total_tl_menit INTEGER DEFAULT 0,
        potongan_tl_persen REAL DEFAULT 0,
        total_psw_menit INTEGER DEFAULT 0,
        potongan_psw_persen REAL DEFAULT 0,
        potongan_tk_persen REAL DEFAULT 0,
        total_potongan_persen REAL DEFAULT 0,
        total_potongan_rupiah REAL DEFAULT 0,
        tukin_netto REAL NOT NULL,
        status_pembayaran TEXT DEFAULT 'final',
        catatan TEXT,
        calculated_at TEXT,
        calculated_by TEXT,
        UNIQUE(bulan, tahun, employee_id)
      );

      CREATE TABLE IF NOT EXISTS feature_locks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        is_locked INTEGER DEFAULT 0,
        locked_for TEXT DEFAULT 'all_non_admin',
        release_estimate TEXT,
        maintenance_message TEXT,
        updated_at TEXT,
        updated_by TEXT
      );
    `);

    // Seed default feature_locks if missing
    const defaultFeatures = [
      {
        id: 'admin-tukin',
        name: 'Modul Perhitungan Tunjangan Kinerja (Tukin)',
        category: 'Keuangan & Tukin',
        description: 'Kalkulasi otomatis besaran tukin bersih pegawai berdasarkan persentase potongan keterlambatan (TL) dan pulang cepat (PSW).',
        is_locked: 0,
        locked_for: 'all_non_admin',
        release_estimate: 'Tahap Pengujian / Siap Pakai',
        maintenance_message: 'Modul Perhitungan Tukin sedang dalam tahap validasi aturan pemotongan dan belum dibuka untuk umum.'
      },
      {
        id: 'admin-perjalanan-dinas',
        name: 'Manajemen Perjalanan Dinas (SPPD)',
        category: 'Umum & Logistik',
        description: 'Penerbitan Surat Tugas, SPPD dalam/luar kota, alokasi anggaran belanja pegawai, dan riwayat penugasan dinas.',
        is_locked: 0,
        locked_for: 'all_non_admin',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Modul Perjalanan Dinas sedang dalam tahap pemutakhiran format dokumen SPPD KPU.'
      },
      {
        id: 'admin-wfh-wfa',
        name: 'Penetapan WFH / WFA Masal',
        category: 'SDM & Kepegawaian',
        description: 'Pengaturan dan persetujuan jadwal kerja fleksibel (Work From Home / Work From Anywhere) pegawai.',
        is_locked: 0,
        locked_for: 'all_non_admin',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Pengaturan WFH/WFA saat ini sedang dinonaktifkan sementara oleh Administrator.'
      },
      {
        id: 'admin-saldo',
        name: 'Saldo & Rollover Cuti Otomatis',
        category: 'SDM & Kepegawaian',
        description: 'Manajemen saldo cuti tahunan (N-2, N-1, N), penyesuaian manual kuota cuti, dan proses rollover tahunan.',
        is_locked: 0,
        locked_for: 'all_non_admin',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Modul Saldo & Rollover Cuti sedang dalam tahap sinkronisasi data hak cuti tahunan.'
      },
      {
        id: 'admin-rekap-penggunaan-cuti',
        name: 'Rekapitulasi Tahunan Penggunaan Cuti',
        category: 'SDM & Kepegawaian',
        description: 'Matriks rekapitulasi data riwayat cuti pegawai per tahun untuk pelaporan ke pimpinan KPU.',
        is_locked: 0,
        locked_for: 'all_non_admin',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Modul Rekap Penggunaan Cuti sedang dalam tahap pemeliharaan sistem.'
      },
      {
        id: 'pegawai-ajukan-cuti',
        name: 'Pengajuan Cuti Online (Pegawai)',
        category: 'Layanan Pegawai',
        description: 'Formulir digital pengajuan cuti tahunan/sakit/alasan penting, upload dokumen pendukung, dan tracking approval.',
        is_locked: 0,
        locked_for: 'pegawai_only',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Layanan Pengajuan Cuti Online saat ini sedang ditutup sementara oleh Administrator untuk evaluasi periode.'
      },
      {
        id: 'pegawai-saldo-cuti',
        name: 'Cek Saldo & Kalender Cuti (Pegawai)',
        category: 'Layanan Pegawai',
        description: 'Informasi transparansi hak sisa cuti pegawai dan kalender libur nasional / cuti bersama.',
        is_locked: 0,
        locked_for: 'pegawai_only',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Informasi saldo cuti sedang diperbarui untuk penetapan jatah cuti terbaru.'
      },
      {
        id: 'pegawai-riwayat-absensi',
        name: 'Riwayat Kehadiran Mandiri (Pegawai)',
        category: 'Layanan Pegawai',
        description: 'Akses pegawai melihat riwayat log presensi harian, foto masuk/pulang, dan catatan keterlambatan.',
        is_locked: 0,
        locked_for: 'pegawai_only',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Akses riwayat presensi pegawai sedang dalam pemeliharaan sistem.'
      },
      {
        id: 'pegawai-emergency-absen',
        name: 'Presensi Darurat Luar Radius (Selfie & Alasan)',
        category: 'Presensi',
        description: 'Fasilitas presensi khusus jika pegawai berada di luar radius kantor 150m dengan persetujuan admin.',
        is_locked: 0,
        locked_for: 'pegawai_only',
        release_estimate: 'Menunggu Pengesahan SOP',
        maintenance_message: 'Presensi di luar batas radius kantor saat ini tidak diizinkan. Silakan presensi di lokasi kantor KPU.'
      },
      {
        id: 'admin-audit-log',
        name: 'Audit Log & Keamanan Akses',
        category: 'Keamanan',
        description: 'Pencatatan rekam jejak aktivitas sensitif sistem, log IP, dan jejak perubahan status.',
        is_locked: 0,
        locked_for: 'all_non_admin',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Menu Audit Log hanya dibuka khusus Administrator Utama.'
      },
      {
        id: 'admin-presensi',
        name: 'Presensi Pegawai & Approval Luar Radius',
        category: 'Presensi & Kehadiran',
        description: 'Monitoring kehadiran harian seluruh pegawai, log jam masuk/pulang, dan verifikasi permohonan presensi darurat luar radius.',
        is_locked: 0,
        locked_for: 'all_non_admin',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Menu Presensi & Approval Radius sedang dalam pemeliharaan sistem.'
      },
      {
        id: 'admin-cuti',
        name: 'Persetujuan & Riwayat Cuti Pegawai',
        category: 'SDM & Kepegawaian',
        description: 'Verifikasi berkas, penerbitan surat cuti, persetujuan/penolakan, dan riwayat cuti seluruh ASN/PPPK/PPNPN.',
        is_locked: 0,
        locked_for: 'all_non_admin',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Modul Persetujuan Cuti sedang dalam penyesuaian regulasi cuti tahun berjalan.'
      },
      {
        id: 'admin-data-pegawai',
        name: 'Manajemen Data Pegawai & Akun',
        category: 'SDM & Kepegawaian',
        description: 'Pengelolaan data master pegawai, NIP, jabatan, golongan, serta reset akun login pegawai.',
        is_locked: 0,
        locked_for: 'all_non_admin',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Modul Data Pegawai sedang dalam sinkronisasi data master kepegawaian.'
      },
      {
        id: 'pegawai-profil',
        name: 'Profil & Keamanan Akun Pegawai',
        category: 'Layanan Pegawai',
        description: 'Pengaturan mandiri profil pegawai, ubah password, dan kontak darurat.',
        is_locked: 0,
        locked_for: 'pegawai_only',
        release_estimate: 'Siap Pakai',
        maintenance_message: 'Halaman profil mandiri sedang dalam pemeliharaan berkala.'
      }
    ];

    for (const f of defaultFeatures) {
      const existingF = queryOne<{ id: string }>(db, 'SELECT id FROM feature_locks WHERE id = ?', [f.id]);
      if (!existingF) {
        db.run(
          `INSERT INTO feature_locks (id, name, category, description, is_locked, locked_for, release_estimate, maintenance_message, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'system')`,
          [f.id, f.name, f.category, f.description, f.is_locked, f.locked_for, f.release_estimate, f.maintenance_message]
        );
      }
    }

    // Seed default tukin_grades if empty
    const tukinCount = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM tukin_grades');
    if (!tukinCount || tukinCount.count === 0) {
      db.run(`
        INSERT INTO tukin_grades (id, jabatan, kelas_jabatan, besaran_dasar, keterangan, created_at, updated_at) VALUES
        ('tg_sekretaris', 'Sekretaris', 14, 11670000, 'Pejabat Pimpinan Tinggi / Eselon II/III KPU', datetime('now'), datetime('now')),
        ('tg_kasubbag', 'Kepala Sub Bagian', 9, 5079000, 'Pejabat Pengawas / Sub Bagian KPU', datetime('now'), datetime('now')),
        ('tg_bendahara', 'Bendahara Pengeluaran', 7, 3915900, 'Fungsional Pengelola Keuangan APBN', datetime('now'), datetime('now')),
        ('tg_analis_hukum', 'Analis Hukum / Teknis', 7, 3915900, 'Jabatan Fungsional Keahlian / Teknis Penyelenggara', datetime('now'), datetime('now')),
        ('tg_penata_pemilu', 'Penata Kelola Pemilu', 8, 4595150, 'Jabatan Fungsional Tertentu Kepemiluan', datetime('now'), datetime('now')),
        ('tg_staf_pelaksana', 'Staf Pelaksana', 6, 3510400, 'Pelaksana Administrasi Perkantoran KPU', datetime('now'), datetime('now')),
        ('tg_ppnpn', 'PPNPN / Tenaga Pendukung', 3, 2500000, 'Honorarium / Tunjangan Operasional Tenaga Kontrak', datetime('now'), datetime('now'));
      `);
    }

    // Seed sample travel duties if empty
    const travelCount = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM travel_duties');
    if (!travelCount || travelCount.count === 0) {
      db.run(`
        INSERT INTO travel_duties (
          id, nomor_surat_tugas, jenis_perjalanan, tanggal_mulai, tanggal_selesai,
          kota_tujuan, tempat_tujuan, maksud_tujuan, beban_anggaran, status, created_by, created_at, updated_at
        ) VALUES (
          'std_sample_1', '092/ST/KPU-SPN/IX/2026', 'luar_kota', '2026-09-22', '2026-09-24',
          'Kota Jambi', 'Kantor KPU Provinsi Jambi',
          'Rapat Koordinasi Evaluasi Tahapan Logistik dan Pemutakhiran Data Pemilih', 'DIPA KPU Kota Sungai Penuh T.A. 2026',
          'terjadwal', 'usr_admin_1', datetime('now'), datetime('now')
        ),
        (
          'std_sample_2', '088/ST/KPU-SPN/IX/2026', 'dalam_kota', '2026-09-15', '2026-09-15',
          'Kecamatan Hamparan Rawang', 'Kantor PPK Hamparan Rawang',
          'Supervisi dan Monitoring Uji Petik Verifikasi Faktual Administrasi', 'DIPA KPU Kota Sungai Penuh T.A. 2026',
          'selesai', 'usr_admin_1', datetime('now'), datetime('now')
        );

        INSERT INTO travel_duty_employees (id, travel_duty_id, employee_id, peran) VALUES
        ('tde_1', 'std_sample_1', 'emp_budi', 'Ketua Tim'),
        ('tde_2', 'std_sample_1', 'emp_ahmad', 'Anggota Tim'),
        ('tde_3', 'std_sample_2', 'emp_dewi', 'Ketua Tim');
      `);
    }

    // Ensure official leave types and assignment categories exist
    db.run(`
      INSERT OR IGNORE INTO leave_types (id, kode, nama, uses_balance, requires_attachment, keterangan) VALUES
      ('lt_tb', 'TB', 'Tugas Belajar', 0, 1, 'Tugas belajar kedinasan KPU'),
      ('lt_kp', 'K/P', 'Kursus / Pelatihan', 0, 1, 'Kursus, diklat, atau bimbingan teknis kepemiluan'),
      ('lt_dd', 'DD', 'Dinas Dalam Daerah', 0, 0, 'Penugasan dinas dalam daerah Kota Sungai Penuh'),
      ('lt_dl', 'DL', 'Dinas Luar Daerah', 0, 1, 'Penugasan dinas luar daerah KPU'),
      ('lt_wfh', 'WFH', 'Work From Home', 0, 0, 'Penugasan pelaksanaan tugas kedinasan dari rumah');
    `);

    // Pastikan HANYA Cuti Tahunan (kode 'CT' / id 'lt_ct') yang memotong saldo cuti tahunan
    db.run("UPDATE leave_types SET uses_balance = CASE WHEN id = 'lt_ct' OR kode = 'CT' THEN 1 ELSE 0 END;");

    // Ensure Admin account is distinct (not an employee), with username 'admincutikpuspn'
    const defaultAdminPassHash = bcrypt.hashSync('admin123', 10);
    const nowIso = new Date().toISOString();
    const existingAdmin = queryOne<{ id: string }>(
      db,
      "SELECT id FROM users WHERE role = 'admin' OR username IN ('admin', 'admincutikpuspn') LIMIT 1;"
    );

    if (existingAdmin) {
      db.run(
        "UPDATE users SET username = 'admincutikpuspn', role = 'admin', employee_id = NULL, updated_at = ? WHERE id = ?",
        [nowIso, existingAdmin.id]
      );
    } else {
      db.run(`
        INSERT INTO users (id, username, email, password_hash, role, employee_id, is_active, created_at, updated_at)
        VALUES ('usr_admin_1', 'admincutikpuspn', 'admincutikpuspn@kpu.go.id', '${defaultAdminPassHash}', 'admin', NULL, 1, '${nowIso}', '${nowIso}')
      `);
    }

    // Seed or ensure Operator accounts (SDM, Keuangan, Umum)
    const operatorAccounts = [
      {
        id: 'usr_op_sdm',
        username: 'operatorsdm',
        email: 'sdm@kpu-sungaipenuh.go.id',
        password: 'sdm123',
        role: 'operator_sdm',
        nama: 'Operator Subbag SDM & Parmas'
      },
      {
        id: 'usr_op_keuangan',
        username: 'operatorkeuangan',
        email: 'keuangan@kpu-sungaipenuh.go.id',
        password: 'keuangan123',
        role: 'operator_keuangan',
        nama: 'Operator Subbag Keuangan & Logistik'
      },
      {
        id: 'usr_op_umum',
        username: 'operatorumum',
        email: 'umum@kpu-sungaipenuh.go.id',
        password: 'umum123',
        role: 'operator_umum',
        nama: 'Operator Subbag Umum & Logistik'
      }
    ];

    for (const op of operatorAccounts) {
      const existingOp = queryOne<{ id: string }>(db, 'SELECT id FROM users WHERE username = ?', [op.username]);
      if (!existingOp) {
        const passHash = bcrypt.hashSync(op.password, 10);
        db.run(
          `INSERT INTO users (id, username, email, password_hash, role, employee_id, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, 1, ?, ?)`,
          [op.id, op.username, op.email, passHash, op.role, nowIso, nowIso]
        );
      }
    }

    // Purge admin records from employees table so admin NEVER enters the employee list
    db.run('PRAGMA foreign_keys = OFF;');
    try {
      const adminEmps = queryAll<{ id: string }>(
        db,
        "SELECT id FROM employees WHERE role = 'admin' OR username IN ('admin', 'admincutikpuspn') OR id = 'emp_admin_1';"
      );
      for (const emp of adminEmps) {
        db.run("UPDATE users SET employee_id = NULL WHERE employee_id = ?;", [emp.id]);
        db.run("DELETE FROM leave_approvals WHERE leave_request_id IN (SELECT id FROM leave_requests WHERE employee_id = ?);", [emp.id]);
        db.run("DELETE FROM leave_requests WHERE employee_id = ?;", [emp.id]);
        db.run("DELETE FROM leave_balance_transactions WHERE employee_id = ?;", [emp.id]);
        db.run("DELETE FROM leave_balances WHERE employee_id = ?;", [emp.id]);
        db.run("DELETE FROM attendance_photos WHERE attendance_id IN (SELECT id FROM attendance WHERE employee_id = ?);", [emp.id]);
        db.run("DELETE FROM attendance WHERE employee_id = ?;", [emp.id]);
        db.run("DELETE FROM employees WHERE id = ?;", [emp.id]);
      }
    } finally {
      db.run('PRAGMA foreign_keys = ON;');
    }

    // Ensure user_sessions table exists for persistent auth across server restarts
    db.run(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        employee_id TEXT,
        nama_lengkap TEXT NOT NULL,
        nip_nik TEXT,
        jabatan TEXT,
        unit_kerja TEXT,
        foto_profil TEXT,
        operator_role TEXT,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Ensure work_schedules table exists and sync schedule to KPU rules (07:30:00, toleransi 59 min => batas 08:29)
    try {
      db.run(`
        CREATE TABLE IF NOT EXISTS work_schedules (
          id TEXT PRIMARY KEY,
          jam_masuk TEXT NOT NULL,
          jam_pulang TEXT NOT NULL,
          toleransi_keterlambatan_menit INTEGER NOT NULL DEFAULT 59,
          hari_kerja TEXT NOT NULL DEFAULT '1,2,3,4,5',
          is_active INTEGER NOT NULL DEFAULT 1
        );
      `);
      db.run("UPDATE work_schedules SET jam_masuk = '07:30:00', toleransi_keterlambatan_menit = 59 WHERE id = 'sched_default' OR is_active = 1;");
    } catch (_) {}

    saveDb(db);
  } catch (err) {
    console.warn('ensureColumnsExist notice:', err);
  }
}

export function getDbSync(): Database | null {
  return dbInstance;
}

export function saveDb(db?: Database) {
  const targetDb = db || dbInstance;
  if (!targetDb) return;
  try {
    const data = targetDb.export();
    const buffer = Buffer.from(data);
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, buffer);
    fs.renameSync(tmpFile, DB_FILE);
    // Also maintain a backup copy for resilience
    try {
      fs.copyFileSync(DB_FILE, `${DB_FILE}.bak`);
    } catch (_) {}
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}

// SQL query helper for convenience
export function queryAll<T = any>(db: Database, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = any>(db: Database, sql: string, params: any[] = []): T | null {
  const res = queryAll<T>(db, sql, params);
  return res.length > 0 ? res[0] : null;
}

let transactionDepth = 0;

export function executeSql(db: Database, sql: string, params: any[] = []): void {
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  stmt.step();
  stmt.free();
  if (transactionDepth === 0) {
    saveDb(db);
  }
}

export function runTransaction<T>(db: Database, callback: () => T): T {
  if (transactionDepth === 0) {
    db.run('BEGIN TRANSACTION;');
  }
  transactionDepth++;
  try {
    const result = callback();
    transactionDepth--;
    if (transactionDepth === 0) {
      db.run('COMMIT;');
      saveDb(db);
    }
    return result;
  } catch (err) {
    transactionDepth--;
    if (transactionDepth === 0) {
      try {
        db.run('ROLLBACK;');
      } catch (_) {}
    }
    throw err;
  }
}

async function initSchemaAndSeed(db: Database) {
  // 1. Roles table
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );
  `);

  // 2. Employees table
  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      nip_nik TEXT UNIQUE NOT NULL,
      nama_lengkap TEXT NOT NULL,
      tempat_lahir TEXT,
      tanggal_lahir TEXT,
      pangkat_golongan TEXT,
      sub_bagian TEXT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      nomor_hp TEXT,
      jabatan TEXT NOT NULL,
      unit_kerja TEXT NOT NULL,
      status_pegawai TEXT NOT NULL DEFAULT 'aktif',
      tanggal_masuk TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'pegawai',
      operator_role TEXT,
      jatah_cuti_tahunan INTEGER NOT NULL DEFAULT 12,
      foto_profil TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 3. Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      employee_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
  `);

  // 4. Attendance table
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      jam_masuk TEXT,
      jam_pulang TEXT,
      foto_masuk TEXT,
      foto_pulang TEXT,
      latitude_masuk REAL,
      longitude_masuk REAL,
      latitude_pulang REAL,
      longitude_pulang REAL,
      jarak_dari_kantor REAL,
      status_validasi_lokasi TEXT NOT NULL DEFAULT 'valid',
      status TEXT NOT NULL DEFAULT 'Hadir',
      metode_kerja TEXT NOT NULL DEFAULT 'WFO',
      keterlambatan_menit INTEGER DEFAULT 0,
      jam_pulang_wajib TEXT,
      status_ganti_jam TEXT DEFAULT 'tidak_perlu',
      device_info TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, tanggal)
    );
  `);

  try {
    db.run('ALTER TABLE attendance ADD COLUMN keterlambatan_menit INTEGER DEFAULT 0');
  } catch {}
  try {
    db.run('ALTER TABLE attendance ADD COLUMN jam_pulang_wajib TEXT');
  } catch {}
  try {
    db.run('ALTER TABLE attendance ADD COLUMN status_ganti_jam TEXT DEFAULT "tidak_perlu"');
  } catch {}

  // 5. Attendance Photos
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance_photos (
      id TEXT PRIMARY KEY,
      attendance_id TEXT NOT NULL,
      type TEXT NOT NULL,
      photo_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (attendance_id) REFERENCES attendance(id)
    );
  `);

  // 6. Leave Types
  db.run(`
    CREATE TABLE IF NOT EXISTS leave_types (
      id TEXT PRIMARY KEY,
      kode TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      uses_balance INTEGER NOT NULL DEFAULT 0,
      requires_attachment INTEGER NOT NULL DEFAULT 0,
      keterangan TEXT
    );
  `);

  // 7. Leave Requests
  db.run(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      nomor_pengajuan TEXT UNIQUE NOT NULL,
      employee_id TEXT NOT NULL,
      leave_type_id TEXT NOT NULL,
      tanggal_mulai TEXT NOT NULL,
      tanggal_selesai TEXT NOT NULL,
      jumlah_hari INTEGER NOT NULL,
      alasan TEXT NOT NULL,
      lampiran_url TEXT,
      status TEXT NOT NULL DEFAULT 'Menunggu Approval',
      tanggal_pengajuan TEXT NOT NULL,
      approver_id TEXT,
      tanggal_approval TEXT,
      catatan_admin TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    );
  `);

  // 8. Leave Approvals
  db.run(`
    CREATE TABLE IF NOT EXISTS leave_approvals (
      id TEXT PRIMARY KEY,
      leave_request_id TEXT NOT NULL,
      approver_id TEXT NOT NULL,
      action TEXT NOT NULL,
      alasan_penolakan TEXT,
      saldo_sebelum INTEGER,
      saldo_sesudah INTEGER,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    );
  `);

  // 9. Leave Balances
  db.run(`
    CREATE TABLE IF NOT EXISTS leave_balances (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      tahun INTEGER NOT NULL,
      n_2 INTEGER NOT NULL DEFAULT 0,
      n_1 INTEGER NOT NULL DEFAULT 0,
      n INTEGER NOT NULL DEFAULT 12,
      total INTEGER NOT NULL DEFAULT 12,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, tahun)
    );
  `);

  // 10. Leave Balance Transactions
  db.run(`
    CREATE TABLE IF NOT EXISTS leave_balance_transactions (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      leave_request_id TEXT,
      type TEXT NOT NULL,
      n_2_sebelum INTEGER,
      n_2_sesudah INTEGER,
      n_1_sebelum INTEGER,
      n_1_sesudah INTEGER,
      n_sebelum INTEGER,
      n_sesudah INTEGER,
      total_sebelum INTEGER,
      total_sesudah INTEGER,
      alasan TEXT NOT NULL,
      admin_id TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
  `);

  // 11. Work Schedules
  db.run(`
    CREATE TABLE IF NOT EXISTS work_schedules (
      id TEXT PRIMARY KEY,
      jam_masuk TEXT NOT NULL DEFAULT '07:30:00',
      jam_pulang TEXT NOT NULL DEFAULT '16:00:00',
      toleransi_keterlambatan_menit INTEGER NOT NULL DEFAULT 15,
      hari_kerja TEXT NOT NULL DEFAULT '1,2,3,4,5',
      is_active INTEGER NOT NULL DEFAULT 1
    );
  `);

  // 12. Work Assignments (WFH / WFA / WFO)
  db.run(`
    CREATE TABLE IF NOT EXISTS work_assignments (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      metode_kerja TEXT NOT NULL,
      keterangan TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      UNIQUE(employee_id, tanggal)
    );
  `);

  // 13. Holidays
  db.run(`
    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      tanggal TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      is_cuti_bersama INTEGER NOT NULL DEFAULT 0
    );
  `);

  // 14. Office Locations
  db.run(`
    CREATE TABLE IF NOT EXISTS office_locations (
      id TEXT PRIMARY KEY,
      nama TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_meter REAL NOT NULL,
      alamat TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );
  `);

  // 15. Rollover Logs
  db.run(`
    CREATE TABLE IF NOT EXISTS rollover_logs (
      id TEXT PRIMARY KEY,
      tahun_proses INTEGER NOT NULL,
      tanggal_proses TEXT NOT NULL,
      status TEXT NOT NULL,
      jumlah_pegawai_diproses INTEGER NOT NULL,
      triggered_by TEXT NOT NULL,
      admin_id TEXT,
      detail_perubahan TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // 16. Audit Logs
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // 17. Password Resets
  db.run(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      reset_by TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);

  // 18. Notifications
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fcm_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      employee_id TEXT,
      token TEXT NOT NULL UNIQUE,
      device_name TEXT,
      platform TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS biometric_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT,
      device_name TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT
    );
  `);

  // 19. System Settings
  db.run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      keterangan TEXT
    );
  `);

  // ================= SEED INITIAL DATA =================
  console.log('Seeding initial data for KPU Kota Sungai Penuh...');

  // Roles
  db.run(`
    INSERT OR IGNORE INTO roles (id, name, description) VALUES
    ('role_admin', 'admin', 'Administrator Sistem Kepegawaian KPU'),
    ('role_pegawai', 'pegawai', 'Pegawai KPU Kota Sungai Penuh');
  `);

  // Leave Types
  db.run(`
    INSERT OR IGNORE INTO leave_types (id, kode, nama, uses_balance, requires_attachment, keterangan) VALUES
    ('lt_ct', 'CT', 'Cuti Tahunan', 1, 0, 'Cuti tahunan yang memotong saldo cuti tahun berjalan (N, N-1, N-2)'),
    ('lt_cb', 'CB', 'Cuti Besar', 0, 0, 'Cuti besar bagi pegawai yang telah mengabdi sekurang-kurangnya 5 tahun'),
    ('lt_cs', 'CS', 'Cuti Sakit', 0, 1, 'Cuti karena sakit dengan melampirkan surat keterangan dokter resmi'),
    ('lt_cm', 'CM', 'Cuti Melahirkan', 0, 1, 'Cuti bersalin untuk kelahiran anak pertama hingga ketiga'),
    ('lt_cap', 'CAP', 'Cuti Alasan Penting', 0, 1, 'Cuti karena keperluan mendesak keluarga sakit berat atau meninggal'),
    ('lt_cltn', 'CLTN', 'Cuti di Luar Tanggungan Negara', 0, 1, 'Cuti tanpa menerima penghasilan dari negara');
  `);

  // Office Location (Kantor KPU Kota Sungai Penuh)
  db.run(`
    INSERT OR IGNORE INTO office_locations (id, nama, latitude, longitude, radius_meter, alamat, is_active) VALUES
    ('loc_kpu_spn', 'Kantor KPU Kota Sungai Penuh', -2.069272, 101.403224, 150.0, 'Jl. Pancasila, Lawang Agung, Kecamatan Pondok Tinggi, Kota Sungai Penuh', 1);
  `);

  // Work Schedules
  db.run(`
    INSERT OR IGNORE INTO work_schedules (id, jam_masuk, jam_pulang, toleransi_keterlambatan_menit, hari_kerja, is_active) VALUES
    ('sched_default', '07:30:00', '16:00:00', 15, '1,2,3,4,5', 1);
  `);

  // System Settings
  db.run(`
    INSERT OR IGNORE INTO system_settings (id, setting_key, setting_value, keterangan) VALUES
    ('st_instansi', 'nama_instansi', 'KOMISI PEMILIHAN UMUM KOTA SUNGAI PENUH', 'Nama instansi'),
    ('st_alamat', 'alamat_instansi', 'Jl. Jend. Sudirman No. 45, Kota Sungai Penuh, Jambi', 'Alamat resmi instansi'),
    ('st_telepon', 'kontak_instansi', '(0748) 21545 / kpu.sungaipenuh@kpu.go.id', 'Kontak resmi instansi'),
    ('st_sekretaris', 'nama_sekretaris', 'Hj. Dewi Aprida, S.E., M.Si.', 'Nama Sekretaris KPU'),
    ('st_jabatan_sekretaris', 'jabatan_sekretaris', 'Sekretaris Komisi Pemilihan Umum Kota Sungai Penuh', 'Jabatan resmi Sekretaris KPU'),
    ('st_jatah_ct', 'jatah_cuti_tahunan', '12', 'Jatah hari cuti tahunan per tahun'),
    ('st_cutoff', 'cutoff_hari_kerja_only', 'true', 'Apakah perhitungan hari cuti hanya menghitung hari kerja'),
    ('st_wajib_foto', 'wajib_foto_absensi', 'true', 'Apakah foto selfie wajib saat absen'),
    ('st_wajib_gps', 'wajib_gps_absensi', 'true', 'Apakah GPS wajib saat absen');
  `);

  // National Holidays 2026 Sample (Sungai Penuh / Indonesia)
  db.run(`
    INSERT OR IGNORE INTO holidays (id, tanggal, nama, is_cuti_bersama) VALUES
    ('hol_1', '2026-01-01', 'Tahun Baru 2026 Masehi', 0),
    ('hol_2', '2026-01-16', 'Isra Miraj Nabi Muhammad SAW', 0),
    ('hol_3', '2026-02-17', 'Tahun Baru Imlek 2577 Kongzili', 0),
    ('hol_4', '2026-03-20', 'Hari Suci Nyepi Tahun Baru Saka 1948', 0),
    ('hol_5', '2026-03-21', 'Hari Raya Idul Fitri 1447 Hijriah', 0),
    ('hol_6', '2026-03-22', 'Hari Raya Idul Fitri 1447 Hijriah Hari Kedua', 0),
    ('hol_7', '2026-05-01', 'Hari Buruh Internasional', 0),
    ('hol_8', '2026-05-14', 'Kenaikan Isa Almasih', 0),
    ('hol_9', '2026-06-01', 'Hari Lahir Pancasila', 0),
    ('hol_10', '2026-08-17', 'Hari Kemerdekaan Republik Indonesia ke-81', 0);
  `);

  // Default Passwords (hashed securely using bcrypt with 10 salt rounds)
  const defaultAdminPassHash = bcrypt.hashSync('admin123', 10);
  const defaultPegawaiPassHash = bcrypt.hashSync('kpu123', 10);

  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  // 1. Admin User (Murni akun administrator, bukan pegawai)
  db.run(`
    INSERT OR IGNORE INTO users (
      id, username, email, password_hash, role, employee_id, is_active, created_at, updated_at
    ) VALUES (
      'usr_admin_1', 'admincutikpuspn', 'admincutikpuspn@kpu.go.id', '${defaultAdminPassHash}', 'admin', NULL, 1, '${now}', '${now}'
    );
  `);

  // 2. Staff Employees (KPU Kota Sungai Penuh personnel)
  // Demo / sample employees disabled: real employee data will be uploaded by admin via Excel.
  const sampleEmployees: any[] = [];

  for (const emp of sampleEmployees) {
    db.run(`
      INSERT OR IGNORE INTO employees (
        id, nip_nik, nama_lengkap, username, email, nomor_hp,
        jabatan, unit_kerja, status_pegawai, tanggal_masuk, role,
        jatah_cuti_tahunan, foto_profil, is_deleted, created_at, updated_at
      ) VALUES (
        '${emp.id}', '${emp.nip}', '${emp.nama}', '${emp.username}', '${emp.email}', '${emp.hp}',
        '${emp.jabatan}', '${emp.unit_kerja}', 'aktif', '${emp.masuk}', 'pegawai',
        12, '${emp.foto}', 0, '${now}', '${now}'
      );
    `);

    db.run(`
      INSERT OR IGNORE INTO users (
        id, username, email, password_hash, role, employee_id, is_active, created_at, updated_at
      ) VALUES (
        'usr_${emp.username}', '${emp.username}', '${emp.email}', '${defaultPegawaiPassHash}', 'pegawai', '${emp.id}', 1, '${now}', '${now}'
      );
    `);

    // Leave balance for current year
    const total = emp.n_2 + emp.n_1 + emp.n;
    db.run(`
      INSERT OR IGNORE INTO leave_balances (
        id, employee_id, tahun, n_2, n_1, n, total, updated_at
      ) VALUES (
        'bal_${emp.id}_${currentYear}', '${emp.id}', ${currentYear}, ${emp.n_2}, ${emp.n_1}, ${emp.n}, ${total}, '${now}'
      );
    `);

    db.run(`
      INSERT OR IGNORE INTO leave_balance_transactions (
        id, employee_id, leave_request_id, type,
        n_2_sebelum, n_2_sesudah, n_1_sebelum, n_1_sesudah, n_sebelum, n_sesudah,
        total_sebelum, total_sesudah, alasan, admin_id, timestamp
      ) VALUES (
        'tx_init_${emp.id}', '${emp.id}', NULL, 'INITIAL',
        0, ${emp.n_2}, 0, ${emp.n_1}, 0, ${emp.n},
        0, ${total}, 'Saldo awal tahun ${currentYear} hasil penyesuaian/rollover', 'usr_admin_1', '${now}'
      );
    `);
  }

  // Seed sample WFH assignment for Siti on today
  const todayStr = new Date().toISOString().split('T')[0];
  db.run(`
    INSERT OR IGNORE INTO work_assignments (
      id, employee_id, tanggal, metode_kerja, keterangan, created_by, created_at
    ) VALUES (
      'wa_siti_today', 'emp_siti', '${todayStr}', 'WFH', 'Penyusunan Laporan Keuangan Tahunan Berkas Pengadaan', 'usr_admin_1', '${now}'
    );
  `);

  // Seed sample attendance for today (Budi and Dewi already absent today)
  db.run(`
    INSERT OR IGNORE INTO attendance (
      id, employee_id, tanggal, jam_masuk, jam_pulang, foto_masuk, foto_pulang,
      latitude_masuk, longitude_masuk, latitude_pulang, longitude_pulang,
      jarak_dari_kantor, status_validasi_lokasi, status, metode_kerja, device_info, created_at, updated_at
    ) VALUES (
      'att_budi_today', 'emp_budi', '${todayStr}', '07:22:15', NULL,
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', NULL,
      -2.069270, 101.403220, NULL, NULL,
      12.4, 'valid', 'Hadir', 'WFO', 'Chrome on Android / Samsung SM-G998B', '${now}', '${now}'
    ),
    (
      'att_dewi_today', 'emp_dewi', '${todayStr}', '07:42:08', NULL,
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80', NULL,
      -2.069280, 101.403230, NULL, NULL,
      35.8, 'valid', 'Terlambat', 'WFO', 'Safari on iPhone 14 Pro', '${now}', '${now}'
    );
  `);

  // Seed sample leave requests across multiple categories
  db.run(`
    INSERT OR IGNORE INTO leave_requests (
      id, nomor_pengajuan, employee_id, leave_type_id, tanggal_mulai, tanggal_selesai,
      jumlah_hari, alasan, lampiran_url, status, tanggal_pengajuan, approver_id, tanggal_approval, catatan_admin, created_at, updated_at
    ) VALUES 
    (
      'req_sample_pending', 'CUTI/2026/09/001', 'emp_ahmad', 'lt_ct', '${todayStr}', '${todayStr}',
      1, 'Keperluan pengurusan berkas kependudukan keluarga di Dukcapil', NULL,
      'Menunggu Approval', '${todayStr}', NULL, NULL, NULL, '${now}', '${now}'
    ),
    (
      'req_sample_approved', 'CUTI/2026/08/014', 'emp_dewi', 'lt_ct', '2026-08-10', '2026-08-12',
      3, 'Acara wisuda adik kandung di Padang', NULL,
      'Disetujui', '2026-08-01', 'usr_admin_1', '2026-08-02 09:15:00', 'Disetujui. Harap selesaikan laporan sebelum berangkat.', '${now}', '${now}'
    ),
    (
      'req_sample_sick', 'CUTI/2026/07/005', 'emp_rizki', 'lt_cs', '2026-07-20', '2026-07-21',
      2, 'Sakit demam berdarah opname di RSUD Mayjen H.A Thalib', 'surat_keterangan_dokter_rsud.pdf',
      'Disetujui', '2026-07-20', 'usr_admin_1', '2026-07-20 10:00:00', 'Disetujui, lekas sembuh.', '${now}', '${now}'
    ),
    (
      'req_sample_important', 'CUTI/2026/06/008', 'emp_siti', 'lt_cap', '2026-06-15', '2026-06-17',
      3, 'Melangsungkan pernikahan keluarga inti di Kerinci', 'surat_keterangan_nikah.pdf',
      'Disetujui', '2026-06-10', 'usr_admin_1', '2026-06-11 14:00:00', 'Disetujui, selamat.', '${now}', '${now}'
    ),
    (
      'req_sample_maternity', 'CUTI/2026/04/002', 'emp_dewi', 'lt_cm', '2026-04-01', '2026-04-10',
      8, 'Pemeriksaan kehamilan dan persiapan kelahiran anak kedua', 'surat_rsia.pdf',
      'Disetujui', '2026-03-25', 'usr_admin_1', '2026-03-26 11:30:00', 'Disetujui sesuai ketentuan cuti melahirkan ASN.', '${now}', '${now}'
    ),
    (
      'req_sample_big', 'CUTI/2026/05/011', 'emp_budi', 'lt_cb', '2026-05-05', '2026-05-09',
      5, 'Melaksanakan ibadah umroh ke tanah suci Mekkah', 'jadwal_visa_umroh.pdf',
      'Disetujui', '2026-04-20', 'usr_admin_1', '2026-04-22 09:00:00', 'Disetujui. Cuti besar memenuhi syarat masa kerja > 5 tahun.', '${now}', '${now}'
    );
  `);

  // Seed sample historical attendance records across previous months if count is low
  const attCount = queryOne<{ count: number }>(db, 'SELECT COUNT(*) as count FROM attendance');
  if (!attCount || attCount.count < 10) {
    const historicalDates = [
      // September 2026 (Recent days)
      { date: '2026-09-01', wfo: ['emp_budi', 'emp_dewi', 'emp_ahmad'], wfh: ['emp_siti'], wfa: [] },
      { date: '2026-09-02', wfo: ['emp_budi', 'emp_dewi', 'emp_siti'], wfh: ['emp_rizki'], wfa: ['emp_ahmad'] },
      { date: '2026-09-03', wfo: ['emp_budi', 'emp_ahmad', 'emp_rizki'], wfh: ['emp_dewi'], wfa: [] },
      { date: '2026-09-04', wfo: ['emp_dewi', 'emp_siti', 'emp_ahmad'], wfh: ['emp_budi'], wfa: [] },
      { date: '2026-09-07', wfo: ['emp_budi', 'emp_dewi', 'emp_rizki', 'emp_siti'], wfh: [], wfa: ['emp_ahmad'] },
      { date: '2026-09-08', wfo: ['emp_budi', 'emp_dewi', 'emp_ahmad'], wfh: ['emp_siti'], wfa: [] },
      { date: '2026-09-09', wfo: ['emp_budi', 'emp_siti', 'emp_rizki'], wfh: ['emp_dewi'], wfa: ['emp_ahmad'] },
      { date: '2026-09-10', wfo: ['emp_budi', 'emp_dewi', 'emp_ahmad', 'emp_siti'], wfh: ['emp_rizki'], wfa: [] },
      { date: '2026-09-11', wfo: ['emp_budi', 'emp_dewi', 'emp_rizki'], wfh: ['emp_ahmad'], wfa: [] },
      // August 2026
      { date: '2026-08-03', wfo: ['emp_budi', 'emp_dewi', 'emp_ahmad'], wfh: ['emp_siti'], wfa: [] },
      { date: '2026-08-04', wfo: ['emp_budi', 'emp_siti', 'emp_rizki'], wfh: ['emp_ahmad'], wfa: ['emp_dewi'] },
      { date: '2026-08-05', wfo: ['emp_budi', 'emp_dewi', 'emp_siti', 'emp_ahmad'], wfh: [], wfa: ['emp_rizki'] },
      { date: '2026-08-06', wfo: ['emp_dewi', 'emp_ahmad', 'emp_rizki'], wfh: ['emp_budi'], wfa: [] },
      { date: '2026-08-07', wfo: ['emp_budi', 'emp_dewi', 'emp_siti'], wfh: ['emp_rizki'], wfa: [] },
      { date: '2026-08-14', wfo: ['emp_budi', 'emp_dewi', 'emp_ahmad', 'emp_rizki'], wfh: ['emp_siti'], wfa: [] },
      { date: '2026-08-18', wfo: ['emp_budi', 'emp_ahmad', 'emp_siti'], wfh: ['emp_dewi'], wfa: ['emp_rizki'] },
      { date: '2026-08-25', wfo: ['emp_budi', 'emp_dewi', 'emp_ahmad'], wfh: ['emp_siti'], wfa: [] },
      // July 2026
      { date: '2026-07-06', wfo: ['emp_budi', 'emp_dewi', 'emp_siti'], wfh: ['emp_ahmad'], wfa: [] },
      { date: '2026-07-07', wfo: ['emp_budi', 'emp_ahmad', 'emp_rizki'], wfh: ['emp_dewi'], wfa: [] },
      { date: '2026-07-08', wfo: ['emp_dewi', 'emp_siti', 'emp_ahmad'], wfh: ['emp_budi'], wfa: ['emp_rizki'] },
      { date: '2026-07-15', wfo: ['emp_budi', 'emp_dewi', 'emp_ahmad', 'emp_siti'], wfh: [], wfa: [] },
      // June 2026
      { date: '2026-06-08', wfo: ['emp_budi', 'emp_dewi', 'emp_rizki'], wfh: ['emp_siti'], wfa: ['emp_ahmad'] },
      { date: '2026-06-09', wfo: ['emp_budi', 'emp_dewi', 'emp_ahmad'], wfh: ['emp_rizki'], wfa: [] },
      { date: '2026-06-10', wfo: ['emp_budi', 'emp_siti', 'emp_ahmad'], wfh: ['emp_dewi'], wfa: [] },
      { date: '2026-06-22', wfo: ['emp_budi', 'emp_dewi', 'emp_rizki', 'emp_siti'], wfh: [], wfa: ['emp_ahmad'] },
      // May 2026
      { date: '2026-05-11', wfo: ['emp_dewi', 'emp_ahmad', 'emp_siti'], wfh: ['emp_rizki'], wfa: [] },
      { date: '2026-05-12', wfo: ['emp_budi', 'emp_dewi', 'emp_ahmad'], wfh: ['emp_siti'], wfa: ['emp_rizki'] },
      { date: '2026-05-20', wfo: ['emp_budi', 'emp_dewi', 'emp_rizki'], wfh: ['emp_ahmad'], wfa: [] },
      // April 2026
      { date: '2026-04-13', wfo: ['emp_budi', 'emp_ahmad', 'emp_siti'], wfh: ['emp_dewi'], wfa: [] },
      { date: '2026-04-14', wfo: ['emp_budi', 'emp_dewi', 'emp_rizki'], wfh: ['emp_siti'], wfa: ['emp_ahmad'] },
      { date: '2026-04-21', wfo: ['emp_budi', 'emp_dewi', 'emp_ahmad', 'emp_siti'], wfh: [], wfa: [] }
    ];

    historicalDates.forEach((entry, idx) => {
      const allEmps = [
        ...entry.wfo.map(e => ({ emp: e, method: 'WFO' })),
        ...entry.wfh.map(e => ({ emp: e, method: 'WFH' })),
        ...entry.wfa.map(e => ({ emp: e, method: 'WFA' }))
      ];

      allEmps.forEach((item, itemIdx) => {
        const isLate = itemIdx % 4 === 2; // 25% sample late
        const hour = isLate ? '07:42:10' : '07:18:25';
        const status = isLate ? 'Terlambat' : 'Hadir';
        const attId = `att_hist_${entry.date}_${item.emp}`;

        db.run(`
          INSERT OR IGNORE INTO attendance (
            id, employee_id, tanggal, jam_masuk, jam_pulang, foto_masuk, foto_pulang,
            latitude_masuk, longitude_masuk, latitude_pulang, longitude_pulang,
            jarak_dari_kantor, status_validasi_lokasi, status, metode_kerja, device_info, created_at, updated_at
          ) VALUES (
            '${attId}', '${item.emp}', '${entry.date}', '${hour}', '16:05:00',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            -2.069270, 101.403220, -2.069270, 101.403220,
            14.2, 'valid', '${status}', '${item.method}', 'Web/Mobile Client', '${entry.date}T07:30:00Z', '${entry.date}T16:05:00Z'
          );
        `);
      });
    });
  }

  // Seed initial audit log
  db.run(`
    INSERT OR IGNORE INTO audit_logs (
      id, user_id, username, action, module, old_value, new_value, ip_address, timestamp
    ) VALUES (
      'log_seed_init', 'usr_admin_1', 'admin', 'INITIALIZE_SYSTEM', 'CORE',
      NULL, 'Inisialisasi sistem absensi & cuti pegawai KPU Kota Sungai Penuh', '127.0.0.1', '${now}'
    );
  `);

  // Seed notifications
  db.run(`
    INSERT OR IGNORE INTO notifications (
      id, user_id, title, message, type, is_read, created_at
    ) VALUES 
    ('notif_admin_new_leave', 'usr_admin_1', 'Pengajuan Cuti Baru', 'Ahmad Fauzi, S.H. mengajukan Cuti Tahunan untuk tanggal ${todayStr}', 'info', 0, '${now}'),
    ('notif_pegawai_welcome', 'usr_budi', 'Selamat Datang', 'Selamat datang di Sistem Absensi & Cuti Pegawai KPU Kota Sungai Penuh', 'success', 0, '${now}');
  `);

  console.log('Seeding completed successfully!');
}
