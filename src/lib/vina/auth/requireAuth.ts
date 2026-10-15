import { NextResponse } from 'next/server';
import { getRequestSession, type SessionClaims } from './session';

export type AuthGuardResult =
  | { ok: true; session: SessionClaims }
  | { ok: false; response: NextResponse };

/** 로그인 사용자(user|admin) 전용 API */
export async function requireAuth(): Promise<AuthGuardResult> {
  const session = await getRequestSession();
  if (session) return { ok: true, session };
  return {
    ok: false,
    response: NextResponse.json(
      { message: '로그인이 필요합니다.' },
      { status: 401 },
    ),
  };
}
