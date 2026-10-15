import ExcelJS from 'exceljs';
import { formatDateValue } from '../dates';
import type { AttendanceCandidate } from './types';

const REQUIRED_HEADERS = [
  'M',
  'D',
  'day2',
  'NO',
  '사유',
  '사번',
  '이름',
  '부서',
  '주/야',
  '인원수',
  '비고',
] as const;

type HeaderKey = (typeof REQUIRED_HEADERS)[number];

function cellRaw(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return (value as { result: unknown }).result ?? null;
  }
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return (value as { text: string }).text;
  }
  if (typeof value === 'object' && value !== null && 'richText' in value) {
    const parts = (value as { richText: Array<{ text: string }> }).richText;
    return parts.map((p) => p.text).join('');
  }
  return value;
}

function cellText(value: ExcelJS.CellValue): string {
  const raw = cellRaw(value);
  if (raw === null || raw === undefined) return '';
  if (raw instanceof Date) return formatDateValue(raw) ?? '';
  return String(raw).trim();
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  const raw = cellRaw(value);
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = Number(String(raw).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/\u00a0/g, '')
    .trim();
}

function findHeaderRow(
  sheet: ExcelJS.Worksheet,
): { rowNumber: number; colByKey: Record<HeaderKey, number> } | null {
  const maxScan = Math.min(sheet.rowCount, 40);
  for (let r = 1; r <= maxScan; r += 1) {
    const row = sheet.getRow(r);
    const colByKey = {} as Record<HeaderKey, number>;
    let hits = 0;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const label = normalizeHeader(cellRaw(cell.value));
      for (const key of REQUIRED_HEADERS) {
        if (normalizeHeader(key) === label && !colByKey[key]) {
          colByKey[key] = col;
          hits += 1;
        }
      }
    });
    if (hits >= 8 && colByKey['day2'] && colByKey['사번'] && colByKey['사유']) {
      for (const key of REQUIRED_HEADERS) {
        if (!colByKey[key]) colByKey[key] = -1;
      }
      return { rowNumber: r, colByKey };
    }
  }
  return null;
}

export interface ParseAttendanceWorkbookResult {
  sheetName: string;
  headerRow: number;
  candidates: AttendanceCandidate[];
  schemaOk: boolean;
  message?: string;
}

export async function parseAttendanceWorkbook(
  buffer: ArrayBuffer | Buffer,
): Promise<ParseAttendanceWorkbookResult> {
  const workbook = new ExcelJS.Workbook();
  // exceljs typings accept Buffer-like
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet =
    workbook.worksheets.find((s) => /근태/.test(s.name)) ??
    workbook.worksheets[0];
  if (!sheet) {
    return {
      sheetName: '',
      headerRow: 0,
      candidates: [],
      schemaOk: false,
      message: '시트를 찾을 수 없습니다.',
    };
  }

  const header = findHeaderRow(sheet);
  if (!header) {
    return {
      sheetName: sheet.name,
      headerRow: 0,
      candidates: [],
      schemaOk: false,
      message:
        '헤더 행을 찾지 못했습니다. M, D, day2, NO, 사유, 사번 등이 포함된 행이 필요합니다.',
    };
  }

  const { rowNumber, colByKey } = header;
  const candidates: AttendanceCandidate[] = [];

  for (let r = rowNumber + 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const get = (key: HeaderKey) => {
      const col = colByKey[key];
      if (!col || col < 1) return null;
      return row.getCell(col).value;
    };

    const attendanceDate = formatDateValue(cellRaw(get('day2')));
    const employeeNo = cellText(get('사번'));
    const name = cellText(get('이름'));
    const reason = cellText(get('사유'));
    const department = cellText(get('부서'));
    const shift = cellText(get('주/야')).replace(/\s+/g, '');
    const remarks = cellText(get('비고'));
    const monthValue = cellNumber(get('M'));
    const dayValue = cellNumber(get('D'));
    const noValue = cellNumber(get('NO'));
    const personCount = cellNumber(get('인원수'));

    const empty =
      !attendanceDate &&
      !employeeNo &&
      !name &&
      !reason &&
      !department &&
      !remarks;
    if (empty) continue;

    candidates.push({
      excelRow: r,
      monthValue,
      dayValue,
      attendanceDate,
      noValue: noValue === null ? null : Math.trunc(noValue),
      reason,
      employeeNo,
      name,
      department,
      shift,
      personCount,
      remarks,
    });
  }

  return {
    sheetName: sheet.name,
    headerRow: rowNumber,
    candidates,
    schemaOk: true,
  };
}
