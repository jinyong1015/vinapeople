import {
  ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC,
  ADMIN_SESSION_IDLE_MAX_AGE_SEC,
  AUTH_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  authenticateAppUser,
  authSessionCookieOptions,
  createSessionToken,
} from '@/lib/vina/auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let username = '';
  let password = '';
  try {
    const body = (await request.json()) as {
      username?: unknown;
      password?: unknown;
      /** @deprecated 관리자 설정 모달 호환 */
      id?: unknown;
    };
    if (typeof body.username === 'string') username = body.username;
    else if (typeof body.id === 'string') username = body.id;
    if (typeof body.password === 'string') password = body.password;
  } catch {
    return NextResponse.json(
      { message: '요청 형식이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  if (!username.trim() || !password) {
    return NextResponse.json(
      { message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
      { status: 401 },
    );
  }

  let authenticated: Awaited<ReturnType<typeof authenticateAppUser>>;
  try {
    authenticated = await authenticateAppUser(username, password);
  } catch (err) {
    console.error(
      '[vina-auth] login failed:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { message: '인증을 준비할 수 없습니다.' },
      { status: 503 },
    );
  }

  if (!authenticated) {
    return NextResponse.json(
      { message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
      { status: 401 },
    );
  }

  const token = createSessionToken(authenticated.role, authenticated.username);
  const jar = await cookies();
  jar.set(AUTH_SESSION_COOKIE, token, authSessionCookieOptions());
  // 레거시 쿠키 제거
  jar.set(LEGACY_ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return NextResponse.json({
    ok: true,
    role: authenticated.role,
    username: authenticated.username,
    session: {
      absoluteMaxAgeSec: ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC,
      idleMaxAgeSec: ADMIN_SESSION_IDLE_MAX_AGE_SEC,
    },
  });
}
