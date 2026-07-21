// Merges multiple {headers, rows} parse results into one, unioning headers
// across files so rows from a file missing a column just get '' for it.
function mergeTables(parsedFiles) {
  const headers = [];
  const seen = new Set();
  for (const { headers: fileHeaders } of parsedFiles) {
    for (const h of fileHeaders) {
      if (!seen.has(h)) {
        seen.add(h);
        headers.push(h);
      }
    }
  }

  const rows = [];
  for (const { rows: fileRows } of parsedFiles) {
    for (const row of fileRows) {
      const merged = {};
      for (const h of headers) {
        merged[h] = row[h] !== undefined ? row[h] : '';
      }
      rows.push(merged);
    }
  }

  return { headers, rows };
}

module.exports = { mergeTables };
