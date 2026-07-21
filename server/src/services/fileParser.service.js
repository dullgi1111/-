const fs = require('fs');
const ExcelJS = require('exceljs');
const { parse } = require('csv-parse/sync');
const iconv = require('iconv-lite');

function cellToString(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return String(v.result).trim();
    return '';
  }
  return String(v).trim();
}

function pickNonEmptySheet(workbook) {
  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount > 0 && sheet.actualRowCount > 0) return sheet;
  }
  return workbook.worksheets[0];
}

// Real-world spreadsheets often have a title row, a blank spacer row, or merged
// banner cells above the actual column headers. Instead of assuming row 1 is
// the header, use the first row that looks like one (2+ distinct text cells).
function findHeaderRowNumber(worksheet) {
  let headerRowNumber = null;
  worksheet.eachRow((row, rowNumber) => {
    if (headerRowNumber !== null) return;
    const values = row.values.slice(1).map(cellToString).filter(Boolean);
    if (values.length >= 2) headerRowNumber = rowNumber;
  });
  return headerRowNumber ?? 1;
}

async function parseXlsx(filePath) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(filePath);
  } catch {
    const err = new Error(
      '엑셀 파일을 읽지 못했습니다. 구형 .xls 형식이면 엑셀에서 "다른 이름으로 저장" → .xlsx로 저장한 뒤 다시 올려주세요.'
    );
    err.status = 400;
    throw err;
  }

  const worksheet = pickNonEmptySheet(workbook);
  const headerRowNumber = findHeaderRowNumber(worksheet);

  const rawHeaders = [];
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < headerRowNumber) return; // skip title/banner rows above the header
    const values = row.values.slice(1).map(cellToString);
    if (rowNumber === headerRowNumber) {
      rawHeaders.push(...values);
      return;
    }
    const obj = {};
    rawHeaders.forEach((h, i) => {
      if (!h) return; // drop unnamed/blank columns
      obj[h] = values[i] !== undefined ? values[i] : '';
    });
    rows.push(obj);
  });

  const headers = rawHeaders.filter(Boolean);
  if (headers.length === 0) {
    const err = new Error('엑셀에서 컬럼 헤더를 찾지 못했습니다. 첫 데이터 시트에 컬럼명이 있는 행이 있는지 확인해주세요.');
    err.status = 400;
    throw err;
  }
  return { headers, rows };
}

function decodeCsvBuffer(buffer) {
  const utf8Text = buffer.toString('utf8');
  if (!utf8Text.includes('�')) return utf8Text;
  return iconv.decode(buffer, 'cp949');
}

function parseCsv(buffer) {
  const text = decodeCsvBuffer(buffer);
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  return { headers, rows: records };
}

async function parseFile(filePath, ext) {
  if (ext === 'csv') {
    const buffer = fs.readFileSync(filePath);
    return parseCsv(buffer);
  }
  return parseXlsx(filePath);
}

module.exports = { parseFile };
