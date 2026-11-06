/**
 * Date and Time utilities for KPU Kota Sungai Penuh (Asia/Jakarta / WIB - UTC+7)
 */

export function getWibDateStr(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  } catch {
    const d = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  }
}

export function getWibTimeStr(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    return formatter.format(date);
  } catch {
    const d = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return d.toISOString().split('T')[1].substring(0, 8);
  }
}

export function getWibYearMonth(date: Date = new Date()): { year: number; month: number } {
  const dateStr = getWibDateStr(date);
  const [y, m] = dateStr.split('-').map(Number);
  return { year: y, month: m };
}
