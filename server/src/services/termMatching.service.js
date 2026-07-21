const canonicalTermsRepo = require('../repositories/canonicalTerms.repo');
const termAliasesRepo = require('../repositories/termAliases.repo');
const mergeAuditLogRepo = require('../repositories/mergeAuditLog.repo');
const settingsRepo = require('../repositories/settings.repo');
const { normalizeSpaced, normalizeTight } = require('../utils/textNormalize');
const { scoreSimilarity, ALGORITHM_VERSION } = require('../utils/similarity');

// Read-only: figures out how a phrase WOULD be matched against the dictionary,
// without writing anything. Shared by the real (writing) pipeline and by the
// dry-run analysis used to preview an upload before committing it.
async function classifyPhrase({ termType, rawPhrase }) {
  const spaced = normalizeSpaced(rawPhrase);
  const tight = normalizeTight(rawPhrase);
  if (!tight) return null;

  const exactCanonical = await canonicalTermsRepo.findByNormalized(termType, spaced);
  if (exactCanonical) {
    return { matchType: 'exact', canonicalTermId: exactCanonical.id, aliasId: null, similarityScore: 1, spaced, tight };
  }

  const threshold = await settingsRepo.getNumber('term_merge_threshold', 0.85);
  const prefilter = await settingsRepo.getNumber('trgm_candidate_prefilter', 0.3);
  const limitN = await settingsRepo.getNumber('trgm_candidate_limit', 20);

  const [canonicalCandidates, aliasCandidates] = await Promise.all([
    canonicalTermsRepo.findCandidatesByTrgm(termType, spaced, { prefilter, limitN }),
    termAliasesRepo.findCandidatesByTrgm(termType, spaced, { prefilter, limitN }),
  ]);

  const exactAlias = aliasCandidates.find((c) => c.normalized_alias_text === spaced);
  if (exactAlias) {
    return { matchType: 'exact', canonicalTermId: exactAlias.canonical_term_id, aliasId: exactAlias.id, similarityScore: 1, spaced, tight };
  }

  let best = null;
  for (const cand of canonicalCandidates) {
    const score = scoreSimilarity(tight, normalizeTight(cand.normalized_text), spaced, cand.normalized_text);
    if (!best || score > best.score) best = { score, canonicalTermId: cand.id };
  }
  for (const cand of aliasCandidates) {
    const score = scoreSimilarity(tight, normalizeTight(cand.normalized_alias_text), spaced, cand.normalized_alias_text);
    if (!best || score > best.score) best = { score, canonicalTermId: cand.canonical_term_id };
  }

  if (best && best.score >= threshold) {
    return { matchType: 'would_auto_merge', canonicalTermId: best.canonicalTermId, aliasId: null, similarityScore: best.score, spaced, tight };
  }

  return { matchType: 'new_discovery', canonicalTermId: null, aliasId: null, similarityScore: best ? best.score : null, spaced, tight };
}

async function resolvePhrase({ termType, rawPhrase, sourceRecordId }) {
  const classification = await classifyPhrase({ termType, rawPhrase });
  if (!classification) return null;
  const { matchType, spaced } = classification;

  if (matchType === 'exact') {
    await canonicalTermsRepo.incrementOccurrence(classification.canonicalTermId);
    return { canonicalTermId: classification.canonicalTermId, aliasId: classification.aliasId, matchType: 'exact', similarityScore: 1 };
  }

  if (matchType === 'would_auto_merge') {
    const alias = await termAliasesRepo.create({
      canonicalTermId: classification.canonicalTermId,
      aliasText: rawPhrase,
      normalizedAliasText: spaced,
      source: 'auto_merge',
      matchedSimilarity: classification.similarityScore,
      matchedAlgorithmVersion: ALGORITHM_VERSION,
      matchedAt: new Date(),
      sourceRecordId: sourceRecordId || null,
    });
    await canonicalTermsRepo.incrementOccurrence(classification.canonicalTermId);
    await mergeAuditLogRepo.create({
      aliasId: alias.id,
      canonicalTermId: classification.canonicalTermId,
      aliasText: rawPhrase,
      normalizedAliasText: spaced,
      similarityScore: classification.similarityScore,
      algorithmVersion: ALGORITHM_VERSION,
      sourceRecordId: sourceRecordId || null,
      mergedBy: 'system',
    });
    return { canonicalTermId: classification.canonicalTermId, aliasId: alias.id, matchType: 'alias_auto_merge', similarityScore: classification.similarityScore };
  }

  const created = await canonicalTermsRepo.create({
    termType,
    canonicalText: rawPhrase,
    normalizedText: spaced,
    origin: 'auto_discovered',
    needsReview: true,
  });
  return { canonicalTermId: created.id, aliasId: null, matchType: 'new_discovery', similarityScore: classification.similarityScore };
}

module.exports = { resolvePhrase, classifyPhrase };
