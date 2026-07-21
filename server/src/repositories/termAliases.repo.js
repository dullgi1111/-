const { pool } = require('../config/db');

async function create({
  canonicalTermId,
  aliasText,
  normalizedAliasText,
  source,
  matchedSimilarity,
  matchedAlgorithmVersion,
  matchedAt,
  sourceRecordId,
}) {
  const { rows } = await pool.query(
    `INSERT INTO term_aliases (canonical_term_id, alias_text, normalized_alias_text, source, matched_similarity, matched_algorithm_version, matched_at, source_record_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (canonical_term_id, normalized_alias_text) DO UPDATE SET alias_text = EXCLUDED.alias_text
     RETURNING *`,
    [
      canonicalTermId,
      aliasText,
      normalizedAliasText,
      source,
      matchedSimilarity ?? null,
      matchedAlgorithmVersion || null,
      matchedAt || null,
      sourceRecordId || null,
    ]
  );
  return rows[0];
}

async function findCandidatesByTrgm(termType, normalizedText, { prefilter = 0.3, limitN = 20 } = {}) {
  const client = await pool.connect();
  try {
    await client.query(`SET pg_trgm.similarity_threshold = ${Number(prefilter)}`);
    const { rows } = await client.query(
      `SELECT a.id, a.canonical_term_id, a.alias_text, a.normalized_alias_text, similarity(a.normalized_alias_text, $1) AS trgm_sim
       FROM term_aliases a
       JOIN canonical_terms c ON c.id = a.canonical_term_id
       WHERE c.term_type = $2 AND c.status = 'active' AND a.normalized_alias_text % $1
       ORDER BY trgm_sim DESC LIMIT $3`,
      [normalizedText, termType, limitN]
    );
    return rows;
  } finally {
    client.release();
  }
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM term_aliases WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listByCanonicalTerm(canonicalTermId) {
  const { rows } = await pool.query(
    'SELECT * FROM term_aliases WHERE canonical_term_id = $1 ORDER BY created_at DESC',
    [canonicalTermId]
  );
  return rows;
}

async function deleteById(id) {
  await pool.query('DELETE FROM term_aliases WHERE id = $1', [id]);
}

async function reassignCanonicalTerm(oldCanonicalTermId, newCanonicalTermId) {
  await pool.query('UPDATE term_aliases SET canonical_term_id = $2 WHERE canonical_term_id = $1', [
    oldCanonicalTermId,
    newCanonicalTermId,
  ]);
}

module.exports = { create, findCandidatesByTrgm, findById, listByCanonicalTerm, deleteById, reassignCanonicalTerm };
