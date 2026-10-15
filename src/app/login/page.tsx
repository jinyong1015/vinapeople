'use client';

import { useAdmin } from '@/components/providers/AdminProvider';
import { Eye, EyeOff, Lock, LogIn, User } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';

function safeFromPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  if (raw.startsWith('/login')) return '/';
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, authLoading, login } = useAdmin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && authenticated) {
      router.replace(safeFromPath(searchParams.get('from')));
    }
  }, [authLoading, authenticated, router, searchParams]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await login(username, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace(safeFromPath(searchParams.get('from')));
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hyundai-logo.png"
            alt="Hyundai Corporation"
            className="login-logo"
          />
          <h1 className="login-title">VINA 인원현황 관리</h1>
          <p className="login-sub">로그인 후 이용할 수 있습니다.</p>
        </div>

        <form className="login-form" onSubmit={(e) => void onSubmit(e)}>
          <label className="login-field">
            <span className="login-label">아이디</span>
            <span className="login-input-wrap">
              <User size={16} className="login-input-icon" aria-hidden />
              <input
                className="login-input"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디"
                required
                disabled={submitting}
              />
            </span>
          </label>

          <label className="login-field">
            <span className="login-label">비밀번호</span>
            <span className="login-input-wrap">
              <Lock size={16} className="login-input-icon" aria-hidden />
              <input
                className="login-input"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                required
                disabled={submitting}
              />
              <button
                type="button"
                className="login-eye"
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={submitting || !username.trim() || !password}
          >
            <LogIn size={16} aria-hidden />
            {submitting ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-page" />}>
      <LoginForm />
    </Suspense>
  );
}
