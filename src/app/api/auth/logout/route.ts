import {
  AUTH_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
} from '@/lib/vina/auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
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
  return NextResponse.json({ ok: true });
}
