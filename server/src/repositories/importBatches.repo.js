const { pool } = require('../config/db');

async function create(fields) {
  const columns = Object.keys(fields);
  const params = Object.values(fields);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const { rows } = await pool.query(
    `INSERT INTO import_batches (${columns.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`,
    params
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM import_batches WHERE id = $1', [id]);
  return rows[0] || null;
}

async function update(id, fields) {
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    params.push(value);
    sets.push(`${key} = $${params.length}`);
  }
  params.push(id);
  const { rows } = await pool.query(
    `UPDATE import_batches SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0];
}

async function list({ status, companySource, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  if (companySource) { params.push(companySource); conditions.push(`company_source = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT * FROM import_batches ${where} ORDER BY uploaded_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function remove(id) {
  await pool.query('DELETE FROM import_batches WHERE id = $1', [id]);
}

module.exports = { create, findById, update, list, remove };
