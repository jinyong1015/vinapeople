/**
 * 업로드 비교(diff) 단위 스모크 — DB/서버 없이 모듈만 검증
 *
 * 시나리오:
 * 1) 동일 행 2회 → 2회차 new=0, changed=0
 * 2) 공정만 변경 → changed
 * 3) history용 changes old/new 존재
 * 4) 파일 내 중복 사번 → error
 * 5) 사번 누락 → error
 * 6) 누락 사번 → missing만 (resign 자동 변경 없음)
 */
import { diffAgainstExisting } from '../src/lib/vina/importDiff.ts';
import type { ImportCandidate } from '../src/lib/vina/types.ts';
import type { VinaEmployeeRow } from '../src/lib/vina/supabase/mappers.ts';

const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(ok ? 'PASS' : 'FAIL', '-', name, '-', detail);
}

function baseCandidate(overrides: Partial<ImportCandidate> = {}): ImportCandidate {
  return {
    excelRow: 7,
    sourceNo: 1,
    employeeNo: 'E001',
    name: 'Nguyen A',
    workplace: '1공장',
    employmentStatus: '근무중',
    category: '',
    category1: '',
    position: '사원',
    processRaw: '성형',
    process: '성형',
    department: '',
    category3: '',
    category4: '',
    genderSource: 'Nam',
    genderLabelSource: '남자',
    birthDateRaw: '1990-01-15',
    joinDateRaw: '2020-01-01',
    resignDateRaw: null,
    birthDate: '1990-01-15',
    joinDate: '2020-01-01',
    resignDate: null,
    sourceTenureYears: null,
    sourceTenureMonths: null,
    sourceTenureDays: null,
    sourceTenureFormulaError: false,
    ...overrides,
  };
}

function baseRow(overrides: Partial<VinaEmployeeRow> = {}): VinaEmployeeRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    employee_no: 'E001',
    source_no: 1,
    name: 'Nguyen A',
    workplace: '1공장',
    employment_status: '근무중',
    category: '',
    category1: '',
    position: '사원',
    process: '성형',
    department: '',
    category3: '',
    category4: '',
    gender_source: 'Nam',
    gender_label_source: '남자',
    gender: '남자',
    birth_date: '1990-01-15',
    join_date: '2020-01-01',
    resign_date: null,
    age_years: 36,
    tenure_years: 6,
    tenure_months_remainder: 0,
    tenure_total_months: 72,
    tenure_total_days: 2200,
    source_tenure_years: null,
    source_tenure_months: null,
    source_tenure_days: null,
    photo_path: null,
    as_of_date: '2026-10-15',
    updated_at: '2026-10-15T00:00:00.000Z',
    updated_by: 'admin',
    last_upload_id: null,
    ...overrides,
  };
}

const asOf = '2026-10-15';

// 1) 동일 파일 → unchanged
{
  const first = diffAgainstExisting([baseCandidate()], [], asOf);
  check('first upload is new', first.counts.new === 1 && first.counts.changed === 0, `new=${first.counts.new}`);

  const second = diffAgainstExisting(
    [baseCandidate()],
    [baseRow()],
    asOf,
  );
  check(
    'second identical → new=0 changed=0 unchanged=1',
    second.counts.new === 0 &&
      second.counts.changed === 0 &&
      second.counts.unchanged === 1,
    `new=${second.counts.new} changed=${second.counts.changed} unchanged=${second.counts.unchanged}`,
  );
  check(
    'employees count unchanged intent (no inserts/updates)',
    second.applyPayload.inserts.length === 0 &&
      second.applyPayload.updates.length === 0,
    `inserts=${second.applyPayload.inserts.length} updates=${second.applyPayload.updates.length}`,
  );
}

// 2+3) 공정만 변경 + history old/new
{
  const diff = diffAgainstExisting(
    [baseCandidate({ processRaw: '검사', process: '검사' })],
    [baseRow()],
    asOf,
  );
  check('process-only → changed=1', diff.counts.changed === 1, `changed=${diff.counts.changed}`);
  const change = diff.changedRows[0]?.changes.find((c) => c.field === 'process');
  check(
    'history old/new for process',
    change?.oldValue === '성형' && change?.newValue === '검사',
    `old=${change?.oldValue} new=${change?.newValue}`,
  );
}

// 4) 중복 사번
{
  const diff = diffAgainstExisting(
    [
      baseCandidate({ excelRow: 7 }),
      baseCandidate({ excelRow: 8, name: 'Other' }),
    ],
    [],
    asOf,
  );
  check(
    'duplicate employeeNo → error, no insert',
    diff.counts.error >= 2 && diff.counts.new === 0,
    `error=${diff.counts.error} new=${diff.counts.new}`,
  );
}

// 5) 사번 누락
{
  const diff = diffAgainstExisting(
    [baseCandidate({ employeeNo: '  ' })],
    [],
    asOf,
  );
  check(
    'missing employeeNo → error',
    diff.counts.error === 1 && diff.errorRows[0]?.message.includes('사번'),
    diff.errorRows[0]?.message ?? 'no error',
  );
}

// 6) 누락 사번 → missing only, no auto resign in apply payload
{
  const diff = diffAgainstExisting(
    [
      baseCandidate(),
      baseCandidate({ employeeNo: 'E002', excelRow: 8, name: 'New Person' }),
    ],
    [
      baseRow(),
      baseRow({
        id: '22222222-2222-2222-2222-222222222222',
        employee_no: 'E999',
        name: 'Missing Person',
      }),
    ],
    asOf,
  );
  check(
    'absent employee → missing list',
    diff.counts.missing === 1 &&
      diff.missingRows.some((m) => m.employeeNo === 'E999'),
    `missing=${diff.counts.missing}`,
  );
  check(
    'no resign auto-update in payload',
    !diff.applyPayload.updates.some(
      (u) => String(u.employee_no) === 'E999',
    ),
    'ok',
  );
}

const failed = results.filter((r) => !r.ok);
console.log('\n---');
console.log(`import-diff-smoke: ${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
