import ExcelJS from 'exceljs';

const p =
  'C:/Users/PC/Documents/카카오톡 받은 파일/2026.08.10 전체 인원 현황(수정).xlsx';
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(p);
const ws = wb.worksheets[0];
console.log('sheet', ws.name);
console.log('tables keys', Object.keys(ws.tables ?? {}));
try {
  const t = ws.getTable('인원현황5');
  console.log('getTable', t?.name, t?.ref);
} catch (e) {
  console.log('getTable err', e instanceof Error ? e.message : e);
}
let c = 0;
for (let r = 267; r <= ws.rowCount; r += 1) {
  const a = String(ws.getRow(r).getCell(3).value ?? '').trim();
  const b = String(ws.getRow(r).getCell(4).value ?? '').trim();
  if (a || b) c += 1;
}
console.log('rowCount', ws.rowCount, 'outside267+', c);
console.log('T4', ws.getCell('T4').value);
console.log('T5', ws.getCell('T5').value);
