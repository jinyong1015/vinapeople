/**
 * 기준 Excel 파일 기준 업로드 파이프라인 스모크 테스트
 * 실행: npx tsx ./scripts/smoke-upload.mts
 */
import fs from 'node:fs';
import { aggregateDashboard } from '../src/lib/vina/aggregations.ts';
import { createDefaultFilterState, filterPersonnel } from '../src/lib/vina/filters.ts';
import { parsePersonnelWorkbook } from '../src/lib/vina/parser.ts';
import {
  buildPersonnelFromCandidates,
  validatePersonnelRows,
} from '../src/lib/vina/validator.ts';

const PATH =
  'C:/Users/PC/Documents/카카오톡 받은 파일/2026.08.10 전체 인원 현황(수정).xlsx';

const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(ok ? 'PASS' : 'FAIL', '-', name, '-', detail);
}

const buf = fs.readFileSync(PATH);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const parsed = await parsePersonnelWorkbook(ab, {
  fileName: '2026.08.10 전체 인원 현황(수정).xlsx',
});

check(
  '시트명',
  parsed.sheetName === 'personal- 전체 인원 현황',
  parsed.sheetName,
);
check('Table', parsed.tableName === '인원현황5', String(parsed.tableName));
check('tableRef', parsed.tableRef === 'B6:T266', String(parsed.tableRef));
check('headerRow', parsed.headerRow === 6, String(parsed.headerRow));
check(
  'dataRange',
  parsed.dataStartRow === 7 && parsed.dataEndRow === 266,
  `${parsed.dataStartRow}-${parsed.dataEndRow}`,
);
check('schemaOk', parsed.schemaOk, parsed.schemaIssues.join(' | ') || 'ok');
check('rows=260', parsed.rows.length === 260, String(parsed.rows.length));
check('outside=0', parsed.outsideRecordCount === 0, String(parsed.outsideRecordCount));
check('T4', parsed.documentDate === '2026-10-07', String(parsed.documentDate));
check('T5', parsed.calcBaseDate === '2026-10-06', String(parsed.calcBaseDate));
check(
  'fileHint',
  parsed.fileNameDateHint === '2026-08-10',
  String(parsed.fileNameDateHint),
);
check('dateConflict', parsed.dateSourcesConflict === true, 'expected conflict');
check('title', parsed.titleText === '전체 근무 인원 현황', String(parsed.titleText));

const first = parsed.rows[0];
check(
  'first row mapping',
  first?.excelRow === 7 &&
    first.employeeNo === 'NV010' &&
    first.name === 'Quản Thị Hoan' &&
    first.workplace === '2공장' &&
    first.process === '검사',
  JSON.stringify({
    row: first?.excelRow,
    emp: first?.employeeNo,
    name: first?.name,
    wp: first?.workplace,
    process: first?.process,
  }),
);

const row38 = parsed.rows.find((r) => r.excelRow === 38);
check(
  'J38 empty process',
  row38?.employeeNo === 'NV209' && row38.process === '미지정',
  JSON.stringify({ emp: row38?.employeeNo, process: row38?.process }),
);

const last = parsed.rows[parsed.rows.length - 1];
check(
  'last row',
  last?.excelRow === 266 && last.employeeNo === 'NV765',
  JSON.stringify({ row: last?.excelRow, emp: last?.employeeNo }),
);

const unique = new Set(parsed.rows.map((r) => r.employeeNo.toUpperCase()));
check('unique emp', unique.size === 260, String(unique.size));

// 헤더 밀림 검사: 사번 패턴
const badEmp = parsed.rows.filter((r) => !/^NV\d+/i.test(r.employeeNo));
check('사번 패턴', badEmp.length === 0, `bad=${badEmp.length}`);

const v6 = validatePersonnelRows(parsed.rows, '2026-10-06', {
  excelCalcBaseDate: parsed.calcBaseDate,
});
check(
  'asOf 10-06 blocks',
  v6.errorRows === 2 && v6.canApply === false,
  JSON.stringify({
    e: v6.errorRows,
    w: v6.warningRows,
    can: v6.canApply,
  }),
);

const v7 = validatePersonnelRows(parsed.rows, '2026-10-07', {
  excelCalcBaseDate: parsed.calcBaseDate,
});
check(
  'asOf 10-07 warnings=3',
  v7.errorRows === 0 && v7.warningRows === 3 && v7.canApply === true,
  JSON.stringify({
    e: v7.errorRows,
    w: v7.warningRows,
    n: v7.normalRows,
    can: v7.canApply,
    issues: v7.issues.map((i) => `${i.excelRow}:${i.field}`),
  }),
);

// 반영 전 후보 ≠ 활성: 여기서는 후보만 생성
const personnel = buildPersonnelFromCandidates(
  v7.candidates,
  '2026-10-07',
  new Date().toISOString(),
);
check('personnel length', personnel.length === 260, String(personnel.length));

const dash = aggregateDashboard(personnel, createDefaultFilterState());
check(
  'KPI total',
  dash.kpi.total === 260,
  JSON.stringify(dash.kpi),
);
check(
  'KPI working+leave',
  dash.kpi.working + dash.kpi.onLeave === dash.kpi.total,
  JSON.stringify(dash.kpi),
);

const list = filterPersonnel(personnel, createDefaultFilterState());
check('list filter count', list.length === dash.kpi.total, String(list.length));

const office = filterPersonnel(personnel, {
  ...createDefaultFilterState(),
  scope: 'office',
});
check('office scope', office.length === 10, String(office.length));

const failCount = results.filter((r) => !r.ok).length;
console.log('\n=== SUMMARY ===');
console.log(`passed ${results.length - failCount} / ${results.length}`);
if (failCount > 0) {
  process.exitCode = 1;
}
