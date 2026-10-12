/**
 * 운영용 VINA_ADMIN_PASSWORD_HASH 값을 생성한다.
 *
 * 사용:
 *   VINA_ADMIN_BOOTSTRAP_PASSWORD=*** npx tsx ./scripts/admin-hash.mts
 *
 * 출력은 해시 한 줄만 하며, 입력 평문은 출력하지 않는다.
 */
import { hashPassword } from '../src/lib/vina/auth/password.ts';

const plain = process.env.VINA_ADMIN_BOOTSTRAP_PASSWORD?.trim();
if (!plain) {
  console.error('VINA_ADMIN_BOOTSTRAP_PASSWORD 환경변수가 필요합니다.');
  process.exit(1);
}
if (plain.length < 8) {
  console.error('비밀번호는 8자 이상이어야 합니다.');
  process.exit(1);
}

const hash = await hashPassword(plain);
process.stdout.write(`${hash}\n`);
