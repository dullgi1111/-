const columnMappingService = require('./columnMapping.service');
const termMatchingService = require('./termMatching.service');
const { splitPhrases, isTooLong } = require('../utils/phraseSplit');

const FIELD_TO_TERM_TYPE = { symptomText: 'symptom', actionText: 'action', partText: 'part' };
const MAX_SAMPLE_PHRASES = 15;

// Dry-run: mirrors what the real import pipeline would do to each row's free-text
// fields, without writing anything to the database, so the upload wizard can show
// a "here's what will happen" summary before the user commits.
async function analyzeRows(rows, columnMapping) {
  const stats = {
    totalRows: rows.length,
    missingRequiredCount: 0,
    phrase: { total: 0, exact: 0, wouldAutoMerge: 0, newDiscovery: 0, skippedTooLong: 0 },
    sampleNewPhrases: [],
  };

  // Tracks phrases this dry-run has already classified as "new" so a phrase
  // repeated across many rows in the same file is only counted once — the real
  // pipeline would create it on the first row and exact-match it on the rest.
  const virtuallyCreated = new Set();

  for (const row of rows) {
    const mapped = columnMappingService.applyMapping(row, columnMapping);
    if (!mapped.equipmentName || !mapped.recordDate) {
      stats.missingRequiredCount++;
      continue; // the real pipeline errors this row out before it ever reaches term matching
    }

    for (const [field, termType] of Object.entries(FIELD_TO_TERM_TYPE)) {
      const phrases = splitPhrases(mapped[field]);
      for (const phrase of phrases) {
        if (isTooLong(phrase)) {
          stats.phrase.skippedTooLong++;
          continue;
        }

        const classification = await termMatchingService.classifyPhrase({ termType, rawPhrase: phrase });
        if (!classification) continue;
        stats.phrase.total++;

        if (classification.matchType === 'exact') {
          stats.phrase.exact++;
        } else if (classification.matchType === 'would_auto_merge') {
          stats.phrase.wouldAutoMerge++;
        } else {
          const key = `${termType}:${classification.spaced}`;
          if (virtuallyCreated.has(key)) {
            stats.phrase.exact++;
          } else {
            virtuallyCreated.add(key);
            stats.phrase.newDiscovery++;
            if (stats.sampleNewPhrases.length < MAX_SAMPLE_PHRASES) {
              stats.sampleNewPhrases.push({ termType, phrase });
            }
          }
        }
      }
    }
  }

  return stats;
}

module.exports = { analyzeRows };
