import { NextResponse, type NextRequest } from 'next/server';

const AUTH_COOKIE = 'vina-workforce-session';
const LEGACY_COOKIE = 'vina-workforce-admin-session';

const PUBLIC_PATHS = new Set([
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/hyundai-logo.png' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp')
  ) {
    return true;
  }
  return false;
}

/** Edge에서는 HMAC 검증 대신 쿠키 존재만 확인하고, 상세 검증은 API/서버에서 수행 */
function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get(AUTH_COOKIE)?.value ||
      request.cookies.get(LEGACY_COOKIE)?.value,
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    // 이미 로그인된 사용자가 /login 접근 시 홈으로
    if (pathname === '/login' && hasSessionCookie(request)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { message: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map)$).*)',
  ],
};
