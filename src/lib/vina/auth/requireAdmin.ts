import { NextResponse } from 'next/server';
import { isAdminRequest } from './session';

export type AdminGuardResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

/**
 * 관리자 전용 API에서 호출한다.
 * UI 숨김과 별개로 서버에서 세션을 검증한다.
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  const ok = await isAdminRequest();
  if (ok) return { ok: true };
  return {
    ok: false,
    response: NextResponse.json(
      { message: '관리자 권한이 필요합니다.' },
      { status: 401 },
    ),
  };
}
