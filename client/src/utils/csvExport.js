function escapeCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers, rows, accessor) {
  const lines = [headers.map(({ label }) => escapeCsvField(label)).join(',')];
  for (const row of rows) {
    lines.push(headers.map(({ key }) => escapeCsvField(accessor ? accessor(row, key) : row[key])).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCsv(filename, headers, rows, accessor) {
  const csv = buildCsv(headers, rows, accessor);
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
