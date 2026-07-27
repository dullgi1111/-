const { pool } = require('../config/db');

async function create({ equipmentId, aliasText, normalizedAliasText, source, matchedSimilarity }) {
  const { rows } = await pool.query(
    `INSERT INTO equipment_aliases (equipment_id, alias_text, normalized_alias_text, source, matched_similarity)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (equipment_id, normalized_alias_text) DO UPDATE SET alias_text = EXCLUDED.alias_text
     RETURNING *`,
    [equipmentId, aliasText, normalizedAliasText, source, matchedSimilarity ?? null]
  );
  return rows[0];
}

async function findCandidatesByTrgm(normalizedText, { prefilter = 0.3, limitN = 20 } = {}) {
  const client = await pool.connect();
  try {
    await client.query(`SET pg_trgm.similarity_threshold = ${Number(prefilter)}`);
    const { rows } = await client.query(
      `SELECT a.id, a.equipment_id, a.alias_text, a.normalized_alias_text, similarity(a.normalized_alias_text, $1) AS trgm_sim
       FROM equipment_aliases a
       JOIN equipment e ON e.id = a.equipment_id
       WHERE e.status = 'active' AND a.normalized_alias_text % $1
       ORDER BY trgm_sim DESC LIMIT $2`,
      [normalizedText, limitN]
    );
    return rows;
  } finally {
    client.release();
  }
}

async function listByEquipment(equipmentId) {
  const { rows } = await pool.query(
    'SELECT * FROM equipment_aliases WHERE equipment_id = $1 ORDER BY created_at DESC',
    [equipmentId]
  );
  return rows;
}

module.exports = { create, findCandidatesByTrgm, listByEquipment };
