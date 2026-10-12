import fs from 'node:fs';
import { parsePersonnelWorkbook } from '../src/lib/vina/parser.ts';
import { validatePersonnelRows } from '../src/lib/vina/validator.ts';

const excelPath =
  'C:/Users/PC/Documents/카카오톡 받은 파일/2026.08.10 전체 인원 현황(수정).xlsx';
const buf = fs.readFileSync(excelPath);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const parsed = await parsePersonnelWorkbook(ab, {
  fileName: '2026.08.10 전체 인원 현황(수정).xlsx',
});
console.log(
  JSON.stringify(
    {
      sheet: parsed.sheetName,
      table: parsed.tableName,
      headerRow: parsed.headerRow,
      dataStart: parsed.dataStartRow,
      dataEnd: parsed.dataEndRow,
      rows: parsed.rows.length,
      outside: parsed.outsideRecordCount,
      documentDate: parsed.documentDate,
      calcBaseDate: parsed.calcBaseDate,
      fileHint: parsed.fileNameDateHint,
    },
    null,
    2,
  ),
);

const v6 = validatePersonnelRows(parsed.rows, '2026-10-06', {
  excelCalcBaseDate: parsed.calcBaseDate,
});
const v7 = validatePersonnelRows(parsed.rows, '2026-10-07', {
  excelCalcBaseDate: parsed.calcBaseDate,
});
console.log(
  'asOf-10-06',
  JSON.stringify({
    errors: v6.errorRows,
    warnings: v6.warningRows,
    ok: v6.normalRows,
    canApply: v6.canApply,
    issueCount: v6.issues.length,
  }),
);
console.log(
  'asOf-10-07',
  JSON.stringify({
    errors: v7.errorRows,
    warnings: v7.warningRows,
    ok: v7.normalRows,
    canApply: v7.canApply,
    issueCount: v7.issues.length,
  }),
);
console.log(
  'issues-10-07',
  JSON.stringify(
    v7.issues.map((i) => ({
      sev: i.severity,
      row: i.excelRow,
      field: i.field,
      emp: i.employeeNo,
      msg: i.message,
    })),
  ),
);
