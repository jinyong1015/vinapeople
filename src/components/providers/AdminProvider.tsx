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
  isAdmin?: boolean;
  role?: UserRole;
}

interface AdminContextValue {
  isAdmin: boolean;
  role: UserRole;
  authLoading: boolean;
  authError: string | null;
  settingsOpen: boolean;
  settingsTab: SettingsTab;
  adminPanel: AdminPanelView;
  login: (password: string) => Promise<{ ok: boolean; message: string }>;
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
    return { isAdmin: false, role: 'user' };
  }
  return (await res.json()) as AuthMeResponse;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('user');
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
      setRole(data.isAdmin || data.role === 'admin' ? 'admin' : 'user');
    } catch {
      setAuthError('권한 정보를 불러오지 못했습니다.');
      setRole('user');
    } finally {
      if (!options?.silent) setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  // 탭으로 돌아올 때 유휴·절대 만료를 UI에 반영 (/api/auth/me가 유효하면 유휴만 갱신)
  useEffect(() => {
    const onFocus = () => {
      void refreshAuth({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshAuth]);

  const login = useCallback(
    async (password: string): Promise<{ ok: boolean; message: string }> => {
      setAuthError(null);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { message?: string }
            | null;
          const message = body?.message ?? '로그인에 실패했습니다.';
          setAuthError(message);
          return { ok: false, message };
        }
        await refreshAuth();
        setAdminPanel('status');
        return { ok: true, message: '관리자로 로그인했습니다.' };
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
      // 세션 종료 실패 시에도 클라이언트 상태는 조회 사용자로 되돌립니다.
    } finally {
      setRole('user');
      setAdminPanel('status');
    }
  }, []);

  const openSettings = useCallback(
    (tab: SettingsTab = 'display') => {
      setSettingsTab(tab);
      if (tab === 'admin') {
        setAdminPanel(role === 'admin' ? 'status' : 'login');
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
      isAdmin: role === 'admin',
      role,
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
      role,
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
