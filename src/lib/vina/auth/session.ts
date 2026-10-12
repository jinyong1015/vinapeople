import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export const ADMIN_SESSION_COOKIE = 'vina-workforce-admin-session';

/** 로그인 후 최대 유지 시간(중간에 사용해도 만료) */
export const ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC = 8 * 60 * 60;

/** 아무 인증 요청도 없으면 만료 */
export const ADMIN_SESSION_IDLE_MAX_AGE_SEC = 30 * 60;

/** @deprecated ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC 사용 */
export const ADMIN_SESSION_MAX_AGE_SEC = ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC;

export interface AdminSessionClaims {
  issuedAt: number;
  lastActivityAt: number;
}

function getSessionSecret(): string {
  const fromEnv = process.env.VINA_SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (process.env.NODE_ENV !== 'production') {
    return 'vina-dev-session-secret-change-me';
  }
  throw new Error('VINA_SESSION_SECRET is not configured');
}

function signPayload(payload: string): string {
  return createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
}

function splitToken(
  token: string,
): { payload: string; sig: string } | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  return {
    payload: token.slice(0, dot),
    sig: token.slice(dot + 1),
  };
}

function signaturesMatch(sig: string, expected: string): boolean {
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function absoluteDeadline(issuedAt: number): number {
  return issuedAt + ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC * 1000;
}

function idleDeadline(lastActivityAt: number): number {
  return lastActivityAt + ADMIN_SESSION_IDLE_MAX_AGE_SEC * 1000;
}

export function remainingAbsoluteMaxAgeSec(
  issuedAt: number,
  now = Date.now(),
): number {
  return Math.max(0, Math.ceil((absoluteDeadline(issuedAt) - now) / 1000));
}

/**
 * 세션 토큰 형식: `admin:{issuedAt}:{lastActivityAt}.{sig}`
 * - absolute: issuedAt + 8h (갱신해도 issuedAt 고정)
 * - idle: lastActivityAt + 30m (유효한 요청마다 lastActivity 갱신)
 */
export function createAdminSessionToken(now = Date.now()): string {
  const payload = `admin:${now}:${now}`;
  return `${payload}.${signPayload(payload)}`;
}

export function parseAdminSessionToken(
  token: string | undefined | null,
  now = Date.now(),
): AdminSessionClaims | null {
  if (!token) return null;
  const parts = splitToken(token);
  if (!parts) return null;

  let expected: string;
  try {
    expected = signPayload(parts.payload);
  } catch {
    return null;
  }
  if (!signaturesMatch(parts.sig, expected)) return null;

  const fields = parts.payload.split(':');
  // 구형식 admin:{exp} 은 거부
  if (fields.length !== 3 || fields[0] !== 'admin') return null;

  const issuedAt = Number(fields[1]);
  const lastActivityAt = Number(fields[2]);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(lastActivityAt)) {
    return null;
  }
  if (lastActivityAt < issuedAt) return null;
  if (now > absoluteDeadline(issuedAt)) return null;
  if (now > idleDeadline(lastActivityAt)) return null;

  return { issuedAt, lastActivityAt };
}

export function verifyAdminSessionToken(
  token: string | undefined | null,
  now = Date.now(),
): boolean {
  return parseAdminSessionToken(token, now) !== null;
}

/** 유휴 시각만 갱신. 절대 만료(issuedAt)는 바꾸지 않는다. */
export function refreshAdminSessionToken(
  token: string,
  now = Date.now(),
): string | null {
  const claims = parseAdminSessionToken(token, now);
  if (!claims) return null;
  if (now > absoluteDeadline(claims.issuedAt)) return null;
  const payload = `admin:${claims.issuedAt}:${now}`;
  return `${payload}.${signPayload(payload)}`;
}

export function adminSessionCookieOptions(maxAgeSec?: number): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSec ?? ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC,
  };
}

async function clearAdminSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

/** Route Handler에서 현재 요청의 관리자 세션 여부. 유효하면 유휴 시각을 갱신한다. */
export async function isAdminRequest(): Promise<boolean> {
  try {
    const jar = await cookies();
    const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
    if (!token) return false;

    const claims = parseAdminSessionToken(token);
    if (!claims) {
      await clearAdminSessionCookie();
      return false;
    }

    const refreshed = refreshAdminSessionToken(token);
    if (!refreshed) {
      await clearAdminSessionCookie();
      return false;
    }

    jar.set(
      ADMIN_SESSION_COOKIE,
      refreshed,
      adminSessionCookieOptions(remainingAbsoluteMaxAgeSec(claims.issuedAt)),
    );
    return true;
  } catch {
    return false;
  }
}
