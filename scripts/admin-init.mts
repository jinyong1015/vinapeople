/**
 * 초기 관리자 자격 증명을 1회 생성한다.
 *
 * 사용:
 *   VINA_ADMIN_BOOTSTRAP_PASSWORD=*** npx tsx ./scripts/admin-init.mts
 *
 * - 이미 .data/vina-admin.json 이 있으면 재설정하지 않는다.
 * - 비밀번호 평문/해시를 출력하지 않는다.
 */
import { bootstrapAdminCredentials } from '../src/lib/vina/auth/credentials.ts';

const bootstrap = process.env.VINA_ADMIN_BOOTSTRAP_PASSWORD?.trim();
if (!bootstrap) {
  console.error(
    'VINA_ADMIN_BOOTSTRAP_PASSWORD 환경변수가 필요합니다. 평문을 스크립트에 넣지 마세요.',
  );
  process.exit(1);
}

if (bootstrap.length < 8) {
  console.error('부트스트랩 비밀번호는 8자 이상이어야 합니다.');
  process.exit(1);
}

const result = await bootstrapAdminCredentials(bootstrap);
if (result.created) {
  console.log('초기 관리자 자격 증명을 생성했습니다.');
  console.log(`저장 위치: ${result.path}`);
  console.log(
    '보안을 위해 환경변수 VINA_ADMIN_BOOTSTRAP_PASSWORD 를 제거하는 것을 권장합니다.',
  );
} else {
  console.log(
    '이미 관리자 자격 증명이 있어 초기화하지 않았습니다. (재시작만으로 비밀번호가 바뀌지 않음)',
  );
  console.log(`기존 파일: ${result.path}`);
}
