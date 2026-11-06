import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api, setApiToken, getApiToken } from '../services/api';
import { authenticateWithBiometrics } from '../services/biometricService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  loading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<User>;
  loginWithBiometrics: (usernameHint?: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchRole: (targetRole: string) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getApiToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkAuth() {
      const storedToken = getApiToken();
      if (storedToken) {
        try {
          const res = await api.getCurrentUser();
          setUser(res.user);
        } catch (err) {
          console.warn('Session expired or invalid:', err);
          setApiToken(null);
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    }
    checkAuth();

    const handleExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:session_expired', handleExpired);
    return () => window.removeEventListener('auth:session_expired', handleExpired);
  }, []);

  const login = async (username: string, password: string, rememberMe: boolean = false) => {
    const res = await api.login({ username, password });
    setApiToken(res.token, rememberMe);
    setToken(res.token);
    setUser(res.user);

    // Save user profile for saved account recognition on login screen
    try {
      localStorage.setItem(
        'sitenang_saved_account',
        JSON.stringify({
          username: res.user.username,
          namaLengkap: res.user.namaLengkap || res.user.nama_lengkap || res.user.username,
          role: res.user.role,
          nipNik: res.user.nipNik || res.user.nip_nik || '',
          fotoProfil: res.user.fotoProfil || res.user.foto_profil || '',
          jabatan: res.user.jabatan || '',
          unitKerja: res.user.unitKerja || res.user.unit_kerja || ''
        })
      );
    } catch (_) {}

    return res.user;
  };

  const loginWithBiometrics = async (usernameHint?: string) => {
    const res = await authenticateWithBiometrics(usernameHint);
    if (!res.success || !res.token || !res.user) {
      throw new Error(res.message || 'Verifikasi biometrik gagal.');
    }
    setApiToken(res.token, true);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.warn('Logout API error:', e);
    }
    setApiToken(null);
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await api.getCurrentUser();
      setUser(res.user);
    } catch (e) {
      console.warn('Failed to refresh user:', e);
    }
  };

  const switchRole = async (targetRole: string) => {
    const res = await api.switchRole(targetRole);
    setUser(res.user);
    return res.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        loading: isLoading,
        login,
        loginWithBiometrics,
        logout,
        refreshUser,
        switchRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
