export interface OfficerInfo {
  nama: string;
  nip: string;
  jabatan: string;
  sub_bagian?: string;
}

/**
 * Atasan Langsung Sekretaris KPU Kota Sungai Penuh:
 * Nama : H. Khoirul Bahri Lubis, S.Sos.,M.H.
 * NIP : 196801201989081001
 * Jabatan : Sekretaris KPU Provinsi Jambi
 */
export const ATASAN_SEKRETARIS_KPU_KOTA: OfficerInfo = {
  nama: 'H. Khoirul Bahri Lubis, S.Sos.,M.H.',
  nip: '196801201989081001',
  jabatan: 'Sekretaris KPU Provinsi Jambi'
};

/**
 * Sekretaris KPU Kota Sungai Penuh:
 * Nama : Hj. Dewi Aprida, S.E.,M.Si.
 * NIP : 19701005 200701 2 003
 * Jabatan : Sekretaris KPU Kota Sungai Penuh
 */
export const SEKRETARIS_KPU_KOTA: OfficerInfo = {
  nama: 'Hj. Dewi Aprida, S.E.,M.Si.',
  nip: '19701005 200701 2 003',
  jabatan: 'Sekretaris KPU Kota Sungai Penuh'
};

/**
 * Kepala Sub Bagian / Plt. Kepala Sub Bagian Resmi KPU Kota Sungai Penuh
 */
export const KASUBBAG_DEFAULTS: Record<string, OfficerInfo> = {
  keuangan: {
    nama: 'Syamsul Ardi, S.E.',
    nip: '197307092007011003',
    jabatan: 'Kepala Sub Bagian Keuangan, Umum Dan Logistik',
    sub_bagian: 'Keuangan, Umum Dan Logistik'
  },
  teknis: {
    nama: 'Aka Juaini, S.H.',
    nip: '198104042009121002',
    jabatan: 'Plt. Kepala Sub Bagian Teknis Penyelenggaraan Pemilu Dan Hukum',
    sub_bagian: 'Teknis Penyelenggaraan Pemilu Dan Hukum'
  },
  partisipasi: {
    nama: 'Utammimi, S.H.',
    nip: '198103132009011013',
    jabatan: 'Plt. Kepala Sub Bagian Partisipasi, Hubungan Masyarakat, dan Sumber Daya Manusia',
    sub_bagian: 'Partisipasi, Hubungan Masyarakat, dan Sumber Daya Manusia'
  },
  perencanaan: {
    nama: 'Ade Citra, S.Sos, M.M.',
    nip: '198702182014021003',
    jabatan: 'Kepala Sub Bagian Perencanaan, Data Dan Informasi',
    sub_bagian: 'Perencanaan, Data Dan Informasi'
  }
};

export interface ResolvedLeaveHierarchy {
  atasanLangsung: OfficerInfo;
  pejabatBerwenang: OfficerInfo;
  kepadaYth: string;
  kotaTujuan: string;
  isSekretaris: boolean;
  isKasubbag: boolean;
}

/**
 * Menyelesaikan hierarki surat cuti sesuai ketentuan resmi:
 * 1. Atasan langsung staf = Kepala Sub Bagian atau Plt. Kepala Sub Bagian masing-masing.
 * 2. Khusus Kasubbag & Plt. Kasubbag = Atasan langsungnya Sekretaris KPU Kota Sungai Penuh.
 * 3. Khusus Sekretaris KPU Kota Sungai Penuh = Atasan langsungnya H. Khoirul Bahri Lubis, S.Sos.,M.H. (Sekretaris KPU Provinsi Jambi).
 */
export function resolveLeaveHierarchy(
  emp?: {
    nama_lengkap?: string;
    jabatan?: string;
    sub_bagian?: string;
    unit_kerja?: string;
    nip_nik?: string;
  } | null,
  allEmployees?: Array<{
    nama_lengkap: string;
    jabatan: string;
    sub_bagian?: string;
    unit_kerja?: string;
    nip_nik: string;
  }>
): ResolvedLeaveHierarchy {
  const jab = (emp?.jabatan || '').toLowerCase();
  const nama = (emp?.nama_lengkap || '').toLowerCase();
  const subBag = (emp?.sub_bagian || emp?.unit_kerja || '').toLowerCase();

  // 1. Cek apakah pemohon adalah Sekretaris KPU Kota Sungai Penuh
  const isSekretaris =
    (jab.includes('sekretaris kpu') && !jab.includes('staf') && !jab.includes('pelaksana')) ||
    subBag === 'sekretaris' ||
    nama.includes('dewi aprida');

  if (isSekretaris) {
    return {
      atasanLangsung: ATASAN_SEKRETARIS_KPU_KOTA,
      pejabatBerwenang: ATASAN_SEKRETARIS_KPU_KOTA,
      kepadaYth: 'Sekretaris KPU Provinsi Jambi',
      kotaTujuan: 'Jambi',
      isSekretaris: true,
      isKasubbag: false
    };
  }

  // 2. Cek apakah pemohon adalah Kepala Sub Bagian atau Plt. Kasubbag
  const isKasubbag =
    jab.includes('kepala sub') ||
    jab.includes('kasubbag') ||
    jab.includes('plt. kepala sub') ||
    jab.includes('plt. kasubbag');

  if (isKasubbag) {
    // Atasan langsung Kasubbag adalah Sekretaris KPU Kota Sungai Penuh
    return {
      atasanLangsung: SEKRETARIS_KPU_KOTA,
      pejabatBerwenang: SEKRETARIS_KPU_KOTA,
      kepadaYth: 'Sekretaris KPU Kota Sungai Penuh',
      kotaTujuan: 'Sungai Penuh',
      isSekretaris: false,
      isKasubbag: true
    };
  }

  // 3. Staf / Pelaksana Biasa: Atasan langsung adalah Kasubbag / Plt. Kasubbag subbagian masing-masing
  // Cari secara dinamis dari database list jika ada
  let matchingKasubbag: OfficerInfo | null = null;

  if (allEmployees && allEmployees.length > 0) {
    const found = allEmployees.find(e => {
      const eSub = (e.sub_bagian || e.unit_kerja || '').toLowerCase();
      const eJab = (e.jabatan || '').toLowerCase();
      const sameSub = eSub === subBag || (subBag.length > 3 && eSub.includes(subBag.slice(0, 5)));
      const isLeader = eJab.includes('kepala sub') || eJab.includes('kasubbag') || eJab.includes('plt. kepala sub');
      return sameSub && isLeader;
    });

    if (found) {
      matchingKasubbag = {
        nama: found.nama_lengkap,
        nip: found.nip_nik,
        jabatan: found.jabatan,
        sub_bagian: found.sub_bagian || found.unit_kerja
      };
    }
  }

  if (!matchingKasubbag) {
    if (subBag.includes('keuangan') || subBag.includes('umum') || subBag.includes('logistik')) {
      matchingKasubbag = KASUBBAG_DEFAULTS.keuangan;
    } else if (subBag.includes('teknis') || subBag.includes('hukum')) {
      matchingKasubbag = KASUBBAG_DEFAULTS.teknis;
    } else if (subBag.includes('partisipasi') || subBag.includes('hubmas') || subBag.includes('sdm')) {
      matchingKasubbag = KASUBBAG_DEFAULTS.partisipasi;
    } else if (subBag.includes('perencanaan') || subBag.includes('data') || subBag.includes('informasi')) {
      matchingKasubbag = KASUBBAG_DEFAULTS.perencanaan;
    } else {
      matchingKasubbag = KASUBBAG_DEFAULTS.keuangan;
    }
  }

  return {
    atasanLangsung: matchingKasubbag,
    pejabatBerwenang: SEKRETARIS_KPU_KOTA,
    kepadaYth: 'Sekretaris KPU Kota Sungai Penuh',
    kotaTujuan: 'Sungai Penuh',
    isSekretaris: false,
    isKasubbag: false
  };
}
