import ExcelJS from 'exceljs';

const PATH =
  'C:/Users/PC/Documents/카카오톡 받은 파일/2026.08.10 전체 인원 현황(수정).xlsx';

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(PATH);

console.log('=== WORKBOOK ===');
console.log(
  'sheets:',
  wb.worksheets.map((w) => ({
    name: w.name,
    rowCount: w.rowCount,
    columnCount: w.columnCount,
    actualRowCount: w.actualRowCount,
    actualColumnCount: w.actualColumnCount,
  })),
);

const ws = wb.worksheets[0];
console.log('\n=== TITLE / DATES ===');
for (const addr of ['M3', 'S5', 'T4', 'T5', 'A1', 'B1', 'B6']) {
  const cell = ws.getCell(addr);
  console.log(addr, {
    value: cell.value,
    text: cell.text,
    type: cell.type,
  });
}

console.log('\n=== TABLE ===');
const tables = (ws as unknown as { tables?: Record<string, unknown> }).tables;
console.log('table keys', Object.keys(tables ?? {}));
const t = tables?.['인원현황5'] as
  | {
      name?: string;
      table?: { name?: string; tableRef?: string; columns?: { name: string }[] };
    }
  | undefined;
console.log(
  JSON.stringify(
    {
      name: t?.name ?? t?.table?.name,
      tableRef: t?.table?.tableRef,
      columns: t?.table?.columns?.map((c) => c.name),
    },
    null,
    2,
  ),
);

console.log('\n=== HEADER ROW 6 (B-T) ===');
const headers: string[] = [];
for (let c = 2; c <= 20; c += 1) {
  headers.push(String(ws.getRow(6).getCell(c).value ?? ''));
}
console.log(headers);

console.log('\n=== SAMPLE ROWS ===');
for (const r of [7, 8, 38, 170, 265, 266, 267, 268]) {
  const row = ws.getRow(r);
  const vals: Record<string, unknown> = { row: r };
  for (let c = 2; c <= 20; c += 1) {
    const cell = row.getCell(c);
    const h = headers[c - 2] || `C${c}`;
    vals[h] = {
      v: cell.value,
      t: cell.text,
    };
  }
  console.log(JSON.stringify(vals));
}

console.log('\n=== DATA RANGE SCAN ===');
let firstEmpty = null as number | null;
let lastFilled = 6;
const empSet = new Map<string, number[]>();
let emptyProcess = 0;
let numErrors = 0;
for (let r = 7; r <= 451; r += 1) {
  const emp = String(rowText(ws, r, 3));
  const name = String(rowText(ws, r, 4));
  if (!emp && !name) {
    if (firstEmpty === null && r <= 270) firstEmpty = r;
    continue;
  }
  lastFilled = r;
  if (emp) {
    const key = emp.toUpperCase();
    const list = empSet.get(key) ?? [];
    list.push(r);
    empSet.set(key, list);
  }
  if (!rowText(ws, r, 10) && r <= 266) emptyProcess += 1;
  for (const c of [18, 19, 20]) {
    const v = ws.getRow(r).getCell(c).value;
    if (
      v &&
      typeof v === 'object' &&
      'result' in v &&
      (v as { result?: { error?: string } }).result &&
      typeof (v as { result?: { error?: string } }).result === 'object' &&
      (v as { result: { error?: string } }).result?.error
    ) {
      if (r <= 266) numErrors += 1;
    }
  }
}
const dups = [...empSet.entries()].filter(([, rows]) => rows.length > 1);
console.log({
  firstEmptyIdentRow: firstEmpty,
  lastFilledWithEmpOrName: lastFilled,
  uniqueEmpInWholeSheet: empSet.size,
  duplicateEmpKinds: dups.length,
  duplicateSamples: dups.slice(0, 5),
  emptyProcessInTableGuess: emptyProcess,
  numErrorCellsInTableGuess: numErrors,
});

console.log('\n=== COLUMN TYPES (rows 7-266) ===');
for (let c = 2; c <= 20; c += 1) {
  const types = new Map<string, number>();
  let sample: unknown;
  for (let r = 7; r <= 266; r += 1) {
    const v = ws.getRow(r).getCell(c).value;
    let kind = 'empty';
    if (v === null || v === undefined || v === '') kind = 'empty';
    else if (v instanceof Date) kind = 'Date';
    else if (typeof v === 'number') kind = 'number';
    else if (typeof v === 'string') kind = 'string';
    else if (typeof v === 'object' && v && 'formula' in v) kind = 'formula';
    else if (typeof v === 'object' && v && 'sharedFormula' in v)
      kind = 'sharedFormula';
    else if (typeof v === 'object' && v && 'result' in v) kind = 'formulaResult';
    else kind = typeof v;
    types.set(kind, (types.get(kind) ?? 0) + 1);
    if (sample === undefined && kind !== 'empty') sample = v;
  }
  console.log(headers[c - 2], Object.fromEntries(types), 'sample=', summarize(sample));
}

function rowText(sheet: ExcelJS.Worksheet, r: number, c: number) {
  const v = sheet.getRow(r).getCell(c).value;
  if (v == null) return '';
  if (typeof v === 'object' && 'result' in (v as object)) {
    return String((v as ExcelJS.CellFormulaValue).result ?? '');
  }
  return String(v).trim();
}

function summarize(v: unknown) {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v) {
    try {
      return JSON.stringify(v).slice(0, 120);
    } catch {
      return String(v);
    }
  }
  return v;
}
