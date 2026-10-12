import { requireAdmin } from '@/lib/vina/auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * 관리자 세션 검증용 엔드포인트.
 * 비로그인 호출은 401을 반환한다.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ ok: true, role: 'admin' });
}
