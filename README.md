# VINA 인원현황 관리

COMPANY 디자인 시스템을 계승한 **독립** VINA 인원현황 웹서비스입니다.  
품질/검사 데이터와 분리되어 있으며, **로그인 필수** + **사용자(조회) / 관리자(관리)** 권한 분리로 동작합니다.

- 기본: 브라우저 IndexedDB 전체 교체
- `NEXT_PUBLIC_VINA_DATA_SOURCE=supabase`: Supabase 누적 반영(신규/변경만 저장, 이력·복구) + 앱 계정(`vina_app_users`)

상세 화면·데이터 계약은 [`화면설계서.md`](./화면설계서.md) **§3.2 · §21**을 기준으로 합니다.

## 기술 스택

- Next.js (App Router) · TypeScript · Tailwind CSS
- ExcelJS · Recharts · lucide-react
- 인증: bcrypt 해시 + httpOnly HMAC 세션 쿠키 (`user` \| `admin`) · 서버 `requireAuth` / `requireAdmin`
- 인원·근태 데이터: IndexedDB 또는 Supabase (`vina_employees` / history / uploads / attendance)

## 시작하기

```bash
npm install
```

`.env.example`을 참고해 `.env.local`을 준비합니다.

```bash
# 세션 서명 비밀 (필수, 16자 이상 · 운영은 32자 이상 권장)
VINA_SESSION_SECRET=your-long-random-secret

# 앱 로그인 아이디 (기본값)
VINA_ADMIN_USERNAME=admin
VINA_USER_USERNAME=user

# Supabase 누적 모드 (운영 권장)
NEXT_PUBLIC_VINA_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # 서버 전용, 클라이언트 노출 금지
```

`SUPABASE_SERVICE_ROLE_KEY`는 Supabase 대시보드 → Project Settings → API 에서 복사합니다.

개발 서버는 직접 실행해 주세요.

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.  
미로그인 시 `/login`으로 이동합니다.

## 로그인 · 권한

### 동작 요약

| 항목 | 내용 |
|------|------|
| 최초 접속 | 내부 메뉴·데이터 없이 **로그인 화면**(`/login`) 표시 |
| 세션 | httpOnly 쿠키 · 절대 8시간 · 유휴 30분 · 새로고침·메뉴 이동 유지 |
| 사용자(`user`) | 인원·근태·분석 **조회만** (업로드·수정·삭제·사진 관리 UI/API 불가) |
| 관리자(`admin`) | 조회 + Excel 업로드·반영·복구 + 직원 사진 등록/변경/삭제 |
| 로그아웃 | **설정 → 권한** 탭 (헤더에 로그아웃 버튼 없음) |
| 서버 가드 | UI 숨김과 별개로 API에서 `requireAuth` / `requireAdmin` 검증 |

### 계정 관리 (Supabase 모드)

비밀번호는 bcrypt로만 저장합니다. 평문을 소스·Git·로그에 두지 마세요.

| 작업 | 명령 |
|------|------|
| 관리자 비밀번호 설정/변경 | `VINA_ADMIN_BOOTSTRAP_PASSWORD=*** npm run admin:set-password` |
| 조회 사용자 최초 생성 | `VINA_USER_BOOTSTRAP_PASSWORD=*** npm run user:init` |
| 조회 사용자 비밀번호 변경 | `VINA_USER_BOOTSTRAP_PASSWORD=*** npm run user:set-password` |

- 관리자: `vina_admin_settings` + `vina_app_users` (role=`admin`)에 동기화
- 사용자: `vina_app_users` (role=`user`)
- 부트스트랩 환경변수는 사용 후 제거하는 것을 권장합니다
- IndexedDB(로컬) 모드: `npm run admin:init` → `.data/vina-admin.json` (관리자 아이디만 지원)

### 보안 점검 스크립트

```bash
npm run auth:rls          # anon 키로 테이블 직접 조회 차단 확인
npm run auth:roles        # 관리자/사용자 로그인·세션 role (테스트용 환경변수 필요)
```

## 주요 화면

| 경로 | 설명 | 권한 |
|------|------|------|
| `/login` | 아이디·비밀번호 로그인 | 공개 |
| `/` | 인원현황 대시보드 | 로그인 |
| `/attendance` | 근태 현황 조회 · (관리자) 엑셀 업로드 | 로그인 / 업로드=관리자 |
| `/attendance/uploads` | 근태 업로드 이력 | 관리자 |
| `/office` | 사무직 관리 — 조직도 / 인원 목록 | 로그인 |
| `/employees` | 인원 관리 목록 · Excel 다운로드 | 로그인 |
| `/employees/[id]` | 개인 상세 · (관리자) 사진 등록/변경/삭제 | 로그인 / 사진=관리자 |
| `/history` | 변경 이력 | 로그인 |
| `/analysis/*` | 직급·성별·나이·근속·공정별 나이·근태 분석 | 로그인 |
| `/manage/import` | 인원 데이터 업로드 · 검증 · 최종 반영 | 관리자 |
| `/manage/uploads` | 업로드 이력 · 복구 | 관리자 |

헤더: **데이터 업로드**(관리자만) · **설정**. 메뉴 페이지 제목 아래 장문 부제는 두지 않습니다.

## Excel 양식

- **현행**: 시트 `personal- 전체 인원 현황`, Table `인원현황5`, 헤더 **B6:U**(20열, **부서** 포함)
- **레거시**: 헤더 **B6:T**(19열, 부서 없음) — 계속 업로드 가능
- 반영 기준일은 관리자가 확정합니다. 파일명 날짜를 기준일로 자동 선택하지 않습니다.

상세인원 **Excel 다운로드**는 필터·검색이 적용된 전체 결과를  
`YYYY.MM.DD 전체 인원 현황.xlsx` 이름으로, 원천과 같은 표 구조(제목·기준일·인원현황5)로 내보냅니다.

## 사용 흐름

1. `/login`에서 아이디·비밀번호로 로그인
2. **관리자**인 경우 헤더 **데이터 업로드** 또는 `/manage/import`에서 `.xlsx` 선택
3. **기준일 확정** 후 **검증 실행**
4. 검증 이슈 검토 (오류 있으면 반영 불가, 경고는 확인 체크 후 반영)
5. **IndexedDB 모드**: **최종 반영**으로 이 브라우저 활성 데이터를 교체
6. **Supabase 모드**: **DB 비교 미리보기** → 신규/변경/동일/오류/누락 검토 → **최종 반영 (누적)**  
   - 파일에 없는 사번은 누락으로만 표시하며 자동 퇴사하지 않습니다  
   - 복구는 `/manage/uploads`에서 해당 업로드 단위로 수행합니다
7. 근태는 `/attendance`에서 조회하며, 관리자만 근태 엑셀을 업로드합니다
8. 로그아웃은 **설정 → 권한**

비교 단위 스모크:

```bash
npm run import:diff-smoke
```

분석 화면에서 요약카드·차트를 누르면 해당 조건의 상세인원으로 이동합니다.  
상세인원 **조회조건 초기화**는 검색·나이·직급 등 **모든** 조건을 비워 전체 재직 목록을 보여 줍니다.

## 데이터 · RLS

- 조회·쓰기는 Next.js API가 `SUPABASE_SERVICE_ROLE_KEY`로 수행합니다
- `anon` / `authenticated` 역할에는 `vina_*` 테이블 권한이 없습니다 (직접 PostgREST 조회 차단)
- 직원 사진: Storage 버킷 `vina-employee-photos` · public read(로그인 후 `<img>` URL) · 클라이언트 write 거부 · 업로드/삭제는 관리자 API만
- COMPANY 품질관리 API·환경변수·localStorage 키·검사 데이터를 사용하지 않습니다  
  - 테마 키: `vina-workforce-color-theme`  
  - 목록 상태 키: `vina-workforce-page:*`  
  - 관리자 해시 파일(IndexedDB 모드): `.data/vina-admin.json` (Git 제외)

## 향후 확장

월별 추이·시점 조회·Supabase Auth 교체는 추후 범위입니다.  
현재 앱 계정은 `vina_app_users` + 서버 세션으로 운영하며, Auth로 교체 시 `src/lib/vina/auth` 계약(`requireAuth` / `requireAdmin`)을 유지하는 것을 권장합니다.
