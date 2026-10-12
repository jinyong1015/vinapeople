import ExcelJS from 'exceljs';
import { parseCalendarDate } from './dates';
import { COLUMN_HEADERS } from './parser';
import type { Personnel } from './types';

/** 예: 2026.10.10 전체 인원 현황.xlsx */
export function buildDetailExportFilename(asOfDate: string): string {
  const parts = parseCalendarDate(asOfDate);
  if (!parts) return '전체 인원 현황.xlsx';
  const y = String(parts.year);
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${y}.${m}.${d} 전체 인원 현황.xlsx`;
}

function toExcelDate(value: string | null): Date | null {
  const parts = parseCalendarDate(value);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

const FONT_BASE: Partial<ExcelJS.Font> = {
  name: '맑은 고딕',
  size: 10,
  charset: 129,
};

const THIN: Partial<ExcelJS.Border> = { style: 'thin' };
const CELL_BORDER: Partial<ExcelJS.Borders> = {
  top: THIN,
  left: THIN,
  bottom: THIN,
  right: THIN,
};

const DATE_NUM_FMT = 'mm-dd-yy';
const KO_DATE_NUM_FMT = 'yyyy"년" m"월" d"일";@';

const COL_WIDTHS: Record<number, number> = {
  1: 4.3,
  4: 19.5,
  5: 19.5,
  6: 19.5,
  7: 16.5,
  8: 16.5,
  9: 16.5,
  10: 16.5,
  11: 16.5,
  12: 17.5,
  13: 13,
  16: 10.8,
  17: 10.8,
  19: 10.5,
  20: 9,
  21: 16.3,
};

function toTableRow(p: Personnel, index: number): (string | number | Date | null)[] {
  return [
    index + 1,
    p.employeeNo,
    p.name,
    p.workplace,
    p.employmentStatus,
    p.category,
    p.category1,
    p.position,
    p.process,
    p.department || null,
    p.category3,
    p.category4,
    p.genderSource,
    p.genderLabelSource,
    toExcelDate(p.birthDate),
    toExcelDate(p.joinDate),
    toExcelDate(p.resignDate),
    p.tenureYears,
    p.tenureTotalMonths,
    p.tenureTotalDays,
  ];
}

function styleTableRegion(sheet: ExcelJS.Worksheet, dataRowCount: number) {
  const headerRow = sheet.getRow(6);
  headerRow.height = 23.25;
  for (let c = 2; c <= 21; c += 1) {
    const cell = headerRow.getCell(c);
    cell.font = { ...FONT_BASE, bold: true };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = CELL_BORDER;
  }

  const lastDataRow = 6 + Math.max(dataRowCount, 1);
  for (let r = 7; r <= lastDataRow; r += 1) {
    const row = sheet.getRow(r);
    for (let c = 2; c <= 21; c += 1) {
      const cell = row.getCell(c);
      cell.font = { ...FONT_BASE };
      cell.border = CELL_BORDER;
      const colOffset = c - 2;
      if (colOffset === 0 || colOffset === 1 || colOffset === 4) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colOffset === 2 || colOffset === 3) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (colOffset >= 14 && colOffset <= 16) {
        if (cell.value instanceof Date) cell.numFmt = DATE_NUM_FMT;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colOffset >= 17) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    }
  }
}

export async function buildEmployeesXlsx(
  personnel: Personnel[],
  asOfDate: string,
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VINA Workforce';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('personal- 전체 인원 현황');

  for (const [col, width] of Object.entries(COL_WIDTHS)) {
    sheet.getColumn(Number(col)).width = width;
  }

  const titleCell = sheet.getCell('N3');
  titleCell.value = '전체 근무 인원 현황';
  titleCell.font = {
    ...FONT_BASE,
    bold: true,
    size: 30,
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(3).height = 44;

  const asOf = toExcelDate(asOfDate) ?? new Date();

  const docDateCell = sheet.getCell('U4');
  docDateCell.value = asOf;
  docDateCell.numFmt = KO_DATE_NUM_FMT;
  docDateCell.font = { ...FONT_BASE, size: 11 };
  docDateCell.alignment = { vertical: 'middle' };

  const asOfLabel = sheet.getCell('T5');
  asOfLabel.value = '기준일:';
  asOfLabel.font = { ...FONT_BASE };
  asOfLabel.alignment = { horizontal: 'center', vertical: 'middle' };

  const asOfCell = sheet.getCell('U5');
  asOfCell.value = asOf;
  asOfCell.numFmt = KO_DATE_NUM_FMT;
  asOfCell.font = { ...FONT_BASE };
  asOfCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const sorted = [...personnel].sort((a, b) => {
    const noA = a.sourceNo ?? Number.POSITIVE_INFINITY;
    const noB = b.sourceNo ?? Number.POSITIVE_INFINITY;
    if (noA !== noB) return noA - noB;
    return a.employeeNo.localeCompare(b.employeeNo, 'ko', { numeric: true });
  });

  const rows =
    sorted.length > 0
      ? sorted.map((p, index) => toTableRow(p, index))
      : [COLUMN_HEADERS.map(() => null)];

  sheet.addTable({
    name: '인원현황5',
    displayName: '인원현황5',
    ref: 'B6',
    headerRow: true,
    totalsRow: false,
    style: {
      theme: 'TableStyleMedium2',
      showRowStripes: true,
      showFirstColumn: false,
      showLastColumn: false,
      showColumnStripes: false,
    },
    columns: COLUMN_HEADERS.map((name) => ({
      name,
      filterButton: true,
    })),
    rows,
  });

  styleTableRegion(sheet, sorted.length);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
