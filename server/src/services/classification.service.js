const { pool } = require('../config/db');

// Deterministic rule-table lookup: 현상(등) 원본값 -> 정비유형.
// No scoring, no confidence threshold, no guessing. A raw value that
// isn't in the table yet is 'unmapped' -- it stays unconfirmed and shows
// up in the "분류 검토 필요" queue for a person to assign, instead of
// being silently classified by keyword weight. The rule table itself is
// editable from the 정비유형 판정표 screen, not hardcoded here.
async function classify({ mappedRawValue }) {
  if (mappedRawValue) {
    const normalized = mappedRawValue.trim().toLowerCase();
    const { rows } = await pool.query(
      'SELECT maintenance_type FROM maintenance_type_value_map WHERE raw_value_normalized = $1',
      [normalized]
    );
    if (rows[0]) {
      return {
        maintenanceType: rows[0].maintenance_type,
        source: 'mapped_column',
        rawValue: mappedRawValue,
        confidence: null,
        matchedKeywords: [],
      };
    }
  }

  return {
    maintenanceType: 'unknown',
    source: 'unmapped',
    rawValue: mappedRawValue || null,
    confidence: null,
    matchedKeywords: [],
  };
}

module.exports = { classify };
