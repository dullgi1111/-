const { pool } = require('../config/db');

async function list({ status, needsReview, search, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const params = [];
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  } else {
    conditions.push(`status != 'deprecated'`);
  }
  if (needsReview !== undefined) { params.push(needsReview); conditions.push(`needs_review = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`equipment_name ILIKE $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT * FROM equipment ${where} ORDER BY grade_num NULLS LAST, equipment_name LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM equipment WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByNormalized(normalizedName) {
  const { rows } = await pool.query(
    'SELECT * FROM equipment WHERE normalized_name = $1 AND status = $2',
    [normalizedName, 'active']
  );
  return rows[0] || null;
}

async function create({ equipmentName, normalizedName, modelNumber, manufacturer, spec, installDate, location, notes, origin = 'manual', needsReview = false }) {
  const { rows } = await pool.query(
    `INSERT INTO equipment (equipment_name, normalized_name, model_number, manufacturer, spec, install_date, location, notes, origin, needs_review)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [equipmentName, normalizedName, modelNumber || null, manufacturer || null, spec || null, installDate || null, location || null, notes || null, origin, needsReview]
  );
  return rows[0];
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
    `UPDATE equipment SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0];
}

async function incrementOccurrence(id) {
  await pool.query('UPDATE equipment SET occurrence_count = occurrence_count + 1 WHERE id = $1', [id]);
}

async function softDelete(id) {
  const { rows } = await pool.query(
    `UPDATE equipment SET status = 'deprecated', updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

async function findCandidatesByTrgm(normalizedName, { prefilter = 0.3, limitN = 20 } = {}) {
  const client = await pool.connect();
  try {
    await client.query(`SET pg_trgm.similarity_threshold = ${Number(prefilter)}`);
    const { rows } = await client.query(
      `SELECT id, equipment_name, normalized_name, similarity(normalized_name, $1) AS trgm_sim
       FROM equipment
       WHERE status = 'active' AND normalized_name % $1
       ORDER BY trgm_sim DESC LIMIT $2`,
      [normalizedName, limitN]
    );
    return rows;
  } finally {
    client.release();
  }
}

module.exports = { list, findById, findByNormalized, create, update, incrementOccurrence, softDelete, findCandidatesByTrgm };
