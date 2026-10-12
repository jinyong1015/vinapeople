/**
 * VINA 인증 모듈
 * - 현재: 서버 세션 + bcrypt 관리자 비밀번호
 * - 향후: Supabase Auth로 교체 시 이 디렉터리 구현만 교체하고
 *   앱에서는 requireAdmin / isAdminRequest 계약을 유지한다.
 */

export {
  hashPassword,
  verifyPassword,
  looksLikeBcryptHash,
} from './password';

export {
  resolveAdminPasswordHash,
  bootstrapAdminCredentials,
  writeCredentialsIfAbsent,
  getCredentialsFilePath,
  type StoredAdminCredentials,
} from './credentials';

export {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC,
  ADMIN_SESSION_IDLE_MAX_AGE_SEC,
  ADMIN_SESSION_MAX_AGE_SEC,
  createAdminSessionToken,
  parseAdminSessionToken,
  refreshAdminSessionToken,
  remainingAbsoluteMaxAgeSec,
  verifyAdminSessionToken,
  adminSessionCookieOptions,
  isAdminRequest,
  type AdminSessionClaims,
} from './session';

export { requireAdmin, type AdminGuardResult } from './requireAdmin';
