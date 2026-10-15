'use client';

import { useAdmin, type SettingsTab } from '@/components/providers/AdminProvider';
import { useToast } from '@/components/providers/ToastProvider';
import {
  getInitialTheme,
  saveTheme,
  type ColorTheme,
} from '@/lib/vina/theme';
import {
  Check,
  LogOut,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

const THEME_OPTIONS: Array<{
  value: ColorTheme;
  label: string;
  description: string;
  Icon: typeof Sun;
}> = [
  {
    value: 'light',
    label: '라이트',
    description: '밝은 배경과 어두운 글자',
    Icon: Sun,
  },
  {
    value: 'dark',
    label: '다크',
    description: '깊은 검정 배경과 밝은 글자',
    Icon: Moon,
  },
];

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function DisplayModePanel() {
  const [preference, setPreference] = useState<ColorTheme>(() => getInitialTheme());

  return (
    <div className="settings-panel">
      <div className="settings-panel-intro">
        <div className="settings-panel-icon" aria-hidden="true">
          <Palette size={18} strokeWidth={2} />
        </div>
        <div>
          <h3 className="settings-section-title">화면 모드</h3>
          <p className="settings-panel-lead">
            보기 편한 테마를 선택하세요. 선택 즉시 전체 화면에 적용됩니다.
          </p>
        </div>
      </div>

      <div className="settings-theme-grid" role="radiogroup" aria-label="화면 모드">
        {THEME_OPTIONS.map((option) => {
          const selected = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={clsx(
                'settings-theme-card',
                `settings-theme-card-${option.value}`,
                selected && 'settings-theme-card-active',
              )}
              onClick={() => {
                setPreference(option.value);
                saveTheme(option.value);
              }}
            >
              <span
                className={clsx(
                  'settings-theme-preview',
                  `settings-theme-preview-${option.value}`,
                )}
                aria-hidden="true"
              >
                <span className="settings-theme-preview-bar" />
                <span className="settings-theme-preview-row" />
                <span className="settings-theme-preview-row short" />
              </span>
              <span className="settings-theme-meta">
                <span className="settings-theme-icon-wrap">
                  <option.Icon size={16} strokeWidth={2} />
                </span>
                <span className="settings-theme-copy">
                  <span className="settings-theme-label">{option.label}</span>
                  <span className="settings-theme-desc">{option.description}</span>
                </span>
                {selected ? (
                  <span className="settings-theme-check" aria-hidden="true">
                    <Check size={14} strokeWidth={2.5} />
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AdminStatusPanel() {
  const { isAdmin, username, role, logout } = useAdmin();
  const { pushToast } = useToast();

  return (
    <div className="settings-panel">
      <div className="settings-panel-intro">
        <div
          className={clsx(
            'settings-panel-icon',
            isAdmin && 'settings-panel-icon-admin',
          )}
          aria-hidden="true"
        >
          <ShieldCheck size={18} strokeWidth={2} />
        </div>
        <div>
          <h3 className="settings-section-title">권한 · 로그인</h3>
          <p className="settings-panel-lead">
            {isAdmin
              ? '관리자 권한이 활성화되어 있습니다.'
              : '조회 전용 사용자로 로그인되어 있습니다. 데이터 관리는 관리자만 가능합니다.'}
          </p>
        </div>
      </div>

      <div
        className={clsx(
          'settings-status-card',
          isAdmin ? 'settings-status-card-on' : 'settings-status-card-off',
        )}
      >
        <div className="settings-status-top">
          <span className="settings-status-label">현재 상태</span>
          <span
            className={clsx(
              'settings-status-badge',
              isAdmin ? 'settings-status-badge-on' : 'settings-status-badge-off',
            )}
          >
            <span
              className={clsx(
                'settings-status-dot',
                isAdmin ? 'settings-status-dot-on' : 'settings-status-dot-off',
              )}
              aria-hidden="true"
            />
            {isAdmin ? '관리자' : '사용자'}
            {username ? ` · ${username}` : ''}
          </span>
        </div>
        <ul className="settings-capability-list">
          <li data-allowed="true">대시보드 · 분석 · 인원 관리 조회</li>
          <li data-allowed={isAdmin ? 'true' : 'false'}>데이터 업로드 · 인원 반영</li>
          <li data-allowed={isAdmin ? 'true' : 'false'}>사진 등록·변경·삭제</li>
          <li data-allowed="true">
            역할:{' '}
            {role === 'admin' ? '관리자' : role === 'user' ? '사용자' : '-'}
          </li>
        </ul>
      </div>

      <div className="settings-admin-actions">
        <button
          type="button"
          className="btn settings-logout-btn"
          onClick={() => {
            void (async () => {
              pushToast('로그아웃했습니다.', 'info');
              await logout();
            })();
          }}
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </div>
    </div>
  );
}

export function SettingsModal() {
  const {
    settingsOpen,
    settingsTab,
    isAdmin,
    setSettingsTab,
    setAdminPanel,
    closeSettings,
  } = useAdmin();
  const titleId = useId();
  const tabListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSettings();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen, closeSettings]);

  if (!settingsOpen) return null;

  const selectTab = (tab: SettingsTab) => {
    setSettingsTab(tab);
    if (tab === 'admin') setAdminPanel('status');
  };

  const onTabListKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next: SettingsTab =
      e.key === 'ArrowRight'
        ? settingsTab === 'display'
          ? 'admin'
          : 'display'
        : settingsTab === 'admin'
          ? 'display'
          : 'admin';
    selectTab(next);
    const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>(
      "[role='tab']",
    );
    const idx = next === 'display' ? 0 : 1;
    buttons?.[idx]?.focus();
  };

  return (
    <div
      className="settings-modal-backdrop"
      role="presentation"
      onClick={closeSettings}
    >
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-modal-handle" aria-hidden="true" />

        <div className="settings-modal-header">
          <div>
            <h2 id={titleId} className="settings-modal-title">
              설정
            </h2>
            <p className="settings-modal-subtitle">화면 표시와 권한</p>
          </div>
          <button
            type="button"
            className="settings-close-icon"
            aria-label="설정 닫기"
            onClick={closeSettings}
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-tabs-wrap">
          <div
            ref={tabListRef}
            className="settings-tabs"
            role="tablist"
            aria-label="설정 구분"
            onKeyDown={onTabListKeyDown}
          >
            <button
              type="button"
              role="tab"
              id="settings-tab-display"
              aria-selected={settingsTab === 'display'}
              aria-controls="settings-panel-display"
              tabIndex={settingsTab === 'display' ? 0 : -1}
              className={clsx(
                'settings-tab',
                settingsTab === 'display' && 'settings-tab-active',
              )}
              onClick={() => selectTab('display')}
            >
              <Palette size={15} strokeWidth={2} aria-hidden="true" />
              화면 모드
            </button>
            <button
              type="button"
              role="tab"
              id="settings-tab-admin"
              aria-selected={settingsTab === 'admin'}
              aria-controls="settings-panel-admin"
              tabIndex={settingsTab === 'admin' ? 0 : -1}
              className={clsx(
                'settings-tab',
                settingsTab === 'admin' && 'settings-tab-active',
              )}
              onClick={() => selectTab('admin')}
            >
              <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
              권한
              {isAdmin ? <span className="settings-tab-dot" aria-hidden="true" /> : null}
            </button>
          </div>
        </div>

        <div className="settings-modal-body">
          {settingsTab === 'display' ? (
            <div
              role="tabpanel"
              id="settings-panel-display"
              aria-labelledby="settings-tab-display"
              className="settings-tabpanel"
            >
              <DisplayModePanel />
            </div>
          ) : (
            <div
              role="tabpanel"
              id="settings-panel-admin"
              aria-labelledby="settings-tab-admin"
              className="settings-tabpanel"
            >
              <AdminStatusPanel />
            </div>
          )}
        </div>

        <div className="settings-modal-footer">
          <button type="button" className="btn" onClick={closeSettings}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
