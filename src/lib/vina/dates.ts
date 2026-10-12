import type { AgeBand, TenureBand } from './types';

const MS_PER_DAY = 86_400_000;

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

export interface TenureResult {
  years: number;
  monthsRemainder: number;
  totalMonths: number;
  totalDays: number;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

/** 2월 29일 생일/입사일: 평년에는 해당 연도 2월 말일로 기념일을 본다. */
export function anniversaryInYear(
  parts: CalendarDateParts,
  targetYear: number,
): CalendarDateParts {
  if (parts.month === 2 && parts.day === 29 && !isLeapYear(targetYear)) {
    return { year: targetYear, month: 2, day: 28 };
  }
  const maxDay = daysInMonth(targetYear, parts.month);
  return {
    year: targetYear,
    month: parts.month,
    day: Math.min(parts.day, maxDay),
  };
}

export function parseCalendarDate(value: unknown): CalendarDateParts | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    // ExcelJS는 달력 날짜를 UTC 자정으로 주는 경우가 많아 UTC 성분을 우선한다.
    // 로컬 자정(시차 보정본)이면 로컬 성분을 사용한다.
    const useUtc =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0;
    return {
      year: useUtc ? value.getUTCFullYear() : value.getFullYear(),
      month: (useUtc ? value.getUTCMonth() : value.getMonth()) + 1,
      day: useUtc ? value.getUTCDate() : value.getDate(),
    };
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const utc = excelEpoch + value * MS_PER_DAY;
    const d = new Date(utc);
    if (Number.isNaN(d.getTime())) return null;
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (iso) {
      const year = Number(iso[1]);
      const month = Number(iso[2]);
      const day = Number(iso[3]);
      if (isValidParts({ year, month, day })) {
        return { year, month, day };
      }
      return null;
    }

    const dotted = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(trimmed);
    if (dotted) {
      const year = Number(dotted[1]);
      const month = Number(dotted[2]);
      const day = Number(dotted[3]);
      if (isValidParts({ year, month, day })) {
        return { year, month, day };
      }
    }
  }

  return null;
}

function isValidParts(parts: CalendarDateParts): boolean {
  if (parts.month < 1 || parts.month > 12) return false;
  const dim = daysInMonth(parts.year, parts.month);
  return parts.day >= 1 && parts.day <= dim;
}

export function formatYYYYMMDD(parts: CalendarDateParts): string {
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${parts.year}-${m}-${d}`;
}

export function formatDateValue(value: unknown): string | null {
  const parts = parseCalendarDate(value);
  return parts ? formatYYYYMMDD(parts) : null;
}

function compareParts(a: CalendarDateParts, b: CalendarDateParts): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function utcTimestamp(parts: CalendarDateParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function diffCalendarDays(start: CalendarDateParts, end: CalendarDateParts): number {
  return Math.round((utcTimestamp(end) - utcTimestamp(start)) / MS_PER_DAY);
}

/** Excel DATEDIF와 동일한 완료 개월·연·일 계산 */
export function computeTenure(
  joinDate: string | CalendarDateParts,
  asOf: string | CalendarDateParts,
): TenureResult | null {
  const join =
    typeof joinDate === 'string'
      ? parseCalendarDate(joinDate)
      : joinDate;
  const asOfParts =
    typeof asOf === 'string' ? parseCalendarDate(asOf) : asOf;
  if (!join || !asOfParts) return null;
  if (compareParts(join, asOfParts) > 0) return null;

  const totalDays = diffCalendarDays(join, asOfParts);

  let totalMonths =
    (asOfParts.year - join.year) * 12 + (asOfParts.month - join.month);
  const joinDayInAsOfYear = anniversaryInYear(join, asOfParts.year);
  if (asOfParts.day < joinDayInAsOfYear.day) {
    totalMonths -= 1;
  }
  if (totalMonths < 0) totalMonths = 0;

  const years = Math.floor(totalMonths / 12);
  const monthsRemainder = totalMonths % 12;

  return {
    years,
    monthsRemainder,
    totalMonths,
    totalDays,
  };
}

export function computeAgeYears(
  birthDate: string | CalendarDateParts,
  asOf: string | CalendarDateParts,
): number | null {
  const birth =
    typeof birthDate === 'string'
      ? parseCalendarDate(birthDate)
      : birthDate;
  const asOfParts =
    typeof asOf === 'string' ? parseCalendarDate(asOf) : asOf;
  if (!birth || !asOfParts) return null;
  if (compareParts(birth, asOfParts) > 0) return null;

  let age = asOfParts.year - birth.year;
  const birthdayThisYear = anniversaryInYear(birth, asOfParts.year);
  if (compareParts(asOfParts, birthdayThisYear) < 0) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function ageBand(ageYears: number | null): AgeBand {
  if (ageYears === null || ageYears === undefined) return 'missingBirth';
  if (ageYears < 20) return 'under20';
  if (ageYears < 30) return '20s';
  if (ageYears < 40) return '30s';
  if (ageYears < 50) return '40s';
  if (ageYears < 60) return '50s';
  return '60plus';
}

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  under20: '20세 미만',
  '20s': '20~29세',
  '30s': '30~39세',
  '40s': '40~49세',
  '50s': '50~59세',
  '60plus': '60세 이상',
  missingBirth: '생년월일 미등록',
};

export function tenureBand(
  tenureTotalMonths: number | null,
): TenureBand {
  if (tenureTotalMonths === null) return 'missingJoin';
  if (tenureTotalMonths < 6) return 'under6Months';
  if (tenureTotalMonths < 12) return '6monthsTo1Year';
  if (tenureTotalMonths < 24) return '1to2Years';
  if (tenureTotalMonths < 36) return '2to3Years';
  return '3plusYears';
}

export const TENURE_BAND_LABELS: Record<TenureBand, string> = {
  under6Months: '6개월 미만',
  '6monthsTo1Year': '6개월~1년 미만',
  '1to2Years': '1~2년 미만',
  '2to3Years': '2~3년 미만',
  '3plusYears': '3년 이상',
  missingJoin: '입사일 미등록',
};

/** 세로 막대 X축용 짧은 라벨 */
export const TENURE_SHORT_LABELS: Record<TenureBand, string> = {
  under6Months: '6개월↓',
  '6monthsTo1Year': '6월~1년',
  '1to2Years': '1~2년',
  '2to3Years': '2~3년',
  '3plusYears': '3년↑',
  missingJoin: '미등록',
};

export function isDateAfter(
  a: string | null,
  b: string | null,
): boolean {
  if (!a || !b) return false;
  const pa = parseCalendarDate(a);
  const pb = parseCalendarDate(b);
  if (!pa || !pb) return false;
  return compareParts(pa, pb) > 0;
}

export function isDateBefore(
  a: string | null,
  b: string | null,
): boolean {
  if (!a || !b) return false;
  const pa = parseCalendarDate(a);
  const pb = parseCalendarDate(b);
  if (!pa || !pb) return false;
  return compareParts(pa, pb) < 0;
}
