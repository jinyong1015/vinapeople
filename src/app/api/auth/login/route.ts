import {
  ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_IDLE_MAX_AGE_SEC,
  adminSessionCookieOptions,
  createAdminSessionToken,
  resolveAdminPasswordHash,
  verifyPassword,
} from '@/lib/vina/auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let password = '';
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === 'string') {
      password = body.password;
    }
  } catch {
    return NextResponse.json(
      { message: '요청 형식이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  if (!password) {
    return NextResponse.json(
      { message: '로그인에 실패했습니다.' },
      { status: 401 },
    );
  }

  let passwordHash: string | null;
  try {
    passwordHash = await resolveAdminPasswordHash();
  } catch {
    return NextResponse.json(
      { message: '관리자 인증을 준비할 수 없습니다.' },
      { status: 503 },
    );
  }

  if (!passwordHash) {
    return NextResponse.json(
      { message: '관리자 인증이 구성되지 않았습니다.' },
      { status: 503 },
    );
  }

  const matched = await verifyPassword(password, passwordHash);
  // 비밀번호·해시 값을 로그/응답에 남기지 않는다.
  if (!matched) {
    return NextResponse.json(
      { message: '로그인에 실패했습니다.' },
      { status: 401 },
    );
  }

  const token = createAdminSessionToken();
  const jar = await cookies();
  // 쿠키 수명은 절대 8시간. 유휴 30분은 토큰 lastActivity로 강제한다.
  jar.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions());

  return NextResponse.json({
    ok: true,
    session: {
      absoluteMaxAgeSec: ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC,
      idleMaxAgeSec: ADMIN_SESSION_IDLE_MAX_AGE_SEC,
    },
  });
}
