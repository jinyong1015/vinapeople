import { NextResponse } from 'next/server';
import { getRequestSession, type SessionClaims } from './session';

export type AdminGuardResult =
  | { ok: true; session: SessionClaims }
  | { ok: false; response: NextResponse };

/**
 * 관리자 전용 API에서 호출한다.
 * UI 숨김과 별개로 서버에서 세션을 검증한다.
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  const session = await getRequestSession();
  if (session?.role === 'admin') {
    return { ok: true, session };
  }
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: '로그인이 필요합니다.' },
        { status: 401 },
      ),
    };
  }
  return {
    ok: false,
    response: NextResponse.json(
      { message: '관리자 권한이 필요합니다.' },
      { status: 403 },
    ),
  };
}
