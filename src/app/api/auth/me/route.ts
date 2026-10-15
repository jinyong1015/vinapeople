import { getRequestSession } from '@/lib/vina/auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * 현재 로그인 세션.
 * 유효하면 유휴 타이머를 갱신한다(절대 8시간은 유지).
 */
export async function GET() {
  const session = await getRequestSession();
  if (!session) {
    return NextResponse.json({
      authenticated: false,
      isAdmin: false,
      role: null,
      username: null,
    });
  }
  return NextResponse.json({
    authenticated: true,
    isAdmin: session.role === 'admin',
    role: session.role,
    username: session.username,
  });
}
