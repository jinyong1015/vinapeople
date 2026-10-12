# VINA 인원현황 관리

COMPANY 디자인 시스템을 계승한 **독립** VINA 인원현황 웹서비스입니다.  
품질/검사 데이터와 분리되어 있으며, Excel 업로드 → 검증 → 관리자 최종 반영 → 브라우저 IndexedDB 저장으로 동작합니다.

상세 화면·데이터 계약은 [`화면설계서.md`](./화면설계서.md) **3.1**을 기준으로 합니다.

## 기술 스택

- Next.js (App Router) · TypeScript · Tailwind CSS
- ExcelJS · Recharts · lucide-react
- 관리자 인증: bcrypt 해시 + httpOnly 세션 쿠키 (서버 검증)
- 인원 데이터: IndexedDB (`vina-workforce-db`)

## 시작하기

```bash
npm install
```

`.env.example`을 참고해 `.env.local`을 준비합니다.

```bash
# 세션 서명 비밀 (필수)
VINA_SESSION_SECRET=your-long-random-secret

# 최초 1회만: 관리자 초기 비밀번호 (평문은 Git/소스에 넣지 마세요)
VINA_ADMIN_BOOTSTRAP_PASSWORD=your-initial-password
```

관리자 자격 증명 초기화 (이미 `.data/vina-admin.json`이 있으면 **재설정하지 않음**):

```bash
npm run admin:init
```

초기화 후 `VINA_ADMIN_BOOTSTRAP_PASSWORD`는 `.env.local`에서 제거하는 것을 권장합니다.

개발 서버는 직접 실행해 주세요.

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

## 관리자 로그인

1. 헤더 **설정** → **관리자** 탭
2. 초기화 때 사용한 관리자 비밀번호로 로그인
3. 데이터 업로드·인원 수정은 관리자 세션이 있을 때만 서버에서도 허용 (`/api/admin/*`)

비밀번호는 bcrypt로만 저장됩니다. 클라이언트 코드·Git·로그에 평문을 두지 마세요.

운영 환경에서는 `npm run admin:hash`로 해시를 만들어 `VINA_ADMIN_PASSWORD_HASH`에 넣는 방식을 권장합니다.

## 주요 화면

| 경로 | 설명 |
|------|------|
| `/` | 인원현황 대시보드 (KPI·근무현황×공정·성별·나이·근속·공정별 나이 요약) |
| `/office` | 사무직 인원 — **조직도**(부서·법인장) / **인원 목록** |
| `/employees` | 상세인원 목록 · Excel 다운로드 · 분석 드릴다운 복귀 |
| `/employees/[id]` | 개인 상세 · 관리자 수정 |
| `/analysis/positions` 등 | 직급·성별·나이·근속·공정별 나이 (요약카드→상세인원) |
| `/manage/import` | 데이터 업로드 · 기준일 확정 · 검증 · 최종 반영 |

메뉴 페이지 제목 아래 장문 부제는 두지 않습니다.

## Excel 양식

- **현행**: 시트 `personal- 전체 인원 현황`, Table `인원현황5`, 헤더 **B6:U**(20열, **부서** 포함)
- **레거시**: 헤더 **B6:T**(19열, 부서 없음) — 계속 업로드 가능
- 반영 기준일은 관리자가 확정합니다. 파일명 날짜를 기준일로 자동 선택하지 않습니다.

상세인원 **Excel 다운로드**는 필터·검색이 적용된 전체 결과를  
`YYYY.MM.DD 전체 인원 현황.xlsx` 이름으로, 원천과 같은 표 구조(제목·기준일·인원현황5)로 내보냅니다.

## 사용 흐름

1. 설정 → 관리자 로그인
2. **데이터 업로드**에서 `.xlsx` 선택
3. **기준일 확정** 후 **검증 실행**
4. 검증 이슈 검토 (오류 있으면 반영 불가, 경고는 확인 체크 후 반영)
5. **최종 반영** 시 이 브라우저의 활성 데이터가 교체됩니다

분석 화면에서 요약카드·차트를 누르면 해당 조건의 상세인원으로 이동합니다.  
상세인원 **조회조건 초기화**는 검색·나이·직급 등 **모든** 조건을 비워 전체 재직 목록을 보여 줍니다.

## 데이터 분리

COMPANY 품질관리 API·환경변수·localStorage 키·검사 데이터를 사용하지 않습니다.  
테마 키: `vina-workforce-color-theme`  
목록 상태 키: `vina-workforce-page:*`  
관리자 해시 파일: `.data/vina-admin.json` (Git 제외)

## 향후 확장

Supabase Database · Storage(사진) · Auth는 `src/lib/vina/auth` 및 repository 교체 지점으로 분리되어 있습니다.  
월별 추이·퇴사 이력·사진 등록은 누적·Storage 도입 후 활성화합니다.
