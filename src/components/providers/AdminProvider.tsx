'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type UserRole = 'user' | 'admin';

export type SettingsTab = 'display' | 'admin';

export type AdminPanelView = 'status' | 'login';

interface AuthMeResponse {
  authenticated?: boolean;
  isAdmin?: boolean;
  role?: UserRole | null;
  username?: string | null;
}

interface AdminContextValue {
  authenticated: boolean;
  isAdmin: boolean;
  role: UserRole | null;
  username: string | null;
  authLoading: boolean;
  authError: string | null;
  settingsOpen: boolean;
  settingsTab: SettingsTab;
  adminPanel: AdminPanelView;
  login: (
    username: string,
    password: string,
  ) => Promise<{ ok: boolean; message: string }>;
  logout: () => Promise<void>;
  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setSettingsTab: (tab: SettingsTab) => void;
  setAdminPanel: (view: AdminPanelView) => void;
  refreshAuth: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

async function fetchMe(): Promise<AuthMeResponse> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    return { authenticated: false, isAdmin: false, role: null, username: null };
  }
  return (await res.json()) as AuthMeResponse;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('display');
  const [adminPanel, setAdminPanel] = useState<AdminPanelView>('status');

  const refreshAuth = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setAuthLoading(true);
    setAuthError(null);
    try {
      const data = await fetchMe();
      const ok = Boolean(data.authenticated);
      setAuthenticated(ok);
      if (ok && (data.role === 'admin' || data.role === 'user')) {
        setRole(data.role);
        setUsername(data.username ?? null);
      } else {
        setRole(null);
        setUsername(null);
      }
    } catch {
      setAuthError('권한 정보를 불러오지 못했습니다.');
      setAuthenticated(false);
      setRole(null);
      setUsername(null);
    } finally {
      if (!options?.silent) setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    const onFocus = () => {
      void refreshAuth({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshAuth]);

  const login = useCallback(
    async (
      usernameInput: string,
      password: string,
    ): Promise<{ ok: boolean; message: string }> => {
      setAuthError(null);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usernameInput,
            password,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { message?: string }
            | null;
          const message =
            body?.message ?? '아이디 또는 비밀번호가 올바르지 않습니다.';
          setAuthError(message);
          return { ok: false, message };
        }
        await refreshAuth();
        setAdminPanel('status');
        return { ok: true, message: '로그인했습니다.' };
      } catch {
        const message = '로그인 요청 중 오류가 발생했습니다.';
        setAuthError(message);
        return { ok: false, message };
      }
    },
    [refreshAuth],
  );

  const logout = useCallback(async () => {
    setAuthError(null);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    } finally {
      setAuthenticated(false);
      setRole(null);
      setUsername(null);
      setAdminPanel('status');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, []);

  const openSettings = useCallback(
    (tab: SettingsTab = 'display') => {
      setSettingsTab(tab);
      if (tab === 'admin') {
        setAdminPanel(role === 'admin' ? 'status' : 'status');
      } else {
        setAdminPanel('status');
      }
      setSettingsOpen(true);
    },
    [role],
  );

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setAdminPanel('status');
  }, []);

  const value = useMemo(
    (): AdminContextValue => ({
      authenticated,
      isAdmin: role === 'admin',
      role,
      username,
      authLoading,
      authError,
      settingsOpen,
      settingsTab,
      adminPanel,
      login,
      logout,
      openSettings,
      closeSettings,
      setSettingsTab,
      setAdminPanel,
      refreshAuth,
    }),
    [
      authenticated,
      role,
      username,
      authLoading,
      authError,
      settingsOpen,
      settingsTab,
      adminPanel,
      login,
      logout,
      openSettings,
      closeSettings,
      refreshAuth,
    ],
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return ctx;
}
