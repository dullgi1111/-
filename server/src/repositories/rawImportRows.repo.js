const { pool } = require('../config/db');

const CHUNK_SIZE = 500;

async function createMany(batchId, rows) {
  if (rows.length === 0) return [];
  const inserted = [];
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const chunk = rows.slice(start, start + CHUNK_SIZE);
    const valuePlaceholders = [];
    const params = [];
    chunk.forEach((row, idx) => {
      const rowNumber = start + idx + 1;
      params.push(batchId, rowNumber, JSON.stringify(row));
      const base = params.length - 3;
      valuePlaceholders.push(`($${base + 1},$${base + 2},$${base + 3})`);
    });
    const { rows: result } = await pool.query(
      `INSERT INTO raw_import_rows (batch_id, row_number, raw_data) VALUES ${valuePlaceholders.join(',')} RETURNING *`,
      params
    );
    inserted.push(...result);
  }
  return inserted;
}

async function listByBatch(batchId, { status } = {}) {
  const params = [batchId];
  let where = 'WHERE batch_id = $1';
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  const { rows } = await pool.query(`SELECT * FROM raw_import_rows ${where} ORDER BY row_number`, params);
  return rows;
}

async function markStatus(id, status, errorMessage) {
  await pool.query('UPDATE raw_import_rows SET status = $2, error_message = $3 WHERE id = $1', [id, status, errorMessage || null]);
}

module.exports = { createMany, listByBatch, markStatus };
