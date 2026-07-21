const { pool } = require('../config/db');

async function list({ termType, status, needsReview, search, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const params = [];
  if (termType) { params.push(termType); conditions.push(`ct.term_type = $${params.length}`); }
  if (status) {
    params.push(status);
    conditions.push(`ct.status = $${params.length}`);
  } else {
    // Deleted terms are soft-deleted to 'deprecated' — hide them from the default view.
    conditions.push(`ct.status != 'deprecated'`);
  }
  if (needsReview !== undefined) { params.push(needsReview); conditions.push(`ct.needs_review = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`ct.canonical_text ILIKE $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT ct.*, COALESCE(d.definition_count, 0) AS definition_count
     FROM canonical_terms ct
     LEFT JOIN (
       SELECT canonical_term_id, COUNT(*)::int AS definition_count
       FROM term_definitions
       GROUP BY canonical_term_id
     ) d ON d.canonical_term_id = ct.id
     ${where}
     ORDER BY ct.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM canonical_terms WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByNormalized(termType, normalizedText) {
  const { rows } = await pool.query(
    'SELECT * FROM canonical_terms WHERE term_type = $1 AND normalized_text = $2 AND status = $3',
    [termType, normalizedText, 'active']
  );
  return rows[0] || null;
}

async function create({ termType, canonicalText, normalizedText, description, origin = 'manual', needsReview = false }) {
  const { rows } = await pool.query(
    `INSERT INTO canonical_terms (term_type, canonical_text, normalized_text, description, origin, needs_review)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [termType, canonicalText, normalizedText, description || null, origin, needsReview]
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
    `UPDATE canonical_terms SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0];
}

async function incrementOccurrence(id) {
  await pool.query('UPDATE canonical_terms SET occurrence_count = occurrence_count + 1 WHERE id = $1', [id]);
}

async function softDelete(id) {
  const { rows } = await pool.query(
    `UPDATE canonical_terms SET status = 'deprecated', updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

async function softDeleteAll() {
  const { rowCount } = await pool.query(
    `UPDATE canonical_terms SET status = 'deprecated', updated_at = now() WHERE status != 'deprecated'`
  );
  return rowCount;
}

async function findCandidatesByTrgm(termType, normalizedText, { prefilter = 0.3, limitN = 20 } = {}) {
  const client = await pool.connect();
  try {
    await client.query(`SET pg_trgm.similarity_threshold = ${Number(prefilter)}`);
    const { rows } = await client.query(
      `SELECT id, canonical_text, normalized_text, similarity(normalized_text, $1) AS trgm_sim
       FROM canonical_terms
       WHERE term_type = $2 AND status = 'active' AND normalized_text % $1
       ORDER BY trgm_sim DESC LIMIT $3`,
      [normalizedText, termType, limitN]
    );
    return rows;
  } finally {
    client.release();
  }
}

module.exports = { list, findById, findByNormalized, create, update, incrementOccurrence, softDelete, softDeleteAll, findCandidatesByTrgm };
