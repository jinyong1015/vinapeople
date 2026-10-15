import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

/** 통합 세션 쿠키 (user | admin) */
export const AUTH_SESSION_COOKIE = 'vina-workforce-session';

/** @deprecated AUTH_SESSION_COOKIE 사용. 레거시 관리자 쿠키도 읽는다. */
export const ADMIN_SESSION_COOKIE = AUTH_SESSION_COOKIE;
export const LEGACY_ADMIN_SESSION_COOKIE = 'vina-workforce-admin-session';

/** 로그인 후 최대 유지 시간(중간에 사용해도 만료) */
export const ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC = 8 * 60 * 60;

/** 아무 인증 요청도 없으면 만료 */
export const ADMIN_SESSION_IDLE_MAX_AGE_SEC = 30 * 60;

/** @deprecated ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC 사용 */
export const ADMIN_SESSION_MAX_AGE_SEC = ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC;

export type AppRole = 'user' | 'admin';

export interface SessionClaims {
  role: AppRole;
  username: string;
  issuedAt: number;
  lastActivityAt: number;
}

/** @deprecated SessionClaims 사용 */
export type AdminSessionClaims = SessionClaims;

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

function encodeUsername(username: string): string {
  return encodeURIComponent(username.trim());
}

function decodeUsername(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * 세션 토큰:
 * - 신규: `v1:{role}:{username}:{issuedAt}:{lastActivityAt}.{sig}`
 * - 레거시 관리자: `admin:{issuedAt}:{lastActivityAt}.{sig}`
 */
export function createSessionToken(
  role: AppRole,
  username: string,
  now = Date.now(),
): string {
  const payload = `v1:${role}:${encodeUsername(username)}:${now}:${now}`;
  return `${payload}.${signPayload(payload)}`;
}

/** @deprecated createSessionToken('admin', 'admin') 사용 */
export function createAdminSessionToken(now = Date.now()): string {
  return createSessionToken('admin', 'admin', now);
}

export function parseSessionToken(
  token: string | undefined | null,
  now = Date.now(),
): SessionClaims | null {
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

  // 신규 v1:role:username:issued:activity
  if (fields.length === 5 && fields[0] === 'v1') {
    const role = fields[1];
    if (role !== 'user' && role !== 'admin') return null;
    const username = decodeUsername(fields[2]);
    if (!username) return null;
    const issuedAt = Number(fields[3]);
    const lastActivityAt = Number(fields[4]);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(lastActivityAt)) {
      return null;
    }
    if (lastActivityAt < issuedAt) return null;
    if (now > absoluteDeadline(issuedAt)) return null;
    if (now > idleDeadline(lastActivityAt)) return null;
    return { role, username, issuedAt, lastActivityAt };
  }

  // 레거시 admin:issued:activity
  if (fields.length === 3 && fields[0] === 'admin') {
    const issuedAt = Number(fields[1]);
    const lastActivityAt = Number(fields[2]);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(lastActivityAt)) {
      return null;
    }
    if (lastActivityAt < issuedAt) return null;
    if (now > absoluteDeadline(issuedAt)) return null;
    if (now > idleDeadline(lastActivityAt)) return null;
    return {
      role: 'admin',
      username: 'admin',
      issuedAt,
      lastActivityAt,
    };
  }

  return null;
}

/** @deprecated parseSessionToken */
export function parseAdminSessionToken(
  token: string | undefined | null,
  now = Date.now(),
): SessionClaims | null {
  return parseSessionToken(token, now);
}

export function verifyAdminSessionToken(
  token: string | undefined | null,
  now = Date.now(),
): boolean {
  const claims = parseSessionToken(token, now);
  return claims?.role === 'admin';
}

export function refreshSessionToken(
  token: string,
  now = Date.now(),
): string | null {
  const claims = parseSessionToken(token, now);
  if (!claims) return null;
  if (now > absoluteDeadline(claims.issuedAt)) return null;
  const payload = `v1:${claims.role}:${encodeUsername(claims.username)}:${claims.issuedAt}:${now}`;
  return `${payload}.${signPayload(payload)}`;
}

/** @deprecated refreshSessionToken */
export function refreshAdminSessionToken(
  token: string,
  now = Date.now(),
): string | null {
  return refreshSessionToken(token, now);
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

export const authSessionCookieOptions = adminSessionCookieOptions;

async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  const clear = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };
  jar.set(AUTH_SESSION_COOKIE, '', clear);
  jar.set(LEGACY_ADMIN_SESSION_COOKIE, '', clear);
}

function readSessionTokenFromJar(
  jar: Awaited<ReturnType<typeof cookies>>,
): string | undefined {
  return (
    jar.get(AUTH_SESSION_COOKIE)?.value ||
    jar.get(LEGACY_ADMIN_SESSION_COOKIE)?.value
  );
}

/** 현재 요청의 세션. 유효하면 유휴 시각을 갱신한다. */
export async function getRequestSession(): Promise<SessionClaims | null> {
  try {
    const jar = await cookies();
    const token = readSessionTokenFromJar(jar);
    if (!token) return null;

    const claims = parseSessionToken(token);
    if (!claims) {
      await clearAuthCookies();
      return null;
    }

    const refreshed = refreshSessionToken(token);
    if (!refreshed) {
      await clearAuthCookies();
      return null;
    }

    jar.set(
      AUTH_SESSION_COOKIE,
      refreshed,
      authSessionCookieOptions(remainingAbsoluteMaxAgeSec(claims.issuedAt)),
    );
    // 레거시 쿠키 정리
    if (jar.get(LEGACY_ADMIN_SESSION_COOKIE)?.value) {
      jar.set(LEGACY_ADMIN_SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
      });
    }
    return claims;
  } catch {
    return null;
  }
}

export async function isAuthenticatedRequest(): Promise<boolean> {
  return (await getRequestSession()) !== null;
}

/** Route Handler에서 현재 요청의 관리자 세션 여부. */
export async function isAdminRequest(): Promise<boolean> {
  const session = await getRequestSession();
  return session?.role === 'admin';
}

export async function clearSessionCookie(): Promise<void> {
  await clearAuthCookies();
}
