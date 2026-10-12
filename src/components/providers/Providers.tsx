'use client';

import { applyTheme, getInitialTheme, saveTheme, THEME_STORAGE_KEY } from '@/lib/vina/theme';
import { useEffect, type ReactNode } from 'react';
import { AdminProvider } from './AdminProvider';
import { ToastProvider } from './ToastProvider';
import { WorkforceProvider } from './WorkforceProvider';

function ThemeInit() {
  useEffect(() => {
    applyTheme(getInitialTheme());

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (event.newValue === 'light' || event.newValue === 'dark') {
        applyTheme(event.newValue);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AdminProvider>
        <WorkforceProvider>
          <ThemeInit />
          {children}
        </WorkforceProvider>
      </AdminProvider>
    </ToastProvider>
  );
}
