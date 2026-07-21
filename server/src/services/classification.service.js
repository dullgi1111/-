const { pool } = require('../config/db');
const settingsRepo = require('../repositories/settings.repo');

async function classify({ symptomText, actionText, mappedRawValue }) {
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

  const text = `${symptomText || ''} ${actionText || ''}`;
  const { rows: keywordRows } = await pool.query('SELECT keyword, maintenance_type, weight FROM classification_keywords');

  const scores = {};
  const matched = {};
  for (const { keyword, maintenance_type: maintenanceType, weight } of keywordRows) {
    if (text.includes(keyword)) {
      scores[maintenanceType] = (scores[maintenanceType] || 0) + Number(weight);
      matched[maintenanceType] = matched[maintenanceType] || [];
      matched[maintenanceType].push(keyword);
    }
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  let top = null;
  for (const [type, score] of Object.entries(scores)) {
    if (!top || score > top.score) top = { type, score };
  }

  if (!top || total === 0) {
    return { maintenanceType: 'unknown', source: 'keyword_classifier', rawValue: mappedRawValue || null, confidence: 0, matchedKeywords: [] };
  }

  const confidence = top.score / total;
  const tiedCount = Object.values(scores).filter((s) => s === top.score).length;
  const minConfidence = await settingsRepo.getNumber('classification_min_confidence', 0.15);

  if (confidence < minConfidence || tiedCount > 1) {
    return {
      maintenanceType: 'unknown',
      source: 'keyword_classifier',
      rawValue: mappedRawValue || null,
      confidence,
      matchedKeywords: matched[top.type] || [],
    };
  }

  return {
    maintenanceType: top.type,
    source: 'keyword_classifier',
    rawValue: mappedRawValue || null,
    confidence,
    matchedKeywords: matched[top.type] || [],
  };
}

module.exports = { classify };
