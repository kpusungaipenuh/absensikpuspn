import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Holiday, LeaveRequest } from '../../types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  Building2,
  Info
} from 'lucide-react';

export const KalenderCuti: React.FC = () => {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);
  const [selectedDayInfo, setSelectedDayInfo] = useState<{
    dateStr: string;
    holiday?: Holiday;
    leaves: LeaveRequest[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const [holRes, leaveRes] = await Promise.all([
        api.getHolidays(),
        api.getLeaveCalendar(currentDate.getFullYear())
      ]);
      setHolidays(holRes.holidays || []);
      setApprovedLeaves((leaveRes.events as any[]) || []);
    } catch (e) {
      console.error('Error fetching calendar data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayInfo(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayInfo(null);
  };

  // Calendar math
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d);
  }

  const getDateStr = (day: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  const isHoliday = (dateStr: string) => {
    return holidays.find(h => h.tanggal === dateStr);
  };

  const getLeavesForDate = (dateStr: string) => {
    return approvedLeaves.filter(
      l => dateStr >= l.tanggal_mulai && dateStr <= l.tanggal_selesai
    );
  };

  const handleSelectDay = (day: number) => {
    const dateStr = getDateStr(day);
    const holiday = isHoliday(dateStr);
    const leaves = getLeavesForDate(dateStr);
    setSelectedDayInfo({
      dateStr,
      holiday,
      leaves
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Kalender Cuti Bersama & Libur Kerja KPU
          </h2>
          <p className="text-xs text-slate-500">
            Jadwal hari libur resmi dan monitoring cuti rekan kerja untuk koordinasi piket kantor
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={prevMonth}
              className="p-1 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700" />
            </button>
            <span className="font-bold text-slate-900 px-2">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </button>
          </div>

          <button
            onClick={fetchCalendarData}
            className="p-2 text-slate-600 hover:text-red-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Calendar & Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 cols) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs mb-2">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, idx) => (
              <div
                key={d}
                className={`py-2 rounded-lg ${
                  idx === 0 ? 'text-red-600 bg-red-50/50' : 'text-slate-600'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1.5">
            {daysArray.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-20 sm:h-24 bg-slate-50/40 rounded-xl" />;
              }

              const dateStr = getDateStr(day);
              const holiday = isHoliday(dateStr);
              const leaves = getLeavesForDate(dateStr);
              const isSunday = (idx % 7) === 0;
              const isSelected = selectedDayInfo?.dateStr === dateStr;

              return (
                <div
                  key={day}
                  onClick={() => handleSelectDay(day)}
                  className={`h-20 sm:h-24 p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'ring-2 ring-red-600 border-red-600 bg-red-50/20'
                      : holiday
                      ? 'border-red-200 bg-red-50/40 hover:border-red-300'
                      : isSunday
                      ? 'border-slate-200 bg-slate-50/60'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        holiday || isSunday ? 'text-red-600' : 'text-slate-800'
                      }`}
                    >
                      {day}
                    </span>
                    {holiday && (
                      <span className="w-2 h-2 rounded-full bg-red-600" title={holiday.nama} />
                    )}
                  </div>

                  <div className="space-y-1 overflow-hidden">
                    {holiday && (
                      <div className="text-[9px] font-semibold text-red-700 truncate leading-tight bg-red-100/70 px-1 py-0.5 rounded">
                        {holiday.nama}
                      </div>
                    )}
                    {leaves.length > 0 && (
                      <div className="text-[9px] font-semibold text-indigo-700 truncate leading-tight bg-indigo-50 px-1 py-0.5 rounded border border-indigo-100">
                        {leaves.length} Cuti
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Day Inspector & Upcoming Holidays */}
        <div className="space-y-4">
          {selectedDayInfo ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Rincian Tanggal
                </span>
                <span className="text-xs font-mono font-bold text-red-700">
                  {selectedDayInfo.dateStr}
                </span>
              </div>

              {selectedDayInfo.holiday ? (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <span className="text-[10px] font-bold text-red-700 uppercase block">
                    Hari Libur Resmi:
                  </span>
                  <span className="text-sm font-bold text-red-900 block mt-0.5">
                    {selectedDayInfo.holiday.nama}
                  </span>
                  {selectedDayInfo.holiday.is_cuti_bersama === 1 && (
                    <span className="text-[10px] text-amber-700 font-semibold mt-1 block">
                      * Termasuk Cuti Bersama Nasional
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">Bukan merupakan hari libur nasional.</div>
              )}

              <div>
                <span className="text-xs font-bold text-slate-800 block mb-2">
                  Pegawai Sedang Cuti ({selectedDayInfo.leaves.length}):
                </span>
                {selectedDayInfo.leaves.length === 0 ? (
                  <p className="text-xs text-slate-400">Tidak ada pegawai yang cuti pada tanggal ini.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayInfo.leaves.map(l => (
                      <div
                        key={l.id}
                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs"
                      >
                        <div className="font-semibold text-slate-900">{l.nama_lengkap}</div>
                        <div className="text-[11px] text-slate-500">
                          {l.jenis_cuti} | {l.unit_kerja}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs text-center text-xs text-slate-400 py-10">
              <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <span>Klik salah satu tanggal pada kalender untuk melihat rincian libur dan pegawai yang sedang cuti.</span>
            </div>
          )}

          {/* Daftar Libur Bulan Ini */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Libur Resmi Tahun Ini
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
              {holidays.map(h => (
                <div
                  key={h.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <span className="font-medium text-slate-800">{h.nama}</span>
                  <span className="font-mono text-slate-500 text-[11px]">{h.tanggal}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
