const { pool } = require('../config/db');

// Returns the inserted row, or null if this exact definition text was already
// recorded for this term (ON CONFLICT DO NOTHING returns no row in that case).
async function create({ canonicalTermId, definitionText, sourceLabel }) {
  const { rows } = await pool.query(
    `INSERT INTO term_definitions (canonical_term_id, definition_text, source_label)
     VALUES ($1,$2,$3)
     ON CONFLICT (canonical_term_id, definition_text) DO NOTHING
     RETURNING *`,
    [canonicalTermId, definitionText, sourceLabel || null]
  );
  return rows[0] || null;
}

async function listByCanonicalTerm(canonicalTermId) {
  const { rows } = await pool.query(
    'SELECT * FROM term_definitions WHERE canonical_term_id = $1 ORDER BY created_at DESC',
    [canonicalTermId]
  );
  return rows;
}

module.exports = { create, listByCanonicalTerm };
