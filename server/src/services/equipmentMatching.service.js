const equipmentRepo = require('../repositories/equipment.repo');
const equipmentAliasesRepo = require('../repositories/equipmentAliases.repo');
const settingsRepo = require('../repositories/settings.repo');
const { normalizeSpaced, normalizeTight } = require('../utils/textNormalize');
const { scoreSimilarity } = require('../utils/similarity');

// Mirrors termMatching.service.js's classify/resolve split, applied to
// equipment (product) names instead of symptom/action/part phrases -- field
// techs write the same machine's name differently across files ("1호기 펌프"
// vs "1호기펌프"), so without this every spelling variant would show up as
// a separate piece of equipment in the stats.
async function resolveEquipmentName(rawName) {
  const spaced = normalizeSpaced(rawName);
  const tight = normalizeTight(rawName);
  if (!tight) return null;

  const exact = await equipmentRepo.findByNormalized(spaced);
  if (exact) {
    await equipmentRepo.incrementOccurrence(exact.id);
    return { equipmentId: exact.id, matchType: 'exact' };
  }

  const threshold = await settingsRepo.getNumber('term_merge_threshold', 0.85);
  const prefilter = await settingsRepo.getNumber('trgm_candidate_prefilter', 0.3);
  const limitN = await settingsRepo.getNumber('trgm_candidate_limit', 20);

  const [equipmentCandidates, aliasCandidates] = await Promise.all([
    equipmentRepo.findCandidatesByTrgm(spaced, { prefilter, limitN }),
    equipmentAliasesRepo.findCandidatesByTrgm(spaced, { prefilter, limitN }),
  ]);

  const exactAlias = aliasCandidates.find((c) => c.normalized_alias_text === spaced);
  if (exactAlias) {
    await equipmentRepo.incrementOccurrence(exactAlias.equipment_id);
    return { equipmentId: exactAlias.equipment_id, matchType: 'exact' };
  }

  let best = null;
  for (const cand of equipmentCandidates) {
    const score = scoreSimilarity(tight, normalizeTight(cand.normalized_name), spaced, cand.normalized_name);
    if (!best || score > best.score) best = { score, equipmentId: cand.id };
  }
  for (const cand of aliasCandidates) {
    const score = scoreSimilarity(tight, normalizeTight(cand.normalized_alias_text), spaced, cand.normalized_alias_text);
    if (!best || score > best.score) best = { score, equipmentId: cand.equipment_id };
  }

  if (best && best.score >= threshold) {
    await equipmentAliasesRepo.create({
      equipmentId: best.equipmentId,
      aliasText: rawName,
      normalizedAliasText: spaced,
      source: 'auto_merge',
      matchedSimilarity: best.score,
    });
    await equipmentRepo.incrementOccurrence(best.equipmentId);
    return { equipmentId: best.equipmentId, matchType: 'alias_auto_merge', similarityScore: best.score };
  }

  const created = await equipmentRepo.create({
    equipmentName: rawName,
    normalizedName: spaced,
    origin: 'auto_discovered',
    needsReview: true,
  });
  return { equipmentId: created.id, matchType: 'new_discovery' };
}

module.exports = { resolveEquipmentName };
