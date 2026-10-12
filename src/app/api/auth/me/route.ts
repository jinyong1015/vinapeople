import { isAdminRequest } from '@/lib/vina/auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * 현재 관리자 세션 여부.
 * 유효한 세션이면 유휴 타이머를 갱신한다(절대 8시간은 유지).
 */
export async function GET() {
  const isAdmin = await isAdminRequest();
  return NextResponse.json({
    isAdmin,
    role: isAdmin ? 'admin' : 'user',
  });
}
