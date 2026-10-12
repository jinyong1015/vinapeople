/**
 * @deprecated Import from `@/lib/vina/auth` instead.
 * 호환을 위해 세션 유틸만 재노출한다. 평문 비밀번호 API는 제거되었다.
 */
export {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC,
  ADMIN_SESSION_IDLE_MAX_AGE_SEC,
  ADMIN_SESSION_MAX_AGE_SEC,
  createAdminSessionToken,
  verifyAdminSessionToken,
  adminSessionCookieOptions,
  isAdminRequest,
} from './auth';
