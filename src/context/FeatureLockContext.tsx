import React, { createContext, useContext, useState, useEffect } from 'react';
import { FeatureLock } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { saveFeatureLockToFirestore } from '../firebase';

interface FeatureLockContextType {
  features: FeatureLock[];
  loading: boolean;
  adminBypassList: string[];
  toggleAdminBypass: (featureId: string) => void;
  clearAdminBypass: (featureId?: string) => void;
  refreshFeatures: () => Promise<void>;
  isFeatureLocked: (featureId: string) => boolean;
  isFeatureLockedInSystem: (featureId: string) => boolean;
  getFeature: (featureId: string) => FeatureLock | undefined;
  updateFeatureStatus: (id: string, updates: Partial<FeatureLock>) => Promise<void>;
}

const FeatureLockContext = createContext<FeatureLockContextType | undefined>(undefined);

export const FeatureLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [features, setFeatures] = useState<FeatureLock[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [adminBypassList, setAdminBypassList] = useState<string[]>([]);

  const refreshFeatures = async () => {
    try {
      setLoading(true);
      const res = await api.getFeatures();
      setFeatures(res.features || []);
    } catch (err) {
      console.warn('Could not fetch feature locks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshFeatures();
    }
  }, [user?.id]);

  const toggleAdminBypass = (featureId: string) => {
    if (user?.role !== 'admin') return;
    setAdminBypassList(prev =>
      prev.includes(featureId) ? prev.filter(id => id !== featureId) : [...prev, featureId]
    );
  };

  const clearAdminBypass = (featureId?: string) => {
    if (featureId) {
      setAdminBypassList(prev => prev.filter(id => id !== featureId));
    } else {
      setAdminBypassList([]);
    }
  };

  const getFeature = (featureId: string) => {
    return features.find(f => f.id === featureId);
  };

  const isFeatureLockedInSystem = (featureId: string): boolean => {
    const feature = features.find(f => f.id === featureId);
    return Boolean(feature?.is_locked);
  };

  /**
   * Evaluates if a feature is currently restricted for the active user.
   */
  const isFeatureLocked = (featureId: string): boolean => {
    if (!user) return false;
    const role = user.role;

    const feature = features.find(f => f.id === featureId);
    if (!feature || !feature.is_locked) {
      return false;
    }

    // If this feature has been explicitly bypassed in this session by an Administrator Utama
    if (role === 'admin' && adminBypassList.includes(featureId)) {
      return false;
    }

    // 1. If locked for everyone (Maintenance mode total): Everyone is blocked, including admin
    if (feature.locked_for === 'everyone') {
      return true;
    }

    // 2. Regular employee: any active lock blocks them
    if (role === 'pegawai') {
      return true;
    }

    // 3. Operators (SDM, Keuangan, Umum): blocked if locked_for is all_non_admin or everyone
    if (role.startsWith('operator_')) {
      if (feature.locked_for === 'all_non_admin') {
        return true;
      }
      return false;
    }

    // 4. Admin:
    // If locked_for is 'all_non_admin', show the lock screen so the admin verifies the lock is working!
    // The admin can easily click "Masuk / Pratinjau Sebagai Admin" to bypass and enter.
    if (role === 'admin') {
      if (feature.locked_for === 'all_non_admin') {
        return true;
      }
      return false;
    }

    return false;
  };

  const updateFeatureStatus = async (id: string, updates: Partial<FeatureLock>) => {
    if (updates.is_locked) {
      // Remove from bypass list so the lock takes immediate visual effect
      setAdminBypassList(prev => prev.filter(item => item !== id));
    }
    // Optimistically update local state for instant responsiveness
    setFeatures(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));
    await api.updateFeature(id, updates);
    saveFeatureLockToFirestore(id, updates).catch(err =>
      console.warn('Firestore feature lock sync warning:', err)
    );
    await refreshFeatures();
  };

  return (
    <FeatureLockContext.Provider
      value={{
        features,
        loading,
        adminBypassList,
        toggleAdminBypass,
        clearAdminBypass,
        refreshFeatures,
        isFeatureLocked,
        isFeatureLockedInSystem,
        getFeature,
        updateFeatureStatus
      }}
    >
      {children}
    </FeatureLockContext.Provider>
  );
};

export const useFeatureLock = (): FeatureLockContextType => {
  const context = useContext(FeatureLockContext);
  if (!context) {
    throw new Error('useFeatureLock must be used within a FeatureLockProvider');
  }
  return context;
};
