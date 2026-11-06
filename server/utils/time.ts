/**
 * Time utility for KPU Kota Sungai Penuh (WIB - Waktu Indonesia Barat / UTC+7)
 */

export interface WibDateTime {
  todayStr: string;      // YYYY-MM-DD
  timeStr: string;       // HH:mm:ss
  hour: number;
  minute: number;
  second: number;
  totalMinutes: number;  // hour * 60 + minute
  dayOfWeek: number;     // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isoStr: string;
}

export function getWibDateTime(dateInput: Date = new Date()): WibDateTime {
  const formatterDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr = formatterDate.format(dateInput);

  const formatterTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const timeStr = formatterTime.format(dateInput);

  // Day of week in WIB (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const [year, month, day] = todayStr.split('-').map(Number);
  const wibDayDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = wibDayDate.getUTCDay();

  const [hour, minute, second] = timeStr.split(':').map(Number);

  return {
    todayStr,
    timeStr,
    hour: hour || 0,
    minute: minute || 0,
    second: second || 0,
    totalMinutes: (hour || 0) * 60 + (minute || 0),
    dayOfWeek,
    isoStr: dateInput.toISOString()
  };
}

export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return h * 60 + m;
}

export function minutesToTimeStr(totalMinutes: number): string {
  const normalized = Math.max(0, totalMinutes);
  const hours = Math.floor(normalized / 60) % 24;
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
}

export function formatTimeShort(timeStr?: string | null): string {
  if (!timeStr) return '-';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return timeStr;
}
