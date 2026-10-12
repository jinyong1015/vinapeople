import ExcelJS from 'exceljs';

const p =
  'C:/Users/PC/Documents/카카오톡 받은 파일/2026.08.10 전체 인원 현황(수정).xlsx';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(p);
const ws = wb.worksheets[0];
const tables = (ws as unknown as { tables?: Record<string, { name?: string; ref?: string }> })
  .tables;
console.log('table sample', tables?.['인원현황5']);

for (const r of [7, 38, 170, 265, 266]) {
  const cells = [18, 19, 20].map((c) => {
    const cell = ws.getRow(r).getCell(c);
    return {
      v: cell.value,
      text: cell.text,
      result:
        cell.value && typeof cell.value === 'object' && 'result' in cell.value
          ? (cell.value as ExcelJS.CellFormulaValue).result
          : undefined,
    };
  });
  console.log(
    'row',
    r,
    'emp',
    ws.getRow(r).getCell(3).value,
    'join',
    ws.getRow(r).getCell(16).value,
    'RST',
    JSON.stringify(cells),
  );
}
