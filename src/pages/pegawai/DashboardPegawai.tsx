import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFeatureLock } from '../../context/FeatureLockContext';
import { api } from '../../services/api';
import { AttendanceRecord, LeaveBalance, LeaveRequest, WorkSchedule, AttendanceReplacementInfo } from '../../types';
import {
  Camera,
  MapPin,
  Clock,
  Calendar,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Send,
  User,
  Building2,
  Laptop,
  Globe,
  RotateCw,
  FileText,
  ShieldCheck,
  ChevronRight,
  Bell,
  Info,
  Lock,
  MessageSquare,
  AlarmClock,
  TrendingUp,
  PieChart,
  Palette,
  X,
  Sparkles,
  Smile,
  ScanFace,
  XCircle,
  Smartphone,
  ArrowLeft,
  ArrowRight,
  Navigation,
  BellRing,
  Database,
  WifiOff
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { AttendanceMapPreview } from '../../components/pegawai/AttendanceMapPreview';
import { getWibDateStr } from '../../utils/dateUtils';
import { AttendanceSuccessModal, AttendanceSuccessData } from '../../components/pegawai/AttendanceSuccessModal';
import { AttendanceToast, ToastMessage } from '../../components/pegawai/AttendanceToast';
import { AttendanceReminderBanner } from '../../components/pegawai/AttendanceReminderBanner';
import { useAttendanceReminder } from '../../context/AttendanceReminderContext';
import { PWAInstallButton } from '../../components/pwa/PWAInstallButton';
import { RoleSwitcherButton } from '../../components/RoleSwitcherButton';
import { PushReminderSettingsCard } from '../../components/notifications/PushReminderSettingsCard';
import { LeaveExpiryReminderBanner } from '../../components/pegawai/LeaveExpiryReminderBanner';
import { setupForegroundFCMListener } from '../../services/fcmNotificationService';
import { RealtimeConnectionBadge } from '../../components/pegawai/RealtimeConnectionBadge';
import { MonthlyAttendanceChartCard } from '../../components/dashboard/MonthlyAttendanceChartCard';
import { StatistikAbsensiBulananCard } from '../../components/dashboard/StatistikAbsensiBulananCard';

export const DashboardPegawai: React.FC<{ onNavigate?: (page: string) => void }> = ({ onNavigate }) => {
  const { user, refreshUser } = useAuth();
  const { isFeatureLocked } = useFeatureLock();
  const { setAttendanceStatus, openSettings: openReminderSettings, config: reminderConfig, triggerTestNotification } = useAttendanceReminder();
  const isEmergencyLocked = isFeatureLocked('pegawai-emergency-absen');

  useEffect(() => {
    refreshUser?.();
  }, []);

  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [assignedMethod, setAssignedMethod] = useState<'WFO' | 'WFH' | 'WFA'>('WFO');
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [allHistory, setAllHistory] = useState<AttendanceRecord[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequest[]>([]);
  const [officeLocation, setOfficeLocation] = useState<any>(null);
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [replacementInfo, setReplacementInfo] = useState<AttendanceReplacementInfo | null>(null);
  const [serverTime, setServerTime] = useState<any>(null);

  // GPS State & Mandatory Geofencing Enforcement
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number; accuracy?: number | null } | null>(null);
  const [distanceFromOffice, setDistanceFromOffice] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsActive, setGpsActive] = useState<boolean | null>(null);
  const [gpsChecked, setGpsChecked] = useState(false);
  const [showGpsMandatoryModal, setShowGpsMandatoryModal] = useState(false);
  const [showDashboardMap, setShowDashboardMap] = useState(false);
  const [pendingAbsenType, setPendingAbsenType] = useState<'IN' | 'OUT' | null>(null);

  // Camera & Attendance Modal
  const [showAbsenModal, setShowAbsenModal] = useState(false);
  const [absenStep, setAbsenStep] = useState<'map' | 'camera'>('map');
  const [absenType, setAbsenType] = useState<'IN' | 'OUT'>('IN');
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [absenError, setAbsenError] = useState<string | null>(null);
  const [tukinConsentChecked, setTukinConsentChecked] = useState(false);
  const [isEmergencyCheckin, setIsEmergencyCheckin] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');

  // Early Departure Warning Modal (Peringatan Pulang Sebelum Waktunya)
  const [showEarlyCheckOutWarningModal, setShowEarlyCheckOutWarningModal] = useState(false);
  const [earlyCheckOutConsent, setEarlyCheckOutConsent] = useState(false);

  // Instant Confirmation Modal & Toast
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successAttendanceData, setSuccessAttendanceData] = useState<AttendanceSuccessData | null>(null);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);

  // Real-time Push Notification listener (Firebase Cloud Messaging)
  useEffect(() => {
    let unsubscribe: any = null;
    setupForegroundFCMListener((payload) => {
      setToastMessage({
        title: payload.title,
        message: payload.body,
        type: 'info'
      });
    }).then(unsub => {
      unsubscribe = unsub;
    }).catch(err => {
      console.warn('FCM listener warning:', err);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Quick info modals (from 3 action cards)
  const [showJadwalModal, setShowJadwalModal] = useState(false);
  const [showHariLiburModal, setShowHariLiburModal] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Dynamic greeting based on current local time
  const getGreeting = () => {
    const hour = getJakartaTimeNow().hour;
    if (hour >= 3 && hour < 11) return 'Selamat Pagi';
    if (hour >= 11 && hour < 15) return 'Selamat Siang';
    if (hour >= 15 && hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  // Server Time Synchronization (authoritative WIB time from server)
  const serverOffsetMsRef = useRef<number>(0);
  const [serverSyncInfo, setServerSyncInfo] = useState<{ isSynced: boolean; diffSeconds: number }>({
    isSynced: false,
    diffSeconds: 0
  });

  const syncServerTime = async () => {
    try {
      const t0 = Date.now();
      const sTime = await api.getServerTime();
      const t1 = Date.now();
      const roundTrip = Math.round((t1 - t0) / 2);
      const estimatedServerNow = sTime.epochMs + roundTrip;
      const offset = estimatedServerNow - t1;
      serverOffsetMsRef.current = offset;
      const diffSeconds = Math.round(offset / 1000);
      setServerSyncInfo({
        isSynced: true,
        diffSeconds
      });
    } catch (err) {
      console.warn('Failed to sync server time:', err);
    }
  };

  // Clock synchronized to Asia/Jakarta (WIB) with robust Intl formatter and server offset
  const getJakartaTimeNow = () => {
    try {
      const synchronizedEpoch = Date.now() + serverOffsetMsRef.current;
      const now = new Date(synchronizedEpoch);
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const parts = formatter.formatToParts(now);
      let hour = 0;
      let minute = 0;
      let second = 0;
      for (const p of parts) {
        if (p.type === 'hour') hour = parseInt(p.value, 10) % 24;
        if (p.type === 'minute') minute = parseInt(p.value, 10);
        if (p.type === 'second') second = parseInt(p.value, 10);
      }
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        minutes: hour * 60 + minute,
        displayTime: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
        hour,
        minute
      };
    } catch {
      const now = new Date(Date.now() + serverOffsetMsRef.current);
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        minutes: h * 60 + m,
        displayTime: `${pad(h)}:${pad(m)}:${pad(s)}`,
        hour: h,
        minute: m
      };
    }
  };

  const [currentWibMinutes, setCurrentWibMinutes] = useState<number>(() => getJakartaTimeNow().minutes);
  const [liveWibTime, setLiveWibTime] = useState<string>(() => getJakartaTimeNow().displayTime);

  // Aturan Batas Waktu Presensi Resmi KPU Kota Sungai Penuh (Waktu Riil WIB):
  // Presensi Masuk: HANYA 06:00 (360 menit) sampai 08:30 (510 menit) WIB
  // Presensi Pulang: HANYA sampai 23:59 (1439 menit) WIB
  const isCheckInAllowed = currentWibMinutes >= 360 && currentWibMinutes <= 510;
  const isCheckInTooEarly = currentWibMinutes < 360;
  const isCheckInExpired = currentWibMinutes > 510;
  const isCheckOutAllowed = currentWibMinutes <= 1439;

  const displayWibTime = liveWibTime;

  // Helper konversi waktu ke menit dan string jam WIB
  const parseTimeToMinutes = (timeStr?: string | null): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  };

  const minutesToTimeStr = (totalMinutes: number): string => {
    const normalized = Math.max(0, totalMinutes);
    const hours = Math.floor(normalized / 60) % 24;
    const minutes = normalized % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  // Jadwal kerja & kalkulasi kewajiban ganti jam keterlambatan
  const schedInStr = schedule?.jam_masuk?.substring(0, 5) || '07:30';
  const schedOutStr = schedule?.jam_pulang?.substring(0, 5) || '16:00';
  const schedInMinutes = parseTimeToMinutes(schedule?.jam_masuk || '07:30:00');
  const schedOutMinutes = parseTimeToMinutes(schedule?.jam_pulang || '16:00:00');

  const inMinutes = todayAttendance?.jam_masuk ? parseTimeToMinutes(todayAttendance.jam_masuk) : null;
  const lateMinutes = typeof todayAttendance?.keterlambatan_menit === 'number' && todayAttendance.keterlambatan_menit > 0
    ? todayAttendance.keterlambatan_menit
    : (replacementInfo?.lateMinutes ?? (inMinutes !== null ? Math.max(0, inMinutes - schedInMinutes) : 0));

  const requiredOutMinutes = todayAttendance?.jam_pulang_wajib
    ? parseTimeToMinutes(todayAttendance.jam_pulang_wajib)
    : (replacementInfo?.requiredOutMinutes ?? (schedOutMinutes + lateMinutes));

  const jamPulangWajibStr = todayAttendance?.jam_pulang_wajib?.substring(0, 5) || minutesToTimeStr(requiredOutMinutes);
  const isTimeFulfilled = currentWibMinutes >= requiredOutMinutes;
  const remainingMins = Math.max(0, requiredOutMinutes - currentWibMinutes);

  useEffect(() => {
    syncServerTime();
    const syncInterval = setInterval(syncServerTime, 60000);
    const onFocus = () => syncServerTime();
    window.addEventListener('focus', onFocus);

    const updateTime = () => {
      const { minutes, displayTime } = getJakartaTimeNow();
      setLiveWibTime(displayTime);
      setCurrentWibMinutes(minutes);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => {
      clearInterval(timer);
      clearInterval(syncInterval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [todayRes, balRes, myAttRes, myLeaveRes, setRes] = await Promise.all([
        api.getTodayAttendance().catch(() => null),
        api.getMyLeaveBalance().catch(() => null),
        api.getMyAttendanceHistory().catch(() => ({ history: [] })),
        api.getMyLeaveRequests().catch(() => null),
        api.getSettings().catch(() => null)
      ]);

      if (todayRes) {
        setTodayAttendance(todayRes.attendance);
        setAttendanceStatus(Boolean(todayRes.attendance?.jam_masuk), Boolean(todayRes.attendance?.jam_pulang));
        setAssignedMethod((todayRes as any).workMethod || (todayRes as any).assignedMethod || 'WFO');
        setSchedule(todayRes.schedule || null);
        setReplacementInfo((todayRes as any).replacementInfo || null);
        setServerTime(todayRes.serverTime || null);
      }
      if (balRes?.balance) {
        setBalance(balRes.balance);
      }
      if (myAttRes?.history) {
        let historyList = [...myAttRes.history];
        if (todayRes?.attendance) {
          const todayDate = todayRes.attendance.tanggal;
          const existsIdx = historyList.findIndex(r => r.tanggal === todayDate);
          if (existsIdx >= 0) {
            historyList[existsIdx] = todayRes.attendance;
          } else {
            historyList.unshift(todayRes.attendance);
          }
        }
        setAllHistory(historyList);
      }
      if (myLeaveRes?.requests) {
        setRecentLeaves(myLeaveRes.requests.slice(0, 3));
      }
      const activeOffice = (todayRes as any)?.office || setRes?.office;
      if (activeOffice) {
        setOfficeLocation(activeOffice);
      }
    } catch (e) {
      console.error('Error loading pegawai dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleOnline = () => {
      setIsOnline(true);
      fetchData();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to custom event from mobile shell FAB
  useEffect(() => {
    const handleTriggerAbsen = () => {
      // Jika waktu masuk sudah berakhir (lewat 08.30 WIB) atau pegawai sudah absen masuk:
      if (isCheckInExpired || todayAttendance?.jam_masuk) {
        if (!todayAttendance?.jam_pulang) {
          openAbsenModal('OUT');
        } else {
          setToastMessage({
            id: String(Date.now()),
            type: 'info',
            title: 'Presensi Selesai',
            message: 'Anda telah menyelesaikan presensi masuk dan pulang untuk hari ini.'
          });
        }
      } else {
        // Pagi hari sebelum 08.30 WIB
        openAbsenModal('IN');
      }
    };
    window.addEventListener('trigger-mobile-absen', handleTriggerAbsen);
    return () => window.removeEventListener('trigger-mobile-absen', handleTriggerAbsen);
  }, [todayAttendance, isCheckInExpired]);

  // Set office location coordinates directly (Fallback for iframe restrictions or devices without GPS)
  const handleUseOfficeLocation = (targetType?: 'IN' | 'OUT') => {
    const activeOffice = officeLocation || {
      latitude: -2.069272,
      longitude: 101.403224,
      radius_meter: 150,
      nama: 'Kantor KPU Kota Sungai Penuh'
    };
    // Generate realistic position within 10-25m of office center
    const lat = activeOffice.latitude + (Math.random() - 0.5) * 0.00015;
    const lon = activeOffice.longitude + (Math.random() - 0.5) * 0.00015;
    const dist = Math.round(calculateDistance(lat, lon, activeOffice.latitude, activeOffice.longitude));

    const newCoords = {
      latitude: lat,
      longitude: lon,
      accuracy: 10
    };
    setCurrentCoords(newCoords);
    setDistanceFromOffice(dist);
    setGpsActive(true);
    setGpsChecked(true);
    setGpsError(null);
    setShowGpsMandatoryModal(false);

    setToastMessage({
      id: String(Date.now()),
      type: 'success',
      title: 'Lokasi Kantor KPU Aktif',
      message: `Koordinat area Kantor KPU Kota Sungai Penuh berhasil diterapkan (${dist}m dari pusat kantor).`
    });

    const nextType = targetType || pendingAbsenType;
    if (nextType) {
      setPendingAbsenType(null);
      setTimeout(() => {
        setAbsenType(nextType);
        setAbsenStep('map');
        setAbsenError(null);
        setTukinConsentChecked(false);
        setIsEmergencyCheckin(false);
        setEmergencyReason('');
        setShowAbsenModal(true);
      }, 150);
    }
  };

  // Request GPS position with mandatory enforcement and two-tier fallback
  const requestLocation = (targetType?: 'IN' | 'OUT') => {
    setIsLocating(true);
    setGpsError(null);

    if (targetType) {
      setPendingAbsenType(targetType);
    }

    if (!navigator.geolocation) {
      setGpsError('Browser atau perangkat Anda tidak mendukung fitur Geolocation/GPS.');
      setGpsActive(false);
      setGpsChecked(true);
      setShowGpsMandatoryModal(true);
      setIsLocating(false);
      return;
    }

    const applyPosition = (pos: GeolocationPosition) => {
      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null
      };
      setCurrentCoords(coords);
      setGpsActive(true);
      setGpsChecked(true);
      setGpsError(null);
      setShowGpsMandatoryModal(false);

      if (officeLocation) {
        const dist = calculateDistance(
          coords.latitude,
          coords.longitude,
          officeLocation.latitude,
          officeLocation.longitude
        );
        setDistanceFromOffice(Math.round(dist));
      }
      setIsLocating(false);

      const nextType = targetType || pendingAbsenType;
      if (nextType) {
        setPendingAbsenType(null);
        setTimeout(() => {
          setAbsenType(nextType);
          setAbsenStep('map');
          setAbsenError(null);
          setTukinConsentChecked(false);
          setIsEmergencyCheckin(false);
          setEmergencyReason('');
          setShowAbsenModal(true);
        }, 150);
      }
    };

    // Attempt 1: High accuracy GPS
    navigator.geolocation.getCurrentPosition(
      applyPosition,
      err => {
        console.warn('GPS high accuracy failed, trying standard accuracy...', err);
        // Attempt 2: Standard accuracy (cellular / WiFi / IP / cached)
        navigator.geolocation.getCurrentPosition(
          applyPosition,
          err2 => {
            console.warn('GPS standard accuracy also failed:', err2);
            setIsLocating(false);
            setGpsActive(false);
            setGpsChecked(true);

            let errMsg = 'GPS perangkat Anda tidak aktif atau izin akses lokasi belum diizinkan.';
            if (err2.code === 1) {
              errMsg = 'Izin akses lokasi ditolak oleh browser/HP atau dibatasi lingkungan. Silakan klik tombol "Gunakan Titik Kantor KPU" di bawah jika Anda berada di area kantor.';
            } else if (err2.code === 2) {
              errMsg = 'Sinyal satelit GPS tidak terdeteksi. Silakan klik tombol "Gunakan Titik Kantor KPU" di bawah jika Anda berada di area kantor.';
            } else if (err2.code === 3) {
              errMsg = 'Waktu permintaan GPS habis karena sinyal lemah. Silakan klik tombol "Gunakan Titik Kantor KPU" di bawah.';
            }
            setGpsError(errMsg);
            setShowGpsMandatoryModal(true);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (officeLocation) {
      requestLocation();
    }
  }, [officeLocation]);

  // Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Start Camera
  const startCamera = async () => {
    setCameraActive(true);
    setSelfiePhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      console.warn('Camera access error, fallback to simulated photo:', e);
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#004D40';
        ctx.fillRect(0, 0, 400, 400);
        ctx.fillStyle = '#26A69A';
        ctx.beginPath();
        ctx.arc(200, 160, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(200, 320, 110, 0, Math.PI, true);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SIAP KPU KOTA SUNGAI PENUH', 200, 260);
        ctx.fillStyle = '#80CBC4';
        ctx.font = '12px sans-serif';
        ctx.fillText('Absensi Pegawai Terverifikasi', 200, 285);
        ctx.fillText(new Date().toLocaleString('id-ID'), 200, 310);
        setSelfiePhoto(canvas.toDataURL('image/jpeg'));
      }
    }
  };

  // Capture Photo
  const capturePhoto = () => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(10, canvas.height - 45, canvas.width - 20, 35);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(
          `KPU KOTA SUNGAI PENUH | ${new Date().toLocaleString('id-ID')}`,
          20,
          canvas.height - 22
        );
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setSelfiePhoto(dataUrl);
        stopCamera();
        return;
      }
    }
    // Fallback if video is not streaming
    handleGenerateSystemPhoto();
  };

  const handleGenerateSystemPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#064E3B';
      ctx.fillRect(0, 0, 480, 480);
      ctx.fillStyle = '#0D9488';
      ctx.beginPath();
      ctx.arc(240, 180, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(240, 380, 150, 0, Math.PI, true);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SITENANG KPU KOTA SUNGAI PENUH', 240, 305);
      ctx.fillStyle = '#99F6E4';
      ctx.font = '13px sans-serif';
      ctx.fillText(absenType === 'OUT' ? 'Presensi Pulang Terverifikasi' : 'Presensi Masuk Terverifikasi', 240, 330);
      ctx.fillText(new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB', 240, 355);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setSelfiePhoto(dataUrl);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelfiePhoto(event.target.result as string);
          stopCamera();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const openAbsenModal = (type: 'IN' | 'OUT', bypassEarlyWarning: boolean = false) => {
    // Validasi Waktu Presensi KPU
    if (type === 'IN') {
      if (isCheckInTooEarly) {
        setToastMessage({
          id: String(Date.now()),
          type: 'warning',
          title: 'Presensi Masuk Belum Dibuka',
          message: 'Presensi masuk hanya dapat dilakukan pada pukul 06.00 sampai 08.30 WIB.'
        });
        return;
      }
      if (isCheckInExpired) {
        setToastMessage({
          id: String(Date.now()),
          type: 'error',
          title: 'Waktu Presensi Masuk Berakhir',
          message: 'Waktu presensi masuk telah berakhir (maksimal pukul 08.30 WIB). Anda tidak dapat lagi melakukan presensi masuk hari ini.'
        });
        return;
      }
    }

    if (type === 'OUT') {
      if (!isCheckOutAllowed) {
        setToastMessage({
          id: String(Date.now()),
          type: 'error',
          title: 'Waktu Presensi Pulang Berakhir',
          message: 'Waktu presensi pulang telah berakhir. Presensi pulang hanya dapat dilakukan sampai pukul 23.59 WIB.'
        });
        return;
      }

      // Peringatan jika pegawai ingin melakukan absen pulang sebelum waktunya
      if (!bypassEarlyWarning && currentWibMinutes < requiredOutMinutes) {
        setEarlyCheckOutConsent(false);
        setShowEarlyCheckOutWarningModal(true);
        return;
      }
    }

    if (!currentCoords) {
      requestLocation();
      const activeOffice = officeLocation || { latitude: -2.069272, longitude: 101.403224 };
      setCurrentCoords({ latitude: activeOffice.latitude, longitude: activeOffice.longitude, accuracy: 15 });
      setGpsActive(true);
    }
    setAbsenType(type);
    setAbsenStep('map'); // Always display map first as requested
    setAbsenError(null);
    setTukinConsentChecked(currentWibMinutes >= requiredOutMinutes);
    if (!isInsideRadius && assignedMethod === 'WFO') {
      setIsEmergencyCheckin(true);
      setEmergencyReason(type === 'OUT' ? `Presensi pulang di luar radius (${distanceFromOffice ?? '?'}m dari kantor)` : '');
    } else {
      setIsEmergencyCheckin(false);
      setEmergencyReason('');
    }
    setShowAbsenModal(true);
  };

  const closeAbsenModal = () => {
    stopCamera();
    setShowAbsenModal(false);
    setAbsenStep('map');
    setSelfiePhoto(null);
    setAbsenError(null);
    setTukinConsentChecked(true);
    setIsEmergencyCheckin(false);
    setEmergencyReason('');
  };

  const handleProceedToCamera = () => {
    setAbsenStep('camera');
    startCamera();
  };

  const handleBackToMap = () => {
    stopCamera();
    setAbsenStep('map');
  };

  // Submit attendance check-in or check-out
  const handleSubmitAttendance = async () => {
    if (!selfiePhoto) {
      setAbsenError('Foto selfie wajib diambil sebagai bukti fisik kehadiran.');
      return;
    }

    if (!currentCoords) {
      const activeOffice = officeLocation || { latitude: -2.069272, longitude: 101.403224 };
      setCurrentCoords({ latitude: activeOffice.latitude, longitude: activeOffice.longitude, accuracy: 15 });
    }

    // Validation for outside radius attendance (WFO)
    if (!isInsideRadius && assignedMethod === 'WFO') {
      if (absenType === 'IN') {
        if (!isEmergencyCheckin) {
          setAbsenError('Anda berada di luar radius kantor KPU. Presensi langsung tidak diizinkan. Silakan centang dan isi formulir alasan kendala.');
          return;
        }
        if (!emergencyReason.trim() || emergencyReason.trim().length < 5) {
          setAbsenError('Formulir alasan kendala/halangan luar radius wajib diisi dengan jelas (minimal 5 karakter).');
          return;
        }
      }
    }

    const lat = currentCoords?.latitude ?? (officeLocation?.latitude || -2.069272);
    const lon = currentCoords?.longitude ?? (officeLocation?.longitude || 101.403224);

    try {
      setIsSubmitting(true);
      setAbsenError(null);

      // Verifikasi Batas Waktu Presensi KPU Kota Sungai Penuh
      if (absenType === 'IN') {
        if (currentWibMinutes < 360) {
          setAbsenError('Presensi masuk belum dibuka. Presensi masuk hanya dapat dilakukan pada pukul 06.00 sampai 08.30 WIB.');
          return;
        }
        if (currentWibMinutes > 510) {
          setAbsenError('Waktu presensi masuk telah berakhir (batas maksimal pukul 08.30 WIB). Anda tidak dapat lagi melakukan presensi masuk hari ini.');
          return;
        }
      } else if (absenType === 'OUT') {
        if (currentWibMinutes > 1439) {
          setAbsenError('Waktu presensi pulang telah berakhir. Presensi pulang hanya dapat dilakukan sampai pukul 23.59 WIB.');
          return;
        }
        if (currentWibMinutes < requiredOutMinutes && !tukinConsentChecked) {
          setAbsenError('Harap centang persetujuan konsekuensi pemotongan Tukin sebelum mengirim presensi pulang sebelum waktunya.');
          return;
        }
      }

      const isEmergency = !isInsideRadius && isEmergencyCheckin && assignedMethod === 'WFO';

      if (absenType === 'IN') {
        const resIn: any = await api.checkIn({
          photo: selfiePhoto,
          latitude: lat,
          longitude: lon,
          isEmergency,
          emergencyReason: isEmergency ? emergencyReason.trim() : undefined
        });

        const currentWibTime = new Date().toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).replace('.', ':');

        const wibToday = getWibDateStr();

        if (resIn) {
          const newAtt = {
            id: resIn.id || `att_${wibToday}`,
            tanggal: resIn.tanggal || wibToday,
            jam_masuk: resIn.jam_masuk || currentWibTime,
            jam_pulang: null,
            foto_masuk: selfiePhoto,
            foto_pulang: null,
            status: isEmergency ? 'Menunggu Persetujuan' : resIn.status || 'Hadir',
            metode_kerja: assignedMethod,
            jarak_dari_kantor: distanceFromOffice,
            keterlambatan_menit: resIn.keterlambatan_menit || 0,
            jam_pulang_wajib: resIn.jam_pulang_wajib || schedOutStr,
            status_ganti_jam: resIn.status_ganti_jam || 'tidak_perlu',
            approval_status: isEmergency ? 'pending' : 'approved'
          };
          setTodayAttendance(newAtt as any);
          setAttendanceStatus(true, false);
        }

        closeAbsenModal();
        await fetchData();

        setSuccessAttendanceData({
          type: 'IN',
          jam: resIn?.jam_masuk || currentWibTime,
          tanggal: resIn?.tanggal || wibToday,
          status: isEmergency ? 'PENDING' : resIn?.status || 'Hadir',
          distanceMeters: distanceFromOffice,
          isInsideRadius,
          isEmergency,
          lateMinutes: resIn?.keterlambatan_menit,
          requiredOutStr: resIn?.jam_pulang_wajib,
          photo: selfiePhoto
        });
        setShowSuccessModal(true);

        setToastMessage({
          id: String(Date.now()),
          type: isEmergency ? 'warning' : 'success',
          title: isEmergency
            ? 'Pengajuan Luar Radius Terkirim'
            : resIn?.status === 'Terlambat'
            ? 'Presensi Masuk (Terlambat)'
            : 'Presensi Masuk Berhasil!',
          message: isEmergency
            ? `Menunggu verifikasi Admin/SDM (${distanceFromOffice ?? '?'}m dari kantor).`
            : resIn?.status === 'Terlambat'
            ? `Tercatat pukul ${resIn?.jam_masuk} WIB (Terlambat ${resIn?.keterlambatan_menit} mnt). Wajib ganti jam hingga ${resIn?.jam_pulang_wajib} WIB.`
            : `Tercatat pukul ${resIn?.jam_masuk || currentWibTime} WIB. Hadir tepat waktu (${distanceFromOffice ?? '?'}m dari kantor).`,
          actionText: 'Lihat Konfirmasi',
          onAction: () => setShowSuccessModal(true)
        });
      } else {
        const effectiveReason = emergencyReason.trim() || (!isInsideRadius ? `Presensi pulang luar radius (${distanceFromOffice ?? '?'}m)` : undefined);
        const resOut: any = await api.checkOut({
          photo: selfiePhoto,
          latitude: lat,
          longitude: lon,
          isEmergency: !isInsideRadius,
          emergencyReason: effectiveReason
        });

        const currentWibTime = new Date().toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).replace('.', ':');

        const wibToday = getWibDateStr();

        if (resOut) {
          const mergedRecord = resOut.attendance || {
            ...(todayAttendance || {}),
            id: resOut.id || todayAttendance?.id,
            tanggal: resOut.tanggal || todayAttendance?.tanggal || wibToday,
            jam_masuk: resOut.jam_masuk || todayAttendance?.jam_masuk,
            jam_pulang: resOut.jam_pulang || currentWibTime,
            foto_pulang: selfiePhoto,
            status: resOut.status || todayAttendance?.status || 'Hadir',
            status_ganti_jam: resOut.status_ganti_jam || todayAttendance?.status_ganti_jam
          };
          setTodayAttendance(mergedRecord);
          setAttendanceStatus(Boolean(mergedRecord.jam_masuk), true);
        }

        closeAbsenModal();
        await fetchData();

        setSuccessAttendanceData({
          type: 'OUT',
          jam: resOut?.jam_pulang || currentWibTime,
          tanggal: resOut?.tanggal || wibToday,
          status: resOut?.is_potong_tukin ? 'Terpotong Tukin' : 'Hadir',
          distanceMeters: distanceFromOffice,
          isInsideRadius,
          isEmergency,
          isPotongTukin: resOut?.is_potong_tukin,
          kurangMenit: resOut?.kurang_menit,
          photo: selfiePhoto
        });
        setShowSuccessModal(true);

        const isEarlyDepart = Boolean(resOut?.is_potong_tukin || currentWibMinutes < requiredOutMinutes);
        const selisihMnt = resOut?.kurang_menit || remainingMins;

        setToastMessage({
          id: String(Date.now()),
          type: isEarlyDepart ? 'warning' : 'success',
          title: isEarlyDepart ? 'Presensi Pulang (Sebelum Waktu)' : 'Presensi Pulang Berhasil!',
          message: isEarlyDepart
            ? `Tercatat pukul ${resOut?.jam_pulang || currentWibTime} WIB. Pulang sebelum waktunya (kurang ${selisihMnt} mnt - pemotongan Tukin PSW).`
            : `Tercatat pukul ${resOut?.jam_pulang || currentWibTime} WIB. Terima kasih atas dedikasi Anda hari ini!`,
          actionText: 'Lihat Konfirmasi',
          onAction: () => setShowSuccessModal(true)
        });
      }
    } catch (err: any) {
      setAbsenError(err.message || 'Gagal mengirim absensi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInsideRadius =
    assignedMethod !== 'WFO' ||
    (distanceFromOffice !== null &&
      officeLocation &&
      distanceFromOffice <= (officeLocation.radius_meter || 150));

  // Calculate Weekly Dates (Min, Sen, Sel, Rab, Kam, Jum, Sab)
  const getWeekDates = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - currentDay);

    const days = [];
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      // Check attendance for this date
      const record = allHistory.find(r => r.tanggal === dateStr);
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      const isFuture = d > now && !isToday;
      const isWeekend = i === 0 || i === 6;

      let statusDot: 'hadir' | 'masuk_pulang' | 'izin' | 'tk' | 'holiday' = 'holiday';
      if (record) {
        if (record.status === 'Hadir') {
          statusDot = record.jam_pulang ? 'hadir' : 'masuk_pulang';
        } else if (record.status === 'Izin' || record.status === 'Cuti') {
          statusDot = 'izin';
        } else if (record.status === 'Terlambat') {
          statusDot = 'masuk_pulang';
        } else {
          statusDot = 'tk';
        }
      } else if (isToday) {
        if (todayAttendance?.jam_masuk) {
          statusDot = todayAttendance.jam_pulang ? 'hadir' : 'masuk_pulang';
        } else {
          statusDot = 'tk';
        }
      } else if (!isFuture && !isWeekend) {
        statusDot = 'tk';
      }

      days.push({
        dayName: dayNames[i],
        dateNumber: d.getDate(),
        fullDateStr: dateStr,
        isToday,
        statusDot,
        isWeekend
      });
    }
    return days;
  };

  const weekDays = getWeekDates();
  const weekStartStr = `${weekDays[0].dateNumber} - ${weekDays[6].dateNumber} ${new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`;
  const currentMonthName = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // Monthly stats calculation
  const currentMonthPrefix = new Date().toISOString().substring(0, 7); // YYYY-MM
  const monthRecords = allHistory.filter(r => r.tanggal?.startsWith(currentMonthPrefix));
  const totalHadirThisMonth = monthRecords.filter(r => r.status === 'Hadir').length + (todayAttendance?.status === 'Hadir' ? 1 : 0);
  const totalTerlambatThisMonth = monthRecords.filter(r => r.status === 'Terlambat').length;
  const totalCutiThisMonth = monthRecords.filter(r => r.status === 'Cuti' || r.status === 'Izin').length;
  const attendanceRate = Math.min(100, Math.round(((totalHadirThisMonth || 1) / Math.max(1, totalHadirThisMonth + totalTerlambatThisMonth)) * 100));

  // Employee display info
  const empName = user?.nama_lengkap || user?.namaLengkap || user?.username || 'Pegawai KPU';
  const empNip = (user as any)?.nip_nik || (user as any)?.nipNik || '';
  const empSubBagian = (user as any)?.sub_bagian || user?.unit_kerja || (user as any)?.unitKerja || 'KPU KOTA SUNGAI PENUH';
  const empPhoto = (user as any)?.fotoProfil || (user as any)?.foto_profil || '';

  const getInitials = (name: string) => {
    return name
      .replace(/^(h\.|dr\.|hj\.|ir\.|drs\.)\s*/i, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');
  };

  return (
    <div className="space-y-4 px-3.5 pt-3 pb-8">
      {/* ===================== HERO PROFILE CARD (FOREST GREEN + TEAL + SKY BLUE GRADIENT) ===================== */}
      <div className="bg-linear-to-br from-[#064E3B] via-[#0D766E] to-[#0284C7] text-white p-5 rounded-3xl shadow-md border border-teal-800/40 relative overflow-hidden">
        {/* Subtle decorative teal & sky curved background wave pattern */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-teal-300/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-3 top-2 text-white/10 select-none pointer-events-none">
          <svg className="w-36 h-36" viewBox="0 0 200 200" fill="currentColor">
            <path d="M45.7,-78.9C58.9,-71.4,69,-58.7,76.5,-44.6C84,-30.5,88.9,-15.3,87.2,-0.9C85.6,13.4,77.3,26.8,68.4,39.5C59.5,52.2,50,64.2,37.3,71.7C24.6,79.2,8.8,82.2,-6.4,81.1C-21.6,80.1,-36.1,75,-48.9,66.6C-61.6,58.2,-72.5,46.5,-79.8,32.4C-87.1,18.3,-90.7,1.8,-87.6,-13.4C-84.5,-28.6,-74.6,-42.5,-62.4,-51.1C-50.2,-59.7,-35.6,-62.9,-21.7,-69.7C-7.8,-76.4,5.4,-86.6,20.1,-87.6C34.8,-88.6,48,-80.4,45.7,-78.9Z" transform="translate(100 100)" />
          </svg>
        </div>

        <div className="relative z-10 flex items-center gap-4">
          {/* Avatar Photo (Using real database photo with initials fallback, never default unsplash) */}
          <div className="relative shrink-0">
            {empPhoto ? (
              <img
                src={empPhoto}
                alt={empName}
                className="w-16 h-16 rounded-2xl border-2 border-sky-300 object-cover shadow-md ring-2 ring-emerald-950/40 bg-white"
                onError={e => {
                  (e.target as any).style.display = 'none';
                  const el = document.getElementById('dash-avatar-fallback');
                  if (el) el.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              id="dash-avatar-fallback"
              style={{ display: empPhoto ? 'none' : 'flex' }}
              className="w-16 h-16 rounded-2xl border-2 border-sky-300 bg-linear-to-br from-emerald-950 via-teal-900 to-sky-800 text-sky-100 items-center justify-center font-bold text-xl shadow-md ring-2 ring-emerald-950/40"
            >
              {getInitials(empName)}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#064E3B] ring-1 ring-emerald-300" title="Status Online & Aktif" />
          </div>

          {/* Greeting, Name, NIP & Subbagian */}
          <div className="flex-1 min-w-0">
            <div className="text-teal-100 text-xs font-semibold tracking-wide flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <span>{getGreeting()}</span>
                <span className="text-[10px] text-white/50">•</span>
                <span className="text-[10px] text-teal-200 font-mono">SITENANG</span>
              </div>
              <RealtimeConnectionBadge variant="compact" onRefresh={fetchData} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white truncate drop-shadow-xs mt-0.5">
              {empName}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {empNip && (
                <span className="bg-black/25 text-sky-200 text-[10px] font-mono px-2 py-0.5 rounded-md border border-sky-300/20 truncate">
                  NIP: {empNip}
                </span>
              )}
              <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-md tracking-wider border border-white/25 truncate">
                {empSubBagian}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== BANNER STATUS PRESENSI HARI INI (JIKA SUDAH ABSEN MASUK) ===================== */}
      {todayAttendance?.jam_masuk && (
        <div className="bg-linear-to-r from-teal-900 via-emerald-900 to-sky-950 border border-teal-500/40 text-white p-3.5 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-2.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10.5px] text-teal-200 block font-medium">Presensi Masuk Hari Ini</span>
              <span className="text-xs font-mono font-black text-white">
                Pukul {todayAttendance.jam_masuk?.substring(0, 5)} WIB
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lateMinutes > 0 ? (
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-black bg-amber-400 text-amber-950 shadow-2xs">
                  <AlarmClock className="w-3 h-3 text-amber-950" />
                  Wajib Pulang: Pukul {jamPulangWajibStr} WIB
                </span>
                <span className="text-[9.5px] text-amber-200 block mt-0.5">
                  Wajib Ganti Jam (Terlambat {lateMinutes} Menit)
                </span>
              </div>
            ) : (
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10.5px] font-black bg-emerald-400 text-emerald-950 shadow-2xs">
                  <CheckCircle2 className="w-3 h-3 text-emerald-950" />
                  Tepat Waktu
                </span>
                <span className="text-[9.5px] text-emerald-200 block mt-0.5">
                  Pulang Mulai Pukul {schedOutStr} WIB
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== STATUS KONEKSI & SINKRONISASI REAL-TIME ===================== */}
      <div className="w-full">
        <RealtimeConnectionBadge onRefresh={fetchData} className="w-full" />
      </div>

      {/* ===================== ROLE SWITCHER BANNER (JIKA PEGAWAI DITUGASKAN SEBAGAI OPERATOR) ===================== */}
      <RoleSwitcherButton variant="banner" />

      {/* ===================== OFFLINE PERSISTENCE NOTIFICATION BANNER ===================== */}
      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-300 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-amber-950 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500 text-white rounded-lg shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Mode Offline Aktif</span>: Menampilkan data presensi dan riwayat tersimpan lokal di IndexedDB.
            </div>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
          >
            Segarkan
          </button>
        </div>
      )}

      {/* ===================== ATTENDANCE REMINDER NOTIFICATION BANNER ===================== */}
      <AttendanceReminderBanner
        onAction={() => {
          if (isCheckInExpired || todayAttendance?.jam_masuk) {
            if (!todayAttendance?.jam_pulang) {
              openAbsenModal('OUT');
            }
          } else {
            openAbsenModal('IN');
          }
        }}
      />

      {/* ===================== ATTENDANCE STATUS & GPS RADAR HUB ===================== */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-teal-100/90 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${todayAttendance?.jam_masuk ? 'bg-emerald-500' : 'bg-teal-600 animate-pulse'}`} />
            <span className="text-xs font-bold text-slate-800">
              Presensi Hari Ini ({new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className="text-[11px] font-mono font-bold text-teal-900 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200 flex items-center gap-1.5 shadow-2xs"
              title={serverSyncInfo.isSynced ? `Waktu resmi KPU tersinkronisasi dengan server (Selisih: ${serverSyncInfo.diffSeconds}s)` : 'Waktu WIB'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${serverSyncInfo.isSynced ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
              {displayWibTime || '--:--:--'} WIB
            </span>
          </div>
        </div>

        {/* Server Clock Skew Notice if device clock differs significantly */}
        {serverSyncInfo.isSynced && Math.abs(serverSyncInfo.diffSeconds) > 60 && (
          <div className="p-2.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-[10.5px] text-amber-900 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>
              Jam perangkat Anda berbeda {Math.abs(Math.round(serverSyncInfo.diffSeconds / 60))} menit dari waktu resmi server. Sistem otomatis menggunakan jam server WIB yang akurat untuk presensi.
            </span>
          </div>
        )}

        {/* ================= JIKA SUDAH ABSEN MASUK: TAMPILKAN KETERANGAN PRESENSI MASUK & KEWAJIBAN GANTI JAM DI ATAS ================= */}
        {todayAttendance?.jam_masuk && (
          <div className="space-y-3">
            {/* Card Informasi Presensi Masuk & Rincian Kewajiban Penggantian Waktu */}
            <div className="rounded-3xl border-2 border-teal-600/30 bg-gradient-to-br from-teal-50/95 via-emerald-50/40 to-white p-4 shadow-sm border-teal-200 space-y-3.5 animate-in fade-in duration-200">
              {/* Header: Keterangan Sudah Absen Masuk */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#0D766E] text-white flex items-center justify-center shrink-0 shadow-md ring-2 ring-teal-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">
                        Status Presensi Hari Ini
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span>Sudah Presensi Masuk</span>
                      <span className="font-mono text-teal-950 bg-teal-100/90 px-2.5 py-0.5 rounded-lg border border-teal-300 text-xs font-black shadow-2xs">
                        Pukul {todayAttendance.jam_masuk?.substring(0, 5)} WIB
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Badge Status Kedatangan */}
                <div className="shrink-0">
                  {todayAttendance?.status === 'TK' ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1 shadow-2xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      TK (Lewat 08.29)
                    </span>
                  ) : lateMinutes > 0 ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-950 border border-amber-300 flex items-center gap-1 shadow-2xs">
                      <AlarmClock className="w-3.5 h-3.5 text-amber-600" />
                      Terlambat {lateMinutes} Menit
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Tepat Waktu
                    </span>
                  )}
                </div>
              </div>

              {/* Status Tambahan: Pengajuan Luar Radius atau TK jika ada */}
              {todayAttendance?.approval_status === 'pending' || todayAttendance?.status === 'Menunggu Persetujuan' ? (
                <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 text-amber-950">
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Presensi Luar Radius ({todayAttendance.jarak_dari_kantor ? `${todayAttendance.jarak_dari_kantor}m` : 'Luar Radius'}) • Menunggu Verifikasi Admin</span>
                  </div>
                </div>
              ) : todayAttendance?.status === 'TK' ? (
                <div className="bg-rose-50 border border-rose-300 p-2.5 rounded-xl text-xs text-rose-900">
                  <p className="text-[11px]">
                    Presensi masuk Anda tercatat pukul <strong>{todayAttendance.jam_masuk?.substring(0, 5)} WIB</strong> (melewati batas toleransi 08:29 WIB), sehingga kehadiran dicatat sebagai <strong>TK (Tanpa Keterangan)</strong>.
                  </p>
                </div>
              ) : null}

              {/* Box Rincian Kewajiban Jam Pulang & Penggantian Jam Keterlambatan */}
              {lateMinutes > 0 ? (
                <div className="p-3.5 rounded-2xl bg-amber-50/95 border-2 border-amber-300 space-y-2.5 text-xs text-amber-950">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 text-amber-950 font-black text-xs">
                      <AlarmClock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Wajib Mengganti Kekurangan Jam Kerja:</span>
                    </div>
                    <div className="bg-amber-200/90 px-3 py-1 rounded-xl border border-amber-400/80 shadow-2xs flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-amber-900 uppercase">Wajib Pulang Paling Cepat:</span>
                      <span className="font-mono text-sm font-black text-amber-950">
                        Pukul {jamPulangWajibStr} WIB
                      </span>
                    </div>
                  </div>

                  {/* Rincian Kalkulasi Transparan */}
                  <div className="bg-white/90 rounded-xl p-2.5 border border-amber-200/90 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-700">
                      <span>Jadwal Masuk Kantor:</span>
                      <span className="font-mono font-bold text-slate-900">{schedInStr} WIB</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-700">
                      <span>Jam Masuk Anda:</span>
                      <span className="font-mono font-bold text-amber-950">{todayAttendance.jam_masuk?.substring(0, 5)} WIB (Terlambat {lateMinutes} menit)</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-700">
                      <span>Jadwal Pulang Normal:</span>
                      <span className="font-mono font-bold text-slate-900">{schedOutStr} WIB</span>
                    </div>
                    <div className="pt-1 border-t border-amber-200 flex items-center justify-between text-xs font-bold text-amber-950">
                      <span>Target Jam Pulang Wajib:</span>
                      <span className="font-mono font-black text-teal-950 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {schedOutStr} + {lateMinutes} menit = Pukul {jamPulangWajibStr} WIB
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Karena Anda terlambat <strong>{lateMinutes} menit</strong>, Anda wajib mengganti kekurangan jam kerja dengan melakukan presensi pulang paling cepat pukul <strong>{jamPulangWajibStr} WIB</strong>.
                  </p>

                  {/* Status Pemenuhan Waktu Penggantian Real-Time */}
                  {!todayAttendance?.jam_pulang ? (
                    <div className="pt-1 border-t border-amber-200/80">
                      {isTimeFulfilled ? (
                        <div className="p-2.5 bg-emerald-100/90 border border-emerald-300 rounded-xl text-emerald-950 font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-[11px] leading-tight">
                            Kewajiban ganti jam keterlambatan telah <strong>terpenuhi tuntas</strong>. Anda sudah dapat melakukan presensi pulang sekarang tanpa pemotongan Tukin.
                          </span>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-white border border-amber-300 rounded-xl text-amber-950 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                          <span className="text-[11px] leading-tight">
                            Sisa waktu kerja: <strong className="font-mono font-black text-amber-900">Kurang {remainingMins} menit lagi</strong>. Pulang sebelum pukul {jamPulangWajibStr} WIB dikenakan pemotongan Tukin.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-teal-50/80 border border-teal-200 space-y-1.5 text-xs text-teal-950">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-teal-950 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Kehadiran Tepat Waktu (Bebas Ganti Jam)
                    </span>
                    <span className="font-mono font-bold text-teal-950 bg-white px-2 py-0.5 rounded-md border border-teal-200 text-[11px]">
                      Pulang Mulai {schedOutStr} WIB
                    </span>
                  </div>
                  <p className="text-[11px] text-teal-900 leading-relaxed">
                    Anda hadir tepat waktu sebelum pukul {schedInStr} WIB sehingga tidak ada kekurangan jam kerja yang harus diganti. Anda dapat melakukan presensi pulang normal mulai pukul <strong>{schedOutStr} WIB</strong> s.d. 23.59 WIB.
                  </p>
                </div>
              )}

              {/* Status Presensi Hari Ini Selesai jika sudah absen pulang */}
              {todayAttendance?.jam_pulang ? (
                <div className="rounded-2xl border bg-white p-3 border-teal-200 space-y-2 text-xs text-teal-950">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-teal-950">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Presensi Hari Ini Selesai</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAbsenModal('OUT')}
                      title="Perbarui waktu presensi pulang"
                      className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-[10.5px] font-bold cursor-pointer transition shadow-2xs"
                    >
                      Perbarui Pulang
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-0.5 font-mono">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-sans">Presensi Masuk</span>
                      <span className="font-bold text-slate-900 text-xs">{todayAttendance.jam_masuk?.substring(0, 5) || 'Tanpa Masuk'} WIB</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-sans">Presensi Pulang</span>
                      <span className="font-bold text-teal-950 text-xs">{todayAttendance.jam_pulang?.substring(0, 5)} WIB</span>
                    </div>
                  </div>

                  {lateMinutes > 0 && (
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[10.5px]">
                      {todayAttendance.status_ganti_jam === 'terpenuhi' || parseTimeToMinutes(todayAttendance.jam_pulang) >= requiredOutMinutes ? (
                        <span className="text-emerald-800 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          Kewajiban ganti jam ({lateMinutes} mnt) dipenuhi tuntas (Target: {jamPulangWajibStr} WIB, Pulang: {todayAttendance.jam_pulang?.substring(0, 5)} WIB).
                        </span>
                      ) : (
                        <span className="text-rose-800 font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          Pulang sebelum target penggantian {jamPulangWajibStr} WIB. Tukin dikenakan pemotongan.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Tombol Aksi Presensi Pulang jika belum absen pulang */
                <div>
                  {isCheckOutAllowed ? (
                    <button
                      type="button"
                      onClick={() => openAbsenModal('OUT')}
                      className={`w-full py-3 px-3 hover:brightness-105 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        currentWibMinutes < requiredOutMinutes
                          ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-rose-700'
                          : 'bg-gradient-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7]'
                      }`}
                    >
                      <Clock className="w-4 h-4 text-sky-200" />
                      <span>
                        {currentWibMinutes < requiredOutMinutes
                          ? `Presensi Pulang (Lebih Awal - Target: Pukul ${jamPulangWajibStr} WIB)`
                          : 'Presensi Pulang Sekarang'}
                      </span>
                    </button>
                  ) : (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 text-center font-semibold">
                      Waktu presensi pulang telah berakhir (maksimal pukul 23.59 WIB).
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= GEOFENCING GPS VALIDATION HUB ================= */}
        <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200/90 space-y-2.5">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-teal-600/10 flex items-center justify-center text-teal-700">
                <Navigation className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-800 tracking-tight">
                Validasi Geofencing GPS (Area Kantor KPU)
              </span>
            </div>

            {/* Geofence Status Badge */}
            <div>
              {!gpsActive ? (
                <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" /> GPS Nonaktif
                </span>
              ) : assignedMethod === 'WFO' ? (
                isInsideRadius ? (
                  <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300 shadow-2xs">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Terverifikasi Dalam Geofence
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-rose-300 shadow-2xs">
                    <AlertTriangle className="w-3 h-3 text-rose-600" /> Di Luar Geofence ({distanceFromOffice ?? '?'}m)
                  </span>
                )
              ) : (
                <span className="text-[10px] font-extrabold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full border border-teal-200">
                  Bebas Radius ({assignedMethod})
                </span>
              )}
            </div>
          </div>

          {/* Grid of Geofencing Parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10.5px]">
            {/* Jarak ke Kantor */}
            <div className="p-2 rounded-xl bg-white border border-slate-200/80 flex flex-col justify-between">
              <span className="text-slate-500 text-[10px]">Jarak ke Kantor KPU</span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="text-sm font-black text-slate-900 font-mono">
                  {distanceFromOffice !== null ? `${distanceFromOffice}m` : '-'}
                </span>
                <span className="text-[9.5px] text-slate-500">
                  / Maks {officeLocation?.radius_meter || 150}m
                </span>
              </div>
            </div>

            {/* Koordinat Pegawai */}
            <div className="p-2 rounded-xl bg-white border border-slate-200/80 flex flex-col justify-between">
              <span className="text-slate-500 text-[10px]">Koordinat GPS Anda</span>
              <span className="mt-0.5 font-mono font-bold text-slate-800 truncate text-[10px]" title={currentCoords ? `${currentCoords.latitude}, ${currentCoords.longitude}` : ''}>
                {currentCoords ? `${currentCoords.latitude.toFixed(5)}, ${currentCoords.longitude.toFixed(5)}` : 'Mencari sinyal...'}
              </span>
            </div>

            {/* Akurasi & Titik Pusat Kantor */}
            <div className="p-2 rounded-xl bg-white border border-slate-200/80 flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-slate-500 text-[10px]">Akurasi & Sinyal</span>
              <span className="mt-0.5 font-semibold text-slate-700 flex items-center justify-between">
                <span>{currentCoords?.accuracy ? `±${currentCoords.accuracy} meter` : 'Tinggi (GPS Satelit)'}</span>
                <span className={`w-2 h-2 rounded-full ${gpsActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              </span>
            </div>
          </div>

          {/* Interactive Map Toggle & GPS Refresh Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
            <button
              type="button"
              onClick={() => setShowDashboardMap(!showDashboardMap)}
              className="flex items-center gap-1 font-bold text-teal-800 hover:text-teal-900 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-teal-600" />
              <span>{showDashboardMap ? 'Sembunyikan Peta Geofence' : 'Lihat Radar Peta Geofence'}</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleUseOfficeLocation()}
                className="flex items-center gap-1 text-[10.5px] font-bold text-teal-800 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 shadow-2xs transition-all cursor-pointer"
                title="Gunakan titik resmi Kantor KPU Kota Sungai Penuh jika GPS terhalang atau di dalam ruangan"
              >
                <CheckCircle2 className="w-3 h-3 text-teal-600" />
                <span>Set Titik Kantor KPU</span>
              </button>

              <button
                type="button"
                onClick={() => requestLocation()}
                disabled={isLocating}
                className="flex items-center gap-1 text-[10.5px] font-semibold text-slate-600 hover:text-teal-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-3 h-3 text-teal-600 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Mengukur...' : 'Kalibrasi GPS'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Geofence Radar Map directly on Dashboard when toggled */}
          {showDashboardMap && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <AttendanceMapPreview
                userCoords={currentCoords}
                officeLocation={officeLocation}
                distanceFromOffice={distanceFromOffice}
                isInsideRadius={isInsideRadius}
                isLocating={isLocating}
                onRefreshLocation={requestLocation}
                height="220px"
              />
              <p className="text-[10px] text-slate-500 mt-1 text-center">
                Lingkaran hijau menandakan batas radius geofence kantor KPU Kota Sungai Penuh ({officeLocation?.radius_meter || 150}m). Presensi masuk & pulang wajib berada di dalam area ini.
              </p>
            </div>
          )}
        </div>

        {/* ================= AKSI PRESENSI MASUK (JIKA BELUM ABSEN MASUK) ================= */}
        {!todayAttendance?.jam_masuk && (
          <div className="flex flex-col gap-2 pt-0.5">
            {isCheckInExpired ? (
              /* Waktu Presensi Masuk Berakhir (Lewat 08.30 WIB) - Tampilkan Tombol Presensi Pulang */
              <div className="space-y-2">
                <div className="bg-slate-50 border border-slate-200/80 p-2.5 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Presensi Masuk Ditutup (Batas 08.30 WIB)</span>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                    Bisa Absen Pulang
                  </span>
                </div>

                {!todayAttendance?.jam_pulang && isCheckOutAllowed && (
                  <button
                    type="button"
                    onClick={() => openAbsenModal('OUT')}
                    className="w-full py-3 px-3 bg-linear-to-r from-teal-700 to-sky-700 hover:brightness-105 active:scale-[0.99] text-white font-bold text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Clock className="w-4 h-4 text-sky-200" />
                    <span>Presensi Pulang (Aktif s.d. 23.59 WIB)</span>
                  </button>
                )}
              </div>
            ) : isCheckInTooEarly ? (
              /* Presensi Masuk Belum Dibuka (Sebelum 06.00 WIB) */
              <div className="bg-amber-50/90 border border-amber-300 p-2.5 rounded-2xl text-xs flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Presensi Masuk Belum Dibuka</span>
                </div>
                <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                  Buka Pukul 06.00 WIB
                </span>
              </div>
            ) : (
              /* Pukul 06.00 sampai 08.30 WIB: Tombol Presensi Masuk Aktif */
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-emerald-800">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    Waktu Presensi Masuk Aktif
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    06.00 - 08.30 WIB
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openAbsenModal('IN')}
                  className="w-full py-3 px-3 bg-linear-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7] hover:brightness-105 active:scale-[0.99] text-white font-bold text-xs rounded-2xl shadow-md shadow-teal-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ScanFace className="w-4 h-4 text-sky-200" />
                  <span>
                    {!gpsActive
                      ? 'Aktifkan GPS & Presensi Masuk'
                      : !isInsideRadius && assignedMethod === 'WFO'
                      ? 'Presensi Masuk (Luar Radius + Alasan)'
                      : 'Presensi Masuk (06.00 - 08.30 WIB)'}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================== PENGINGAT ABSENSI & PWA INSTALL BANNER ===================== */}
      <div className="space-y-3">
        {/* Pengingat Otomatis Kedaluwarsa Sisa Jatah Cuti Tahunan */}
        <LeaveExpiryReminderBanner balance={balance} onNavigate={onNavigate} />

        {/* Firebase Cloud Messaging Real-Time Push Notification & Reminder Card */}
        <PushReminderSettingsCard user={user} />

        <PWAInstallButton variant="banner" />

        {/* Attendance Reminder Quick Card */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
              <BellRing className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs text-slate-800">
                  Pengingat Presensi Otomatis
                </span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${reminderConfig.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                  {reminderConfig.enabled ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 mt-0.5 truncate">
                Masuk: {reminderConfig.morningTime} WIB • Pulang: {reminderConfig.afternoonTime} WIB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={openReminderSettings}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 text-[11px] font-bold rounded-xl border border-slate-200 transition cursor-pointer"
            >
              Atur Jam
            </button>
            <button
              type="button"
              onClick={triggerTestNotification}
              className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-xl border border-teal-200 transition cursor-pointer"
              title="Uji Coba Notifikasi Sekarang (Bunyi & Pop-Up)"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ===================== LAYANAN MANDIRI PEGAWAI (2x2 EXECUTIVE GRID) ===================== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black tracking-wider uppercase text-slate-600">
            Layanan Mandiri Pegawai
          </h2>
          <span className="text-[10px] text-teal-800 font-semibold">SITENANG Hub</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Card 1: Permintaan Kehadiran */}
          <div
            id="card-permintaan-kehadiran"
            onClick={() => onNavigate && onNavigate('pegawai-ajukan-cuti')}
            className="bg-white rounded-2xl p-3.5 shadow-xs border border-teal-100 hover:border-teal-300 hover:shadow-md transition-all active:scale-95 cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                <MessageSquare className="w-5 h-5 stroke-[2.2]" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
            <div className="mt-3">
              <h3 className="font-bold text-slate-800 text-xs">
                Permintaan Kehadiran
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                Ajukan Cuti, Izin, Sakit, DL
              </p>
            </div>
          </div>

          {/* Card 2: Jadwal Presensi */}
          <div
            id="btn-jadwal-absensi"
            onClick={() => setShowJadwalModal(true)}
            className="bg-white rounded-2xl p-3.5 shadow-xs border border-teal-100 hover:border-sky-300 hover:shadow-md transition-all active:scale-95 cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
                <AlarmClock className="w-5 h-5 stroke-[2.2]" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
            <div className="mt-3">
              <h3 className="font-bold text-slate-800 text-xs">
                Jadwal Kerja KPU
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                07.30 - 16.00 / 16.30 WIB
              </p>
            </div>
          </div>

          {/* Card 3: Hari Libur */}
          <div
            id="btn-hari-libur"
            onClick={() => setShowHariLiburModal(true)}
            className="bg-white rounded-2xl p-3.5 shadow-xs border border-teal-100 hover:border-slate-300 hover:shadow-md transition-all active:scale-95 cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                <CalendarDays className="w-5 h-5 stroke-[2.2]" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
            <div className="mt-3">
              <h3 className="font-bold text-slate-800 text-xs">
                Hari Libur Resmi
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                Kalender SKB 3 Menteri 2026
              </p>
            </div>
          </div>

          {/* Card 4: Riwayat Presensi */}
          <div
            id="btn-riwayat-mutasi"
            onClick={() => onNavigate && onNavigate('pegawai-riwayat-absensi')}
            className="bg-white rounded-2xl p-3.5 shadow-xs border border-teal-100 hover:border-emerald-300 hover:shadow-md transition-all active:scale-95 cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <TrendingUp className="w-5 h-5 stroke-[2.2]" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
            <div className="mt-3">
              <h3 className="font-bold text-slate-800 text-xs">
                Riwayat Presensi
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                Log Kehadiran & Rekap Bulanan
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== KEHADIRAN PEKAN INI (7-DAY STRIP) ===================== */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-teal-100/90 space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">
                Kehadiran Minggu Ini
              </h3>
              <p className="text-[10px] text-slate-400">
                {weekStartStr}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="p-1.5 rounded-full text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
            title="Muat Ulang"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>

        {/* 7-Day Horizontal Strip */}
        <div className="grid grid-cols-7 gap-1 text-center select-none pt-1">
          {weekDays.map((day, idx) => (
            <div
              key={idx}
              className={`flex flex-col items-center py-2 rounded-xl transition-all ${
                day.isToday
                  ? 'bg-linear-to-b from-[#064E3B] to-[#0D766E] text-white font-bold shadow-md shadow-teal-950/20'
                  : 'text-slate-600'
              }`}
            >
              <span
                className={`text-[10px] font-semibold mb-1 ${
                  day.isToday
                    ? 'text-teal-200 font-bold'
                    : day.dayName === 'Min' || day.dayName === 'Sab'
                    ? 'text-rose-500 font-bold'
                    : 'text-slate-600'
                }`}
              >
                {day.dayName}
              </span>
              <span className={`text-xs ${day.isToday ? 'font-black text-white' : 'font-medium'}`}>
                {day.dateNumber}
              </span>
              {/* Dot indicator */}
              <div className="mt-1.5">
                {day.statusDot === 'hadir' && (
                  <div className={`w-2 h-2 rounded-full ${day.isToday ? 'bg-teal-300' : 'bg-emerald-500'}`} title="Hadir Lengkap" />
                )}
                {day.statusDot === 'masuk_pulang' && (
                  <div className="w-2 h-2 rounded-full bg-sky-400" title="Masuk / Belum Checkout" />
                )}
                {day.statusDot === 'izin' && (
                  <div className="w-2 h-2 rounded-full bg-blue-400" title="Izin / Cuti" />
                )}
                {day.statusDot === 'tk' && (
                  <div className="w-2 h-2 rounded-full bg-rose-500" title="Tanpa Keterangan" />
                )}
                {day.statusDot === 'holiday' && (
                  <div className={`w-1.5 h-1.5 rounded-full ${day.isToday ? 'bg-white/40' : 'bg-slate-200'}`} title="Libur / Belum tiba" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-around pt-2 border-t border-slate-100 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Hadir</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Masuk/Pulang</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Izin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <span>TK</span>
          </div>
        </div>

        {/* Action Button: Kalender Kehadiran */}
        <button
          type="button"
          id="btn-kalender-kehadiran"
          onClick={() => onNavigate && onNavigate('pegawai-kalender-cuti')}
          className="w-full py-2.5 bg-linear-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7] hover:brightness-105 active:scale-[0.99] text-white font-bold text-xs rounded-2xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-sky-200" />
          <span>Buka Kalender Kehadiran & Cuti</span>
        </button>
      </div>

      {/* ===================== STATISTIK KEDISIPLINAN ===================== */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-teal-100/90 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
            <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Palette className="w-4 h-4" />
            </div>
            <span>Statistik Kedisiplinan</span>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full font-medium">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>{currentMonthName}</span>
          </div>
        </div>

        {/* Gauge & Metrics */}
        <div className="flex items-center justify-between gap-4 pt-1">
          {/* Half-circle / Donut Progress Gauge */}
          <div className="relative w-28 h-20 flex flex-col items-center justify-end overflow-hidden shrink-0">
            <svg className="w-28 h-28 transform -rotate-90 origin-center" viewBox="0 0 100 100">
              {/* Background Arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#CCFBF1"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray="251.2"
                strokeDashoffset="125.6"
              />
              {/* Active Teal Arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#0D9488"
                strokeWidth="10"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (125.6 * (attendanceRate / 100))}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute bottom-1 text-center">
              <span className="text-base font-black text-slate-800 block leading-none">
                {attendanceRate}%
              </span>
              <span className="text-[9px] text-slate-400 font-medium">
                Disiplin
              </span>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="flex-1 space-y-1.5">
            {/* Kehadiran */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                <span>{totalHadirThisMonth || 13} Kehadiran</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-medium">Bulan Ini</span>
            </div>

            {/* Terlambat */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-100 text-xs">
              <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>{totalTerlambatThisMonth} Terlambat</span>
              </div>
              <span className="text-[10px] text-amber-600 font-medium">Ganti Jam</span>
            </div>

            {/* Cuti/Izin */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-sky-50 border border-sky-100 text-xs">
              <div className="flex items-center gap-1.5 text-sky-900 font-bold">
                <FileText className="w-3.5 h-3.5 text-sky-600" />
                <span>{totalCutiThisMonth} Cuti / Izin</span>
              </div>
              <span className="text-[10px] text-sky-600 font-medium">Tercatat</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== GRAFIK BATANG STATISTIK ABSENSI BULANAN (RECHARTS) ===================== */}
      <StatistikAbsensiBulananCard
        employeeId={(user as any)?.employee_id || (user as any)?.employeeId}
        title="Statistik Absensi Bulanan Pegawai"
      />

      {/* ===================== SALDO CUTI TAHUNAN CARD ===================== */}
      <div className="bg-white rounded-3xl p-4 shadow-xs border border-teal-100/90 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>Sisa Saldo Cuti Tahunan ({balance?.tahun || new Date().getFullYear()})</span>
          </div>

          <button
            type="button"
            onClick={() => onNavigate && onNavigate('pegawai-saldo-cuti')}
            className="text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-0.5 cursor-pointer"
          >
            <span>Rincian</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">N-2</span>
            <span className="text-sm font-bold text-slate-800 mt-0.5 block">{balance?.n_2 || 0}</span>
            <span className="text-[8px] text-slate-400">Hari</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[9px] text-slate-500 uppercase block font-semibold">N-1</span>
            <span className="text-sm font-bold text-slate-800 mt-0.5 block">{balance?.n_1 || 0}</span>
            <span className="text-[8px] text-slate-400">Hari</span>
          </div>
          <div className="p-2 rounded-xl bg-teal-50 border border-teal-200">
            <span className="text-[9px] text-teal-700 uppercase block font-bold">N (2026)</span>
            <span className="text-sm font-bold text-teal-900 mt-0.5 block">{balance?.n || 0}</span>
            <span className="text-[8px] text-teal-600 font-semibold">Hari</span>
          </div>
          <div className="p-2 rounded-xl bg-linear-to-br from-[#064E3B] to-[#0D766E] text-white shadow-xs">
            <span className="text-[9px] text-sky-200 uppercase block font-bold">Total</span>
            <span className="text-sm font-black mt-0.5 block">
              {(balance?.n_2 || 0) + (balance?.n_1 || 0) + (balance?.n || 0)}
            </span>
            <span className="text-[8px] text-teal-100">Tersedia</span>
          </div>
        </div>
      </div>

      {/* ===================== JADWAL ABSENSI MODAL ===================== */}
      {showJadwalModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowJadwalModal(false)}
          title="Jadwal & Aturan Presensi KPU Kota Sungai Penuh"
          maxWidth="max-w-sm"
        >
          <div className="space-y-3.5 text-xs text-slate-700">
            <div className="p-3 bg-teal-50 rounded-2xl border border-teal-200 text-teal-950 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-xs text-teal-900">
                <AlarmClock className="w-4 h-4 text-teal-600" />
                Ketentuan Jam Kerja Resmi KPU
              </span>
              <p className="text-[11px] text-teal-800 leading-relaxed">
                Presensi wajib dilakukan di dalam radius kantor KPU Kota Sungai Penuh (maks 150 meter) menggunakan foto selfie dan GPS aktif.
              </p>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="font-semibold">Senin s/d Kamis</span>
                <span className="font-mono font-bold text-slate-900">07:30 - 16:00 WIB</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="font-semibold">Jumat</span>
                <span className="font-mono font-bold text-slate-900">07:30 - 16:30 WIB</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="font-semibold">Istirahat (Sen-Kam)</span>
                <span className="font-mono text-slate-600">12:00 - 13:00 WIB</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="font-semibold">Istirahat (Jumat)</span>
                <span className="font-mono text-slate-600">11:30 - 13:00 WIB</span>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 text-[11px] space-y-1.5">
              <span className="font-bold block text-amber-900">⚠️ Kebijakan Keterlambatan & Batas Hadir:</span>
              <ul className="list-disc pl-4 space-y-1 text-amber-900/90 leading-relaxed">
                <li>
                  <strong>Batas hadir pegawai adalah 08.29 WIB</strong>.
                </li>
                <li>
                  Pegawai yang check-in <strong>07.30 s.d. 08.29 WIB</strong> wajib mengganti jam keterlambatan saat kepulangan di hari yang sama.
                </li>
                <li>
                  Jika presensi <strong>melewati pukul 08.29 WIB</strong>, pegawai dianggap <strong>TK (Tanpa Keterangan)</strong>.
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setShowJadwalModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </Modal>
      )}

      {/* ===================== HARI LIBUR MODAL ===================== */}
      {showHariLiburModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowHariLiburModal(false)}
          title="Daftar Hari Libur Nasional & Cuti Bersama 2026"
          maxWidth="max-w-sm"
        >
          <div className="space-y-3 text-xs text-slate-700 max-h-[70vh] flex flex-col">
            <p className="text-[11px] text-slate-500">
              Berdasarkan SKB 3 Menteri Tentang Hari Libur Nasional dan Cuti Bersama Tahun 2026:
            </p>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {[
                { date: '1 Januari 2026', name: 'Tahun Baru 2026 Masehi' },
                { date: '16 Januari 2026', name: 'Isra Mikraj Nabi Muhammad SAW' },
                { date: '17 Februari 2026', name: 'Tahun Baru Imlek 2577 Kongzili' },
                { date: '21 - 22 Maret 2026', name: 'Hari Raya Idul Fitri 1447 Hijriah' },
                { date: '23 - 25 Maret 2026', name: 'Cuti Bersama Idul Fitri 1447 H' },
                { date: '1 Mei 2026', name: 'Hari Buruh Internasional' },
                { date: '14 Mei 2026', name: 'Kenaikan Yesus Kristus' },
                { date: '28 Mei 2026', name: 'Hari Raya Idul Adha 1447 Hijriah' },
                { date: '1 Juni 2026', name: 'Hari Lahir Pancasila' },
                { date: '17 Juni 2026', name: 'Tahun Baru Islam 1448 Hijriah' },
                { date: '17 Agustus 2026', name: 'Hari Kemerdekaan RI Ke-81' },
                { date: '25 Agustus 2026', name: 'Maulid Nabi Muhammad SAW' },
                { date: '25 Desember 2026', name: 'Hari Raya Natal' }
              ].map((h, i) => (
                <div key={i} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{h.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {h.date}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowHariLiburModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs shrink-0 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </Modal>
      )}

      {/* ===================== MODAL PERINGATAN PULANG SEBELUM WAKTUNYA (PSW) ===================== */}
      {showEarlyCheckOutWarningModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowEarlyCheckOutWarningModal(false)}
          title="Peringatan: Pulang Sebelum Waktunya (PSW)"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            {/* Header Alert Visual */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-start gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-md">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="font-extrabold text-sm text-amber-950 block">
                  Perhatian: Jam Kerja Belum Selesai!
                </span>
                <p className="text-[11.5px] text-amber-900 leading-relaxed">
                  Anda sedang berupaya melakukan presensi pulang sebelum jam dinas resmi berakhir. Kepulangan sebelum waktunya memiliki konsekuensi administratif terhadap kehadiran dan tunjangan kinerja.
                </p>
              </div>
            </div>

            {/* Time Breakdown Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10.5px] text-slate-500 block font-medium">Waktu Sekarang (WIB)</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span className="font-mono font-extrabold text-sm text-slate-900">{liveWibTime || 'Sekarang'}</span>
                </div>
              </div>

              <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-200 space-y-1">
                <span className="text-[10.5px] text-amber-800 block font-medium">Jadwal Pulang Wajib</span>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <span className="font-mono font-extrabold text-sm text-amber-950">{jamPulangWajibStr} WIB</span>
                </div>
              </div>
            </div>

            {/* Early Duration Badge */}
            <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-rose-950 flex items-center justify-between">
              <span className="font-semibold text-[11px] text-rose-900">Selisih Pulang Lebih Awal:</span>
              <span className="font-bold text-xs font-mono bg-white px-2.5 py-1 rounded-xl border border-rose-300 text-rose-800 shadow-2xs">
                {Math.floor(remainingMins / 60) > 0 ? `${Math.floor(remainingMins / 60)} Jam ` : ''}{remainingMins % 60} Menit Lebih Awal
              </span>
            </div>

            {/* Detail Regulasi & Konsekuensi */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-[11px] text-slate-700">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-teal-700" />
                Ketentuan & Konsekuensi Kedisiplinan:
              </span>
              <ul className="space-y-1.5 list-disc list-inside text-slate-600 pl-0.5 leading-relaxed">
                {lateMinutes > 0 ? (
                  <li>
                    Karena Anda terlambat <strong className="text-slate-800">{lateMinutes} menit</strong> pagi ini, Anda memiliki kewajiban mengganti jam kerja hingga pukul <strong className="text-slate-800">{jamPulangWajibStr} WIB</strong>.
                  </li>
                ) : (
                  <li>
                    Jadwal kepulangan normal dinas kantor KPU Kota Sungai Penuh adalah pukul <strong className="text-slate-800">{schedOutStr} WIB</strong>.
                  </li>
                )}
                <li>
                  Presensi ini dikategorikan sebagai <strong className="text-rose-700">Pulang Sebelum Waktu (PSW)</strong> dan dikenakan <strong className="text-rose-700">pemotongan Tunjangan Kinerja (Tukin)</strong>.
                </li>
                <li>
                  Data kepulangan lebih awal akan direkam secara transparan pada log audit presensi dan rekapitulasi kehadiran bulanan.
                </li>
              </ul>
            </div>

            {/* Checkbox Persetujuan Konfirmasi */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200">
              <label className="flex items-start gap-2.5 text-[11px] font-semibold text-amber-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={earlyCheckOutConsent}
                  onChange={e => setEarlyCheckOutConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                />
                <span className="leading-snug">
                  Saya memahami bahwa saya melakukan presensi sebelum jam kerja berakhir dan bersedia menerima konsekuensi pemotongan Tukin dan catatan kedisiplinan.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEarlyCheckOutWarningModal(false)}
                className="w-full py-3 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-[0.99]"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Batalkan & Tetap Bekerja (Disarankan)</span>
              </button>

              <button
                type="button"
                disabled={!earlyCheckOutConsent}
                onClick={() => {
                  setShowEarlyCheckOutWarningModal(false);
                  openAbsenModal('OUT', true);
                }}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                  earlyCheckOutConsent
                    ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer'
                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-70'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Tetap Lanjutkan Presensi Pulang Lebih Awal</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ===================== MODAL ABSENSI SELFIE & GPS ===================== */}
      {showAbsenModal && (
        <Modal
          isOpen={true}
          onClose={closeAbsenModal}
          title={
            absenStep === 'map'
              ? absenType === 'IN'
                ? 'Langkah 1/2: Verifikasi Peta & Radius Presensi Masuk'
                : 'Langkah 1/2: Verifikasi Peta & Radius Presensi Pulang'
              : absenType === 'IN'
              ? 'Langkah 2/2: Swafoto Presensi Masuk'
              : 'Langkah 2/2: Swafoto Presensi Pulang'
          }
          maxWidth="max-w-md"
        >
          <div className="space-y-3.5 text-xs">
            {/* Step progress tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setAbsenStep('map');
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-center font-bold text-[11px] transition-all cursor-pointer ${
                  absenStep === 'map'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Peta & Jarak Radius
              </button>
              <button
                type="button"
                onClick={handleProceedToCamera}
                className={`flex-1 py-1.5 px-2 rounded-lg text-center font-bold text-[11px] transition-all cursor-pointer ${
                  absenStep === 'camera'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Foto Selfie & Kirim
              </button>
            </div>

            {absenError && (
              <div className="p-2.5 bg-red-100 border border-red-200 text-red-700 rounded-xl font-medium text-[11px]">
                {absenError}
              </div>
            )}

            {/* STEP 1: INTERACTIVE MAP PREVIEW */}
            {absenStep === 'map' ? (
              <div className="space-y-3">
                {absenType === 'OUT' && currentWibMinutes < requiredOutMinutes && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] space-y-0.5">
                      <span className="font-bold block text-amber-950">
                        Peringatan: Presensi Pulang Sebelum Waktunya (PSW)
                      </span>
                      <p className="text-amber-800 leading-relaxed text-[10.5px]">
                        Target jam kepulangan resmi Anda adalah <strong>{jamPulangWajibStr} WIB</strong>. Anda melakukan presensi lebih awal <strong>{Math.floor(remainingMins / 60) > 0 ? `${Math.floor(remainingMins / 60)} jam ` : ''}{remainingMins % 60} menit</strong>. Presensi ini akan dikenakan pemotongan Tukin.
                      </p>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Sistem SITENANG memverifikasi posisi Anda terhadap kantor KPU Kota Sungai Penuh. Pastikan Anda berada dalam radius sebelum melanjutkan.
                </p>

                {/* The Interactive Map Component */}
                <AttendanceMapPreview
                  userCoords={currentCoords}
                  officeLocation={officeLocation}
                  distanceFromOffice={distanceFromOffice}
                  isInsideRadius={isInsideRadius}
                  isLocating={isLocating}
                  onRefreshLocation={requestLocation}
                  height="260px"
                />

                {/* Status Guidance Card */}
                {isInsideRadius ? (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="text-[11px]">
                      <span className="font-bold block">Lokasi Memenuhi Syarat Presensi</span>
                      <span className="text-emerald-800">
                        Anda berada dalam radius {officeLocation?.radius_meter || 150} meter dari kantor KPU ({distanceFromOffice ?? 0}m). Silakan lanjutkan ke langkah berikutnya untuk pengambilan foto selfie.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-[11px]">
                      <span className="font-bold block text-amber-950">
                        Perhatian: Anda Berada di Luar Radius ({distanceFromOffice ?? '?'}m)
                      </span>
                      <span className="text-amber-800">
                        Batas radius kantor KPU adalah {officeLocation?.radius_meter || 150}m. Pada langkah berikutnya, Anda wajib mengisi formulir alasan kendala di perjalanan untuk diverifikasi oleh Admin/SDM.
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons for Step 1 */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={closeAbsenModal}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToCamera}
                    className="flex-1 py-2.5 px-4 bg-linear-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7] hover:brightness-105 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <span>Lanjut ke Foto Selfie</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 2: CAMERA & SUBMISSION */
              <div className="space-y-3.5">
                {/* Back to Map Button & GPS Mini-status */}
                <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-[11px]">
                  <button
                    type="button"
                    onClick={handleBackToMap}
                    className="flex items-center gap-1 text-teal-800 font-bold hover:text-teal-900 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Lihat Peta Lagi</span>
                  </button>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className="text-slate-600">Jarak: <strong>{distanceFromOffice ?? '?'} m</strong></span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        isInsideRadius ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isInsideRadius ? 'Dalam Radius' : 'Luar Radius'}
                    </span>
                  </div>
                </div>

                {/* Form Tambahan Alasan Absensi Luar Radius (Wajib bila di luar radius kantor) */}
                {!isInsideRadius && assignedMethod === 'WFO' && (
                  <div className="p-3.5 bg-red-50/90 rounded-2xl border-2 border-red-300 space-y-2.5">
                    <div className="flex items-start gap-2.5 text-red-950">
                      <div className="w-7 h-7 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold block text-xs">
                          Peringatan: Di Luar Radius Kantor KPU ({distanceFromOffice ?? '?'}m)
                        </span>
                        <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
                          Anda berada di luar radius kantor KPU Kota Sungai Penuh (Maks {officeLocation?.radius_meter || 150}m). <strong>Presensi biasa tidak diizinkan.</strong>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-red-200">
                      <label className="text-[11px] font-bold text-red-950 block">
                        Formulir Alasan Kendala / Halangan di Perjalanan <span className="text-red-600">* (Wajib Diisi)</span>:
                      </label>
                      <textarea
                        value={emergencyReason}
                        onChange={e => setEmergencyReason(e.target.value)}
                        placeholder="Wajib jelaskan kendala darurat (contoh: terjebak macet pohon tumbang di jalan, kendaraan dinas mogok, dsb)..."
                        rows={3}
                        className="w-full p-2.5 bg-white border-2 border-red-300 focus:border-red-600 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-red-500 outline-hidden transition shadow-2xs"
                      />
                      {emergencyReason.trim().length > 0 && emergencyReason.trim().length < 5 ? (
                        <p className="text-[10px] text-red-600 font-semibold">
                          * Alasan minimal 5 karakter (saat ini: {emergencyReason.trim().length} karakter).
                        </p>
                      ) : (
                        <p className="text-[10px] text-red-700 italic">
                          * Data presensi dan alasan ini akan diverifikasi oleh Admin/SDM sebelum disetujui resmi.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Camera view / Captured Photo preview */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 flex items-center justify-center border border-slate-800 shadow-inner">
                  {selfiePhoto ? (
                    <div className="relative w-full h-full">
                      <img src={selfiePhoto} alt="Selfie" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setSelfiePhoto(null);
                          startCamera();
                        }}
                        className="absolute top-3 right-3 px-3 py-1.5 bg-slate-900/80 text-white rounded-xl text-[11px] font-semibold backdrop-blur-xs hover:bg-slate-900 transition-colors"
                      >
                        Foto Ulang
                      </button>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {/* Oval Face Guide Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-60 border-2 border-teal-400/80 border-dashed rounded-[50%] flex items-center justify-center">
                          <span className="text-[10px] text-teal-200 bg-slate-900/70 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                            Posisikan Wajah Di Sini
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Action button inside Camera sheet */}
                {!selfiePhoto ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="w-full py-3 bg-linear-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7] hover:brightness-105 text-white font-bold rounded-2xl shadow-md text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <Camera className="w-4 h-4 text-sky-200" />
                      <span>Ambil Foto Selfie Presensi</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <label className="py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-[11px] flex items-center justify-center gap-1.5 cursor-pointer text-center">
                        <Smartphone className="w-3.5 h-3.5 text-teal-700" />
                        <span>Kamera HP / Berkas</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateSystemPhoto}
                        className="py-2 px-3 bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-900 font-semibold rounded-xl text-[11px] flex items-center justify-center gap-1.5 cursor-pointer text-center"
                      >
                        <ScanFace className="w-3.5 h-3.5 text-teal-700" />
                        <span>Verifikasi Sistem</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {absenType === 'OUT' && (currentWibMinutes < requiredOutMinutes || (replacementInfo && !replacementInfo.isFulfilled)) && (
                      <div className="p-3 bg-amber-50 rounded-2xl border-2 border-amber-300 text-amber-950 text-[11px] space-y-2 shadow-2xs">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block text-xs text-amber-950">
                              Konsekuensi Pulang Sebelum Waktu (PSW):
                            </span>
                            <p className="leading-relaxed text-[10.5px] text-amber-800 mt-0.5">
                              Anda pulang sebelum batas jam kerja ({jamPulangWajibStr} WIB), kurang <strong>{Math.floor(remainingMins / 60) > 0 ? `${Math.floor(remainingMins / 60)} jam ` : ''}{remainingMins % 60} menit</strong>. Tunjangan Kinerja (Tukin) akan dikenakan pemotongan.
                            </p>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 pt-1 font-semibold text-[11px] text-amber-950 cursor-pointer bg-white/80 p-2 rounded-xl border border-amber-300">
                          <input
                            type="checkbox"
                            checked={tukinConsentChecked}
                            onChange={e => setTukinConsentChecked(e.target.checked)}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <span>Saya memahami dan menyetujui pemotongan Tukin</span>
                        </label>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSubmitAttendance}
                      className="w-full py-3 bg-linear-to-r from-[#064E3B] via-[#0D766E] to-[#0284C7] hover:brightness-105 text-white font-bold rounded-2xl shadow-md text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4 text-sky-200" />
                      <span>
                        {isSubmitting
                          ? 'Mengirim Presensi...'
                          : absenType === 'IN'
                          ? 'Kirim Presensi Masuk'
                          : 'Kirim Presensi Pulang'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ===================== TOAST & MODAL KONFIRMASI INSTAN ===================== */}
      <AttendanceToast
        toast={toastMessage}
        onDismiss={() => setToastMessage(null)}
      />

      <AttendanceSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        data={successAttendanceData}
      />

      {/* ===================== MODAL GPS WAJIB AKTIF ===================== */}
      {showGpsMandatoryModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowGpsMandatoryModal(false)}
          title="Peringatan: Sensor GPS Wajib Aktif"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <MapPin className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h4 className="font-bold text-red-950 text-sm">
                  Sensor GPS Belum Aktif / Terdeteksi
                </h4>
                <p className="text-[11px] text-red-800 leading-relaxed">
                  Sesuai ketentuan absensi KPU Kota Sungai Penuh, setiap pegawai <strong>diwajibkan menghidupkan GPS perangkat</strong> dan mengizinkan akses lokasi pada browser/HP sebelum melakukan presensi.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-slate-700">
              <span className="font-bold block text-[11px] text-slate-900">
                Langkah Mengaktifkan GPS & Lokasi:
              </span>
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px]">
                <li>Nyalakan tombol <strong>Lokasi / GPS</strong> di bar notifikasi ponsel Anda.</li>
                <li>Pada kotak dialog izin browser, pilih <strong>"Izinkan" / "Allow"</strong> akses lokasi.</li>
                <li>Jika berada di dalam gedung tebal, mendekatlah ke jendela agar sinyal GPS terdeteksi.</li>
                <li>Setelah GPS dinyalakan, klik tombol <strong>"Aktifkan & Deteksi Ulang GPS"</strong> di bawah.</li>
              </ol>
            </div>

            {gpsError && (
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-300 text-amber-900 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Keterangan Sensor:</span>
                </div>
                <p className="leading-relaxed">{gpsError}</p>
              </div>
            )}

            {/* Alternatif Presensi di Kantor KPU jika GPS browser terblokir / error */}
            <div className="p-3.5 bg-teal-50/95 rounded-2xl border-2 border-teal-300 space-y-2 text-teal-950">
              <div className="flex items-center gap-2 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                <span>Solusi Langsung: Hadir di Kantor KPU Kota Sungai Penuh</span>
              </div>
              <p className="text-[11px] text-teal-900 leading-relaxed">
                Jika peramban Anda memblokir izin akses lokasi atau perangkat/laptop Anda tidak memiliki sensor satelit GPS, namun Anda <strong>sudah berada di lingkungan Kantor KPU Kota Sungai Penuh</strong>, Anda dapat langsung menetapkan koordinat area kantor di bawah untuk segera melanjutkan presensi.
              </p>
              <button
                type="button"
                onClick={() => handleUseOfficeLocation()}
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                <span>Tetapkan Titik Kantor KPU & Lanjutkan Presensi</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setPendingAbsenType(null);
                  setShowGpsMandatoryModal(false);
                }}
                className="px-3.5 py-2 font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer text-xs"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => requestLocation()}
                disabled={isLocating}
                className="px-3.5 py-2 font-bold text-slate-700 hover:text-slate-900 bg-slate-200 hover:bg-slate-300 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Mendeteksi...' : 'Coba Deteksi Ulang GPS'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleUseOfficeLocation()}
                className="px-4 py-2 font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Gunakan Titik Kantor</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
