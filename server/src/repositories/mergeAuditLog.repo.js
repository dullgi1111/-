const { pool } = require('../config/db');

async function create({
  aliasId,
  canonicalTermId,
  aliasText,
  normalizedAliasText,
  similarityScore,
  algorithmVersion,
  sourceRecordId,
  mergedBy = 'system',
}) {
  const { rows } = await pool.query(
    `INSERT INTO term_merge_audit_log (alias_id, canonical_term_id, alias_text, normalized_alias_text, similarity_score, algorithm_version, source_record_id, merged_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [aliasId, canonicalTermId, aliasText, normalizedAliasText, similarityScore, algorithmVersion, sourceRecordId || null, mergedBy]
  );
  return rows[0];
}

async function list({ page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    'SELECT * FROM term_merge_audit_log ORDER BY merged_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM term_merge_audit_log WHERE id = $1', [id]);
  return rows[0] || null;
}

async function markReverted(id, { revertedBy, revertedReason }) {
  const { rows } = await pool.query(
    'UPDATE term_merge_audit_log SET reverted_at = now(), reverted_by = $2, reverted_reason = $3 WHERE id = $1 RETURNING *',
    [id, revertedBy, revertedReason]
  );
  return rows[0];
}

module.exports = { create, list, findById, markReverted };
