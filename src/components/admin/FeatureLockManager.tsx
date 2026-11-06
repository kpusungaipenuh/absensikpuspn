import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Eye,
  Edit3,
  Save,
  Info,
  Search,
  Check,
  Filter
} from 'lucide-react';
import { FeatureLock } from '../../types';
import { useFeatureLock } from '../../context/FeatureLockContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Modal } from '../Modal';

export const FeatureLockManager: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { features, loading, refreshFeatures, updateFeatureStatus } = useFeatureLock();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit Modal State
  const [editingFeature, setEditingFeature] = useState<FeatureLock | null>(null);
  const [editFormData, setEditFormData] = useState({
    is_locked: false,
    locked_for: 'all_non_admin' as 'all_non_admin' | 'pegawai_only' | 'everyone',
    release_estimate: '',
    maintenance_message: ''
  });

  const categories = ['all', ...Array.from(new Set(features.map(f => f.category)))];

  const filteredFeatures = features.filter(feature => {
    const matchesCategory = selectedCategory === 'all' || feature.category === selectedCategory;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'locked' && feature.is_locked) ||
      (statusFilter === 'unlocked' && !feature.is_locked);
    const matchesSearch =
      searchQuery.trim() === '' ||
      feature.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feature.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feature.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (feature.description && feature.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesStatus && matchesSearch;
  });

  const totalCount = features.length;
  const lockedCount = features.filter(f => f.is_locked).length;
  const activeCount = totalCount - lockedCount;

  const handleQuickToggle = async (feature: FeatureLock) => {
    try {
      setUpdatingId(feature.id);
      const newStatus = !feature.is_locked;
      await updateFeatureStatus(feature.id, {
        is_locked: newStatus,
        locked_for: feature.locked_for || 'all_non_admin'
      });
      setSuccessMessage(
        `Fitur "${feature.name}" berhasil ${newStatus ? 'DIKUNCI' : 'DIBUKA AKSESNYA'}.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memperbarui status fitur.');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenEditModal = (feature: FeatureLock) => {
    setEditingFeature(feature);
    setEditFormData({
      is_locked: Boolean(feature.is_locked),
      locked_for: feature.locked_for || 'all_non_admin',
      release_estimate: feature.release_estimate || '',
      maintenance_message: feature.maintenance_message || ''
    });
  };

  const handleApplyMessageTemplate = (templateMsg: string, estimate: string) => {
    setEditFormData(prev => ({
      ...prev,
      maintenance_message: templateMsg,
      release_estimate: estimate
    }));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeature) return;

    try {
      setUpdatingId(editingFeature.id);
      await updateFeatureStatus(editingFeature.id, {
        is_locked: editFormData.is_locked,
        locked_for: editFormData.locked_for,
        release_estimate: editFormData.release_estimate,
        maintenance_message: editFormData.maintenance_message
      });
      setSuccessMessage(`Pengaturan rilis & kunci fitur "${editingFeature.name}" berhasil disimpan.`);
      setEditingFeature(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan pengaturan fitur.');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBatchUnlockAll = async () => {
    if (!window.confirm('Apakah Anda yakin ingin MEMBUKA SEMUA fitur sistem untuk seluruh pengguna?')) {
      return;
    }
    try {
      await api.batchToggleFeatures({ lock_all: false });
      await refreshFeatures();
      setSuccessMessage('Semua fitur sistem berhasil dibuka aksesnya.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuka semua fitur.');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="bg-white p-8 rounded-2xl border border-red-200 shadow-sm">
          <div className="w-14 h-14 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            Akses Dibatasi — Khusus Administrator Utama
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Sesuai dengan kebijakan sistem, hak untuk <strong>mengunci</strong> atau <strong>membuka kunci fitur</strong> adalah wewenang eksklusif <strong>Administrator Utama</strong> KPU Kota Sungai Penuh. Operator (SDM, Keuangan, Umum) tidak memiliki hak akses untuk mengubah status penguncian fitur.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            <Shield className="w-4 h-4 text-amber-600" />
            Hubungi Administrator Utama untuk permintaan aktivasi / pembukaan fitur.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-red-950 text-white p-6 rounded-2xl shadow-sm border border-slate-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-red-800/80 text-red-100 border border-red-700/50 mb-2">
              <Shield className="w-3.5 h-3.5" />
              Wewenang Eksklusif: Administrator Utama
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Manajemen Kunci Fitur & Kesiapan Rilis
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Hanya Administrator Utama yang berhak mengunci dan membuka fitur sistem KPU Kota Sungai Penuh. Modul yang dikunci akan dibatasi aksesnya dari pegawai maupun operator sesuai sasaran yang ditetapkan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshFeatures}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Segarkan
            </button>
            <button
              type="button"
              onClick={handleBatchUnlockAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              Buka Semua Fitur
            </button>
          </div>
        </div>

        {/* Counter Cards */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-700/60 text-xs">
          <div
            onClick={() => setStatusFilter('all')}
            className={`rounded-xl p-3 border transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800 border-red-500/80 ring-1 ring-red-500'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <span className="text-slate-400 block text-[11px]">Total Seluruh Fitur</span>
            <span className="text-lg font-bold text-white">{totalCount} Fitur</span>
          </div>

          <div
            onClick={() => setStatusFilter('locked')}
            className={`rounded-xl p-3 border transition-all cursor-pointer ${
              statusFilter === 'locked'
                ? 'bg-amber-950/80 border-amber-400 ring-1 ring-amber-400'
                : 'bg-amber-950/40 border-amber-800/50 hover:bg-amber-950/60'
            }`}
          >
            <span className="text-amber-300 block text-[11px] font-medium flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-400" />
              Sedang Terkunci
            </span>
            <span className="text-lg font-bold text-amber-400">{lockedCount} Fitur</span>
          </div>

          <div
            onClick={() => setStatusFilter('unlocked')}
            className={`rounded-xl p-3 border transition-all cursor-pointer ${
              statusFilter === 'unlocked'
                ? 'bg-emerald-950/80 border-emerald-400 ring-1 ring-emerald-400'
                : 'bg-emerald-950/40 border-emerald-800/50 hover:bg-emerald-950/60'
            }`}
          >
            <span className="text-emerald-300 block text-[11px] font-medium flex items-center gap-1">
              <Unlock className="w-3 h-3 text-emerald-400" />
              Aktif & Terbuka
            </span>
            <span className="text-lg font-bold text-emerald-400">{activeCount} Fitur</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold ml-4">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-700 hover:text-red-900 text-xs font-bold ml-4">✕</button>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari fitur, menu, atau ID..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50/50"
            />
          </div>

          {/* Quick status tabs */}
          <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto overflow-x-auto">
            <span className="text-slate-400 text-[11px] font-medium mr-1 hidden md:inline">Status:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('locked')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === 'locked'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Lock className="w-3 h-3" />
              Terkunci ({lockedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unlocked')}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === 'unlocked'
                  ? 'bg-emerald-700 text-white font-semibold'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <Unlock className="w-3 h-3" />
              Aktif ({activeCount})
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 scrollbar-none text-xs">
          <span className="text-slate-400 text-[11px] font-medium mr-1 shrink-0">Kategori:</span>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer text-xs ${
                selectedCategory === cat
                  ? 'bg-red-700 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? 'Semua Kategori' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFeatures.map(feature => {
          const isUpdating = updatingId === feature.id;
          return (
            <div
              key={feature.id}
              className={`rounded-2xl p-5 border transition-all ${
                feature.is_locked
                  ? 'bg-amber-50/50 border-amber-300 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        feature.is_locked
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {feature.is_locked ? (
                        <>
                          <Lock className="w-3 h-3 text-amber-700" />
                          Terkunci
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3 text-emerald-700" />
                          Aktif / Terbuka
                        </>
                      )}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {feature.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-sm">{feature.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Switch Toggle Button */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuickToggle(feature)}
                    disabled={isUpdating}
                    title={feature.is_locked ? 'Klik untuk membuka kunci fitur' : 'Klik untuk mengunci fitur'}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      feature.is_locked ? 'bg-amber-500 ring-2 ring-amber-300' : 'bg-slate-300 hover:bg-slate-400'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        feature.is_locked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-[10px] font-bold text-slate-400">
                    {feature.is_locked ? 'Terkunci' : 'Terbuka'}
                  </span>
                </div>
              </div>

              {/* Status Details / Notice info */}
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-400">Sasaran Pembatasan:</span>
                  <span className="font-semibold text-slate-700">
                    {feature.locked_for === 'everyone'
                      ? 'Seluruh Pengguna (Perawatan Total)'
                      : feature.locked_for === 'pegawai_only'
                      ? 'Khusus Pegawai (Admin & Operator Bisa Akses)'
                      : 'Pegawai & Operator (Hanya Admin)'}
                  </span>
                </div>

                {feature.release_estimate && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400">Estimasi Rilis:</span>
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {feature.release_estimate}
                    </span>
                  </div>
                )}

                {feature.is_locked && feature.maintenance_message && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-100/70 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                    <div className="font-semibold mb-0.5 flex items-center gap-1 text-amber-800">
                      <Info className="w-3 h-3" />
                      Pesan Pemberitahuan untuk Pengguna:
                    </div>
                    <span>{feature.maintenance_message}</span>
                  </div>
                )}
              </div>

              {/* Bottom Actions with prominent Toggle Button */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 font-mono">
                  ID: {feature.id}
                </span>

                <div className="flex items-center gap-2">
                  {/* Big clear Action Button */}
                  <button
                    type="button"
                    onClick={() => handleQuickToggle(feature)}
                    disabled={isUpdating}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs ${
                      feature.is_locked
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    {isUpdating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : feature.is_locked ? (
                      <Unlock className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    {feature.is_locked ? 'Buka Kunci' : 'Kunci Fitur'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(feature)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                    Atur
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredFeatures.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Tidak ada fitur yang cocok dengan filter.</p>
          <p className="text-xs text-slate-400 mt-1">Coba ganti kata kunci pencarian atau pilih kategori lain.</p>
        </div>
      )}

      {/* Edit Feature Modal */}
      {editingFeature && (
        <Modal
          isOpen={true}
          onClose={() => setEditingFeature(null)}
          title={`Pengaturan Rilis & Kunci: ${editingFeature.name}`}
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
              <span className="font-bold block text-slate-800 text-sm mb-1">{editingFeature.name}</span>
              <p>{editingFeature.description}</p>
            </div>

            {/* Lock Status Switch */}
            <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
              editFormData.is_locked
                ? 'bg-amber-50 border-amber-300'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className="font-bold text-slate-800 block text-xs">
                  {editFormData.is_locked ? 'Status: FITUR DIKUNCI' : 'Status: FITUR DIBUKA'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {editFormData.is_locked
                    ? 'Pengguna tidak dapat menggunakan menu ini sampai dibuka kembali.'
                    : 'Fitur aktif normal dan dapat digunakan oleh pengguna yang berhak.'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={editFormData.is_locked}
                onChange={e => setEditFormData({ ...editFormData, is_locked: e.target.checked })}
                className="w-5 h-5 text-amber-600 rounded-md border-slate-300 focus:ring-amber-500 cursor-pointer"
              />
            </div>

            {/* Target Restriction */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sasaran Pembatasan Akses:
              </label>
              <select
                value={editFormData.locked_for}
                onChange={e =>
                  setEditFormData({
                    ...editFormData,
                    locked_for: e.target.value as any
                  })
                }
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-red-600 font-medium"
              >
                <option value="all_non_admin">
                  Pegawai & Operator (Hanya Administrator yang dapat melihat pratinjau)
                </option>
                <option value="pegawai_only">
                  Khusus Pegawai Saja (Admin & Operator masih dapat mengakses modul)
                </option>
                <option value="everyone">
                  Semua Pengguna (Mode Perawatan Total / Under Construction)
                </option>
              </select>
            </div>

            {/* Release Estimate */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Estimasi Jadwal Rilis / Status Kesiapan:
              </label>
              <input
                type="text"
                value={editFormData.release_estimate}
                onChange={e => setEditFormData({ ...editFormData, release_estimate: e.target.value })}
                placeholder="Contoh: Q4 2026, Menunggu Verifikasi Data, Segera Hadir"
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-red-600"
              />
            </div>

            {/* Template Buttons */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Gunakan Templat Alasan Cepat:
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    handleApplyMessageTemplate(
                      'Modul ini sedang dalam tahap validasi dan pengujian teknis internal oleh KPU Kota Sungai Penuh.',
                      'Tahap Pengujian Internal'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] cursor-pointer"
                >
                  Pengujian Internal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyMessageTemplate(
                      'Layanan ini dinonaktifkan sementara untuk penyesuaian aturan dan regulasi terbaru.',
                      'Segera Hadir'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] cursor-pointer"
                >
                  Penyesuaian Regulasi
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleApplyMessageTemplate(
                      'Sedang dilakukan sinkronisasi data master kepegawaian berkala.',
                      'Pemeliharaan Sistem'
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] cursor-pointer"
                >
                  Sinkronisasi Data
                </button>
              </div>
            </div>

            {/* Custom Maintenance Message */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pesan Pemberitahuan untuk Pengguna saat Fitur Diklik:
              </label>
              <textarea
                rows={3}
                value={editFormData.maintenance_message}
                onChange={e => setEditFormData({ ...editFormData, maintenance_message: e.target.value })}
                placeholder="Tulis pesan alasan mengapa fitur belum dapat digunakan..."
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-red-600 leading-relaxed"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Pesan ini akan tampil di layar saat pengguna mengklik menu yang terkunci.
              </span>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingFeature(null)}
                className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={updatingId !== null}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-white bg-red-700 hover:bg-red-800 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Simpan Perubahan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

