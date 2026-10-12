'use client';

import { useAdmin } from '@/components/providers/AdminProvider';
import { SettingsModal } from '@/components/admin/SettingsModal';
import {
  ArrowUpRight,
  BarChart3,
  Briefcase,
  ChevronDown,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
}

const PRIMARY_NAV: NavItem[] = [
  {
    href: '/',
    label: '인원현황',
    icon: <LayoutGrid className="size-[17px]" aria-hidden />,
    match: (path) => path === '/',
  },
  {
    href: '/office',
    label: '사무직',
    icon: <Briefcase className="size-[17px]" aria-hidden />,
    match: (path) => path === '/office' || path.startsWith('/office/'),
  },
  {
    href: '/employees',
    label: '상세인원',
    icon: <Users className="size-[17px]" aria-hidden />,
    match: (path) => path === '/employees' || path.startsWith('/employees/'),
  },
];

interface AnalysisNavItem {
  href: string;
  label: string;
  match: (path: string) => boolean;
}

const ANALYSIS_NAV: AnalysisNavItem[] = [
  {
    href: '/analysis/positions',
    label: '직급 분석',
    match: (path) => path.startsWith('/analysis/positions'),
  },
  {
    href: '/analysis/gender',
    label: '성별 분석',
    match: (path) => path.startsWith('/analysis/gender'),
  },
  {
    href: '/analysis/age',
    label: '나이 분석',
    match: (path) => path.startsWith('/analysis/age'),
  },
  {
    href: '/analysis/tenure',
    label: '근속 분석',
    match: (path) => path.startsWith('/analysis/tenure'),
  },
  {
    href: '/analysis/process-age',
    label: '공정별 나이',
    match: (path) => path.startsWith('/analysis/process-age'),
  },
];

const GAP_PX = 8;
const MORE_BUTTON_WIDTH = 88;
const ANALYSIS_CHIP_WIDTH = 118;

function TopNavigation() {
  const pathname = usePathname();
  const shellRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(PRIMARY_NAV.length);
  const [moreOpen, setMoreOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  const analysisActive = ANALYSIS_NAV.some((item) => item.match(pathname));

  const recompute = useCallback(() => {
    const shell = shellRef.current;
    const measure = measureRef.current;
    if (!shell || !measure) return;

    const buttons = measure.querySelectorAll<HTMLElement>('[data-nav-measure]');
    const widths = [...buttons].map((el) => el.offsetWidth);
    const available =
      shell.clientWidth - MORE_BUTTON_WIDTH - ANALYSIS_CHIP_WIDTH - GAP_PX;
    let used = 0;
    let count = 0;

    for (let i = 0; i < widths.length; i += 1) {
      const next = used + widths[i] + (count > 0 ? GAP_PX : 0);
      if (next > available && count > 0) break;
      used = next;
      count += 1;
    }

    if (count === widths.length) {
      setVisibleCount(widths.length);
    } else {
      setVisibleCount(Math.max(1, count));
    }
  }, []);

  useLayoutEffect(() => {
    recompute();
    const shell = shellRef.current;
    if (!shell) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(shell);
    return () => ro.disconnect();
  }, [recompute]);

  useEffect(() => {
    setMoreOpen(false);
    setAnalysisOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen && !analysisOpen) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreOpen && !moreRef.current?.contains(target)) {
        setMoreOpen(false);
      }
      if (analysisOpen && !analysisRef.current?.contains(target)) {
        setAnalysisOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        setAnalysisOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [moreOpen, analysisOpen]);

  const visible = PRIMARY_NAV.slice(0, visibleCount);
  const overflow = PRIMARY_NAV.slice(visibleCount);
  const moreActive = overflow.some((item) => item.match(pathname));

  return (
    <>
      <div
        ref={measureRef}
        className="pointer-events-none absolute -left-[9999px] top-0 flex gap-2 opacity-0"
        aria-hidden
      >
        {PRIMARY_NAV.map((item) => (
          <span
            key={item.href}
            data-nav-measure
            className="top-nav-chip inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-semibold"
          >
            <span className="top-nav-chip-icon flex size-8 items-center justify-center rounded-full">
              {item.icon}
            </span>
            {item.label}
          </span>
        ))}
      </div>

      <div ref={shellRef} className="top-nav-shell relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {visible.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="top-nav-chip inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-all duration-200"
                data-active={active ? 'true' : 'false'}
                aria-current={active ? 'page' : undefined}
              >
                <span className="top-nav-chip-icon flex size-8 items-center justify-center rounded-full">
                  {item.icon}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}

          <div ref={analysisRef} className="relative shrink-0">
            <button
              type="button"
              className="top-nav-chip inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-all duration-200"
              data-active={analysisActive || analysisOpen ? 'true' : 'false'}
              aria-haspopup="menu"
              aria-expanded={analysisOpen}
              aria-label="분석 메뉴"
              onClick={() => {
                setAnalysisOpen((v) => !v);
                setMoreOpen(false);
              }}
            >
              <span className="top-nav-chip-icon flex size-8 items-center justify-center rounded-full">
                <BarChart3 className="size-[17px]" aria-hidden />
              </span>
              <span className="hidden sm:inline">분석</span>
              <ChevronDown
                className={`size-4 shrink-0 transition-transform duration-200 ${
                  analysisOpen ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
            </button>
            {analysisOpen ? (
              <div
                role="menu"
                className="top-nav-dropdown absolute left-0 top-[calc(100%+0.6rem)] z-50 w-56 overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
              >
                {ANALYSIS_NAV.map((item) => {
                  const active = item.match(pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      role="menuitem"
                      className="top-nav-dropdown-item flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition"
                      data-active={active ? 'true' : 'false'}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setAnalysisOpen(false)}
                    >
                      <span>{item.label}</span>
                      <ArrowUpRight
                        className="top-nav-dropdown-arrow size-4 shrink-0"
                        aria-hidden
                      />
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          {overflow.length > 0 ? (
            <div ref={moreRef} className="relative shrink-0">
              <button
                type="button"
                className="top-nav-chip inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-semibold"
                data-active={moreActive ? 'true' : 'false'}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => {
                  setMoreOpen((v) => !v);
                  setAnalysisOpen(false);
                }}
              >
                <span className="top-nav-chip-icon flex size-8 items-center justify-center rounded-full">
                  <MoreHorizontal className="size-[17px]" aria-hidden />
                </span>
                <span className="hidden sm:inline">더보기</span>
              </button>
              {moreOpen ? (
                <div
                  role="menu"
                  className="top-nav-dropdown absolute right-0 top-[calc(100%+0.6rem)] z-50 w-56 overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)]"
                >
                  {overflow.map((item) => {
                    const active = item.match(pathname);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        className="top-nav-dropdown-item flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition"
                        data-active={active ? 'true' : 'false'}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setMoreOpen(false)}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isAdmin, openSettings } = useAdmin();

  const headerActions = useMemo(
    () => (
      <>
        <Link
          href="/manage/import"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink shadow-sm transition hover:border-accent/40 hover:bg-accent-soft"
          onClick={(event) => {
            if (!isAdmin) {
              event.preventDefault();
              openSettings('admin');
            }
          }}
          aria-label={isAdmin ? '데이터 업로드' : '데이터 업로드 (관리자)'}
        >
          <Plus size={16} aria-hidden />
          <span className="hidden md:inline">데이터 업로드</span>
        </Link>
        <button
          type="button"
          className="header-settings-btn inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink shadow-sm transition hover:border-accent/40 hover:bg-accent-soft"
          onClick={() => openSettings('display')}
          aria-haspopup="dialog"
          aria-label={isAdmin ? '설정 (관리자 모드)' : '설정'}
          title="설정"
        >
          <Settings size={16} aria-hidden />
          <span className="hidden md:inline">설정</span>
          {isAdmin ? (
            <span
              className="header-settings-admin-dot"
              title="관리자 로그인 중"
              aria-hidden
            />
          ) : null}
        </button>
      </>
    ),
    [isAdmin, openSettings],
  );

  return (
    <div className="app-shell min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-[color-mix(in_srgb,var(--color-surface,#fff)_95%,transparent)] shadow-sm backdrop-blur-md">
        <div className="content-shell mx-auto flex min-h-[68px] max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-5 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <img
              src="/hyundai-logo.png"
              alt="Hyundai Corporation"
              className="h-10 w-28 shrink-0 object-contain"
            />
            <span className="hidden min-w-0 xl:block">
              <span className="block truncate text-[15px] font-semibold leading-tight text-ink">
                Hyundaecorp
              </span>
              <span className="block text-[11px] text-muted">VINA 인원현황 관리</span>
            </span>
          </Link>

          <TopNavigation />

          <div className="ml-auto flex shrink-0 items-center gap-2">{headerActions}</div>
        </div>
      </header>

      <main className="content-shell mx-auto max-w-[1600px] px-4 py-6 sm:px-5 lg:px-8">
        {children}
      </main>

      <SettingsModal />
    </div>
  );
}
