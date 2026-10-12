import ExcelJS from 'exceljs';
import { normalizeProcess } from './codes';
import { formatDateValue } from './dates';
import type {
  ImportCandidate,
  OutsideTablePreviewRow,
  ParsePersonnelWorkbookResult,
} from './types';
import { readSourceTenureCell } from './validator';

/** 기준 양식 Table 이름 (실제 파일에서 확인) */
const TABLE_NAME_CANDIDATE = '인원현황5';

/**
 * 현행 기준 양식 B6:U6 — 공정 다음에 부서 컬럼 포함 (20개)
 */
const COLUMN_HEADERS = [
  'NO',
  '사번',
  '성명',
  '근무지',
  '근무현황',
  '구분',
  '구분1',
  '직급',
  '공정',
  '부서',
  '구분3',
  '구분4',
  '성별',
  'Column1',
  '생년월일',
  '입사일',
  '퇴사일',
  '근속년수',
  '근속개월',
  '근속일',
] as const;

/** 부서 컬럼 도입 이전 양식 B6:T6 (19개) — 하위 호환 */
const LEGACY_COLUMN_HEADERS = [
  'NO',
  '사번',
  '성명',
  '근무지',
  '근무현황',
  '구분',
  '구분1',
  '직급',
  '공정',
  '구분3',
  '구분4',
  '성별',
  'Column1',
  '생년월일',
  '입사일',
  '퇴사일',
  '근속년수',
  '근속개월',
  '근속일',
] as const;

type SchemaKind = 'with-department' | 'legacy';

const EXPECTED_SHEET_HINT = 'personal';

function headersMatch(
  actual: string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    expected.every((h, i) => h === actual[i])
  );
}

function detectSchemaKind(headers: string[]): SchemaKind | null {
  if (headersMatch(headers, COLUMN_HEADERS)) return 'with-department';
  if (headersMatch(headers, LEGACY_COLUMN_HEADERS)) return 'legacy';
  return null;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value !== null) {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    if ('hyperlink' in value && 'text' in value) {
      const hyperlink = value as ExcelJS.CellHyperlinkValue;
      return String(hyperlink.text ?? hyperlink.hyperlink ?? '').trim();
    }
    if ('error' in value) {
      return String((value as { error?: string }).error ?? '');
    }
    if ('result' in value) {
      return cellText(
        (value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue,
      );
    }
  }
  if (value instanceof Date) {
    return formatDateValue(value) ?? '';
  }
  return String(value).trim();
}

function cellRaw(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return (value as ExcelJS.CellFormulaValue).result ?? value;
  }
  return value;
}

function parseFilenameDateHint(fileName: string | undefined): string | null {
  if (!fileName) return null;
  const dotted = /(\d{4})\.(\d{1,2})\.(\d{1,2})/.exec(fileName);
  if (dotted) {
    const y = Number(dotted[1]);
    const m = Number(dotted[2]);
    const d = Number(dotted[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}

function readDateCell(
  sheet: ExcelJS.Worksheet,
  address: string,
): string | null {
  const cell = sheet.getCell(address);
  const raw = cellRaw(cell.value);
  return formatDateValue(raw);
}

function findTargetSheet(workbook: ExcelJS.Workbook): {
  sheet: ExcelJS.Worksheet;
  issue: string | null;
} {
  if (workbook.worksheets.length === 0) {
    throw new Error('워크북에 시트가 없습니다.');
  }

  const byPersonal = workbook.worksheets.find((ws) =>
    ws.name.toLowerCase().includes(EXPECTED_SHEET_HINT),
  );
  if (byPersonal) return { sheet: byPersonal, issue: null };

  if (workbook.worksheets.length === 1) {
    return {
      sheet: workbook.worksheets[0],
      issue: `기준 시트명 힌트('${EXPECTED_SHEET_HINT}')와 다른 시트 '${workbook.worksheets[0].name}'을(를) 사용합니다. 구조를 확인하세요.`,
    };
  }

  return {
    sheet: workbook.worksheets[0],
    issue: `여러 시트 중 기준 시트를 특정하지 못해 첫 시트 '${workbook.worksheets[0].name}'을(를) 사용합니다.`,
  };
}

function parseTableRef(ref: string): {
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
} | null {
  const match = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i.exec(ref.trim());
  if (!match) return null;
  const headerRow = Number(match[2]);
  return {
    headerRow,
    dataStartRow: headerRow + 1,
    dataEndRow: Number(match[4]),
  };
}

function detectTableMeta(sheet: ExcelJS.Worksheet): {
  tableName: string | null;
  tableRef: string | null;
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
} {
  type ExcelTableLike = {
    name?: string;
    ref?: string;
    table?: { name?: string; tableRef?: string; ref?: string };
  };

  const tableMap = (
    sheet as unknown as { tables?: Record<string, ExcelTableLike> }
  ).tables;
  const fromMap =
    tableMap?.[TABLE_NAME_CANDIDATE] ??
    (tableMap ? Object.values(tableMap)[0] : undefined);
  if (fromMap) {
    const ref =
      fromMap.ref ?? fromMap.table?.tableRef ?? fromMap.table?.ref ?? '';
    const parsedRef = parseTableRef(ref);
    const name = fromMap.name ?? fromMap.table?.name ?? TABLE_NAME_CANDIDATE;
    if (parsedRef) {
      return {
        tableName: name,
        tableRef: ref,
        ...parsedRef,
      };
    }
  }

  try {
    const named = sheet.getTable(TABLE_NAME_CANDIDATE) as {
      name: string;
      ref?: string;
      tableRef?: string;
    };
    const ref = named.ref ?? named.tableRef ?? '';
    const parsedRef = parseTableRef(ref);
    if (parsedRef) {
      return {
        tableName: named.name,
        tableRef: ref,
        ...parsedRef,
      };
    }
  } catch {
    // Table 미탐지 시 헤더 행 탐색으로 폴백
  }

  for (let row = 1; row <= Math.min(sheet.rowCount, 30); row += 1) {
    const texts: string[] = [];
    for (let col = 2; col <= 21; col += 1) {
      texts.push(cellText(sheet.getRow(row).getCell(col).value));
    }
    const hasEmployee = texts.some((t) => t === '사번');
    const hasName = texts.some((t) => t === '성명');
    if (hasEmployee && hasName) {
      const dataStartRow = row + 1;
      let dataEndRow = dataStartRow;
      for (let r = dataStartRow; r <= sheet.rowCount; r += 1) {
        const employeeNo = cellText(sheet.getRow(r).getCell(3).value);
        const name = cellText(sheet.getRow(r).getCell(4).value);
        if (!employeeNo && !name) break;
        dataEndRow = r;
      }
      return {
        tableName: null,
        tableRef: null,
        headerRow: row,
        dataStartRow,
        dataEndRow,
      };
    }
  }

  throw new Error(
    '인원 표 헤더(사번/성명) 또는 Table 인원현황5를 찾을 수 없습니다. 기준 양식과 다른 파일입니다.',
  );
}

function readHeaderLabels(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  columnCount: number,
): string[] {
  const headers: string[] = [];
  for (let col = 2; col <= 1 + columnCount; col += 1) {
    headers.push(cellText(sheet.getRow(headerRow).getCell(col).value));
  }
  // 끝의 빈 헤더는 잘라 스키마 길이와 맞춤
  while (headers.length > 0 && !headers[headers.length - 1]) {
    headers.pop();
  }
  return headers;
}

function validateHeaders(
  headers: string[],
  schema: SchemaKind | null,
): string[] {
  const issues: string[] = [];
  const expected =
    schema === 'legacy' ? LEGACY_COLUMN_HEADERS : COLUMN_HEADERS;

  if (!schema) {
    issues.push(
      `헤더가 현행(부서 포함 ${COLUMN_HEADERS.length}열) 또는 이전(${LEGACY_COLUMN_HEADERS.length}열) 양식과 일치하지 않습니다.`,
    );
  }

  const max = Math.max(headers.length, expected.length);
  for (let i = 0; i < max; i += 1) {
    const exp = expected[i];
    const actual = headers[i] ?? '';
    if (exp !== actual) {
      const colLetter = String.fromCharCode(66 + i); // B=66
      issues.push(
        `${colLetter}열 헤더 불일치: 기대 '${exp ?? '(없음)'}' / 실제 '${actual || '(빈 값)'}'`,
      );
    }
  }
  return issues;
}

function isRowEmpty(sheet: ExcelJS.Worksheet, rowNumber: number): boolean {
  for (let col = 2; col <= 21; col += 1) {
    if (cellText(sheet.getRow(rowNumber).getCell(col).value)) return false;
  }
  return true;
}

function parseDataRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  schema: SchemaKind,
): ImportCandidate | null {
  if (isRowEmpty(sheet, rowNumber)) return null;

  const row = sheet.getRow(rowNumber);
  const sourceNoRaw = cellRaw(row.getCell(2).value);
  const sourceNo =
    typeof sourceNoRaw === 'number' && Number.isFinite(sourceNoRaw)
      ? Math.trunc(sourceNoRaw)
      : null;

  const employeeNo = cellText(row.getCell(3).value);
  const name = cellText(row.getCell(4).value);
  if (!employeeNo && !name) return null;

  const processRaw = cellText(row.getCell(10).value);
  const withDept = schema === 'with-department';
  // 부서 컬럼이 끼면 이후 열이 +1
  const offset = withDept ? 1 : 0;

  const department = withDept ? cellText(row.getCell(11).value) : '';
  const category3 = cellText(row.getCell(11 + offset).value);
  const category4 = cellText(row.getCell(12 + offset).value);
  const genderSource = cellText(row.getCell(13 + offset).value);
  const genderLabelSource = cellText(row.getCell(14 + offset).value);

  const birthDateRaw = cellRaw(row.getCell(15 + offset).value);
  const joinDateRaw = cellRaw(row.getCell(16 + offset).value);
  const resignDateRaw = cellRaw(row.getCell(17 + offset).value);

  const tenureY = readSourceTenureCell(cellRaw(row.getCell(18 + offset).value));
  const tenureM = readSourceTenureCell(cellRaw(row.getCell(19 + offset).value));
  const tenureD = readSourceTenureCell(cellRaw(row.getCell(20 + offset).value));

  return {
    excelRow: rowNumber,
    sourceNo,
    employeeNo,
    name,
    workplace: cellText(row.getCell(5).value),
    employmentStatus: cellText(row.getCell(6).value),
    category: cellText(row.getCell(7).value),
    category1: cellText(row.getCell(8).value),
    position: cellText(row.getCell(9).value),
    processRaw,
    process: normalizeProcess(processRaw),
    department,
    category3,
    category4,
    genderSource,
    genderLabelSource,
    birthDateRaw,
    joinDateRaw,
    resignDateRaw,
    birthDate: formatDateValue(birthDateRaw),
    joinDate: formatDateValue(joinDateRaw),
    resignDate: formatDateValue(resignDateRaw),
    sourceTenureYears: tenureY.value,
    sourceTenureMonths: tenureM.value,
    sourceTenureDays: tenureD.value,
    sourceTenureFormulaError:
      tenureY.isError || tenureM.isError || tenureD.isError,
  };
}

function scanOutsideTableRecords(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  dataStartRow: number,
  dataEndRow: number,
): { count: number; preview: OutsideTablePreviewRow[] } {
  const preview: OutsideTablePreviewRow[] = [];
  let count = 0;

  for (let r = 1; r <= sheet.rowCount; r += 1) {
    // 헤더·현재 표 데이터 구간은 제외
    if (r === headerRow) continue;
    if (r >= dataStartRow && r <= dataEndRow) continue;

    const employeeNo = cellText(sheet.getRow(r).getCell(3).value);
    const name = cellText(sheet.getRow(r).getCell(4).value);
    if (!employeeNo && !name) continue;

    // 헤더 라벨 문자열이 남은 경우를 인원으로 오인하지 않음
    if (employeeNo === '사번' || name === '성명') continue;

    count += 1;
    if (preview.length < 20) {
      const previewFields: Record<string, string> = {};
      for (let col = 2; col <= 21; col += 1) {
        const header = COLUMN_HEADERS[col - 2] ?? `col${col}`;
        previewFields[header] = cellText(sheet.getRow(r).getCell(col).value);
      }
      preview.push({ excelRow: r, employeeNo, name, preview: previewFields });
    }
  }

  return { count, preview };
}

function hasDateSourcesConflict(
  documentDate: string | null,
  calcBaseDate: string | null,
  fileNameDateHint: string | null,
): boolean {
  const values = [documentDate, calcBaseDate, fileNameDateHint].filter(
    (v): v is string => Boolean(v),
  );
  if (values.length < 2) return false;
  return new Set(values).size > 1;
}

export interface ParsePersonnelOptions {
  fileName?: string;
}

export async function parsePersonnelWorkbook(
  arrayBuffer: ArrayBuffer,
  options: ParsePersonnelOptions = {},
): Promise<ParsePersonnelWorkbookResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch {
    throw new Error(
      'Excel 파일을 읽을 수 없습니다. .xlsx 형식의 기준 양식인지 확인하세요.',
    );
  }

  const { sheet, issue: sheetIssue } = findTargetSheet(workbook);
  const { tableName, tableRef, headerRow, dataStartRow, dataEndRow } =
    detectTableMeta(sheet);

  // 부서 컬럼 추가로 기준일 셀이 U열로 이동한 양식 지원
  const documentDate =
    readDateCell(sheet, 'U4') ?? readDateCell(sheet, 'T4');
  const calcBaseDate =
    readDateCell(sheet, 'U5') ?? readDateCell(sheet, 'T5');
  const fileNameDateHint = parseFilenameDateHint(options.fileName);
  const titleText =
    cellText(sheet.getCell('N3').value) ||
    cellText(sheet.getCell('M3').value) ||
    null;
  const baseDateLabel =
    cellText(sheet.getCell('T5').value) ||
    cellText(sheet.getCell('S5').value) ||
    null;

  const headersProbe = readHeaderLabels(sheet, headerRow, 20);
  const schemaKind = detectSchemaKind(headersProbe);
  const headers = schemaKind
    ? readHeaderLabels(
        sheet,
        headerRow,
        schemaKind === 'with-department'
          ? COLUMN_HEADERS.length
          : LEGACY_COLUMN_HEADERS.length,
      )
    : headersProbe;

  const schemaIssues = validateHeaders(headers, schemaKind);
  if (sheetIssue) schemaIssues.unshift(sheetIssue);
  if (schemaKind === 'legacy') {
    schemaIssues.push(
      '이전 양식(부서 열 없음)으로 인식했습니다. 부서·조직도는 비어 있을 수 있습니다.',
    );
  }
  if (!tableName) {
    schemaIssues.push(
      `Excel Table '${TABLE_NAME_CANDIDATE}'을(를) 찾지 못해 헤더 행 탐색으로 범위를 추정했습니다. 기준 양식인지 확인하세요.`,
    );
  } else if (tableName !== TABLE_NAME_CANDIDATE) {
    schemaIssues.push(
      `표 이름이 기준('${TABLE_NAME_CANDIDATE}')과 다릅니다. (실제 '${tableName}')`,
    );
  }

  const headerExact = schemaKind !== null;

  const rows: ImportCandidate[] = [];
  if (schemaKind) {
    for (let r = dataStartRow; r <= dataEndRow; r += 1) {
      const parsed = parseDataRow(sheet, r, schemaKind);
      if (parsed) rows.push(parsed);
    }
  } else {
    schemaIssues.push(
      '필수 컬럼 헤더가 기준 양식과 달라 인원 데이터를 추출하지 않았습니다.',
    );
  }

  if (headerExact && rows.length === 0) {
    schemaIssues.push('표 범위에서 추출된 인원 행이 0건입니다.');
  }

  const schemaOk = headerExact && rows.length > 0;

  const outside = scanOutsideTableRecords(
    sheet,
    headerRow,
    dataStartRow,
    dataEndRow,
  );

  return {
    sheetName: sheet.name,
    tableName,
    tableRef,
    headerRow,
    dataStartRow,
    dataEndRow,
    documentDate,
    calcBaseDate,
    fileNameDateHint,
    dateSourcesConflict: hasDateSourcesConflict(
      documentDate,
      calcBaseDate,
      fileNameDateHint,
    ),
    schemaOk: headerExact && rows.length > 0,
    schemaIssues,
    rows,
    outsidePreview: outside.preview,
    outsideRecordCount: outside.count,
    headers,
    titleText,
    baseDateLabel,
  };
}

export { COLUMN_HEADERS, LEGACY_COLUMN_HEADERS, TABLE_NAME_CANDIDATE };
