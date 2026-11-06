import { useState, useEffect } from 'react';
import { api } from '../services/api';

export const DEFAULT_SUB_BAGIAN = [
  'Sekretaris',
  'Keuangan, Umum Dan Logistik',
  'Teknis Penyelenggaraan Pemilu Dan Hukum',
  'Partisipasi, Hubungan Masyarakat, dan Sumber Daya Manusia',
  'Perencanaan, Data Dan Informasi'
];

export function useSubBagianList() {
  const [subBagianList, setSubBagianList] = useState<string[]>(DEFAULT_SUB_BAGIAN);

  useEffect(() => {
    let isMounted = true;
    api.getSubBagianList()
      .then(res => {
        if (isMounted && res.sub_bagian && res.sub_bagian.length > 0) {
          setSubBagianList(res.sub_bagian);
        }
      })
      .catch(() => {
        // keep fallback
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return subBagianList;
}
