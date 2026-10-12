import bcrypt from 'bcryptjs';

/** bcrypt cost factor (2^12 iterations). Do not lower in production. */
const BCRYPT_ROUNDS = 12;

/**
 * 비밀번호를 bcrypt로 해시한다.
 * (Argon2id 전환 시 이 모듈만 교체하면 된다.)
 */
export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error('Password does not meet minimum length');
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** 입력 비밀번호와 저장 해시를 안전하게 비교한다. */
export async function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  if (!plain || !passwordHash) return false;
  try {
    return await bcrypt.compare(plain, passwordHash);
  } catch {
    return false;
  }
}

export function looksLikeBcryptHash(value: string): boolean {
  return /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}
