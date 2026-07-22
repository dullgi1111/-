const { pool } = require('../config/db');

async function create({ recordId, fieldType, rawPhrase, canonicalTermId, aliasId, matchType, similarityScore }) {
  const { rows } = await pool.query(
    `INSERT INTO record_term_links (record_id, field_type, raw_phrase, canonical_term_id, alias_id, match_type, similarity_score)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [recordId, fieldType, rawPhrase, canonicalTermId || null, aliasId || null, matchType, similarityScore ?? null]
  );
  return rows[0];
}

async function listForRecord(recordId) {
  const { rows } = await pool.query(
    `SELECT l.*, ct.canonical_text, ct.term_type, ct.needs_review
     FROM record_term_links l
     LEFT JOIN canonical_terms ct ON ct.id = l.canonical_term_id
     WHERE l.record_id = $1
     ORDER BY l.field_type, l.id`,
    [recordId]
  );
  return rows;
}

async function listRecordsUsingCanonicalTerm(canonicalTermId, limit = 10) {
  const { rows } = await pool.query(
    `SELECT mr.id, mr.equipment_name, mr.record_date, mr.maintenance_type
     FROM maintenance_records mr
     WHERE mr.is_deleted = false
       AND EXISTS (SELECT 1 FROM record_term_links l WHERE l.record_id = mr.id AND l.canonical_term_id = $1)
     ORDER BY mr.record_date DESC, mr.id DESC
     LIMIT $2`,
    [canonicalTermId, limit]
  );
  return rows;
}

async function topTermsForEquipment(equipmentName, limit = 5) {
  const { rows } = await pool.query(
    `SELECT l.field_type, ct.canonical_text, COUNT(*)::int AS count
     FROM record_term_links l
     JOIN maintenance_records mr ON mr.id = l.record_id
     JOIN canonical_terms ct ON ct.id = l.canonical_term_id
     WHERE mr.equipment_name = $1 AND mr.is_deleted = false
     GROUP BY l.field_type, ct.canonical_text
     ORDER BY count DESC`,
    [equipmentName]
  );
  const byType = { symptom: [], action: [], part: [] };
  for (const row of rows) {
    const bucket = byType[row.field_type];
    if (bucket && bucket.length < limit) {
      bucket.push({ text: row.canonical_text, count: row.count });
    }
  }
  return byType;
}

async function reassignAliasLinks(aliasId, newCanonicalTermId) {
  await pool.query(
    `UPDATE record_term_links SET canonical_term_id = $2, alias_id = NULL, match_type = 'new_discovery' WHERE alias_id = $1`,
    [aliasId, newCanonicalTermId]
  );
}

async function reassignCanonicalLinks(oldCanonicalTermId, newCanonicalTermId) {
  await pool.query('UPDATE record_term_links SET canonical_term_id = $2 WHERE canonical_term_id = $1', [
    oldCanonicalTermId,
    newCanonicalTermId,
  ]);
}

module.exports = {
  create,
  listForRecord,
  listRecordsUsingCanonicalTerm,
  topTermsForEquipment,
  reassignAliasLinks,
  reassignCanonicalLinks,
};
