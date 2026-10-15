/**
 * VINA 인증 모듈
 * - 서버 세션(HMAC 쿠키) + bcrypt 앱 계정 (user | admin)
 * - Supabase Auth로 교체 시 이 디렉터리만 교체하고 requireAuth/requireAdmin 계약 유지
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
  fetchAdminPasswordHashFromSupabase,
  upsertAdminPasswordHashToSupabase,
  clearAdminPasswordHashCache,
} from './supabaseAdmin';

export {
  authenticateAppUser,
  ensureAppUsersBootstrapped,
} from './users';

export {
  AUTH_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_ABSOLUTE_MAX_AGE_SEC,
  ADMIN_SESSION_IDLE_MAX_AGE_SEC,
  ADMIN_SESSION_MAX_AGE_SEC,
  createSessionToken,
  createAdminSessionToken,
  parseSessionToken,
  parseAdminSessionToken,
  refreshSessionToken,
  refreshAdminSessionToken,
  remainingAbsoluteMaxAgeSec,
  verifyAdminSessionToken,
  adminSessionCookieOptions,
  authSessionCookieOptions,
  getRequestSession,
  isAuthenticatedRequest,
  isAdminRequest,
  clearSessionCookie,
  type AppRole,
  type SessionClaims,
  type AdminSessionClaims,
} from './session';

export { requireAuth, type AuthGuardResult } from './requireAuth';
export { requireAdmin, type AdminGuardResult } from './requireAdmin';
