const asyncHandler = require('../middleware/asyncHandler');
const mergeAuditLogRepo = require('../repositories/mergeAuditLog.repo');
const termAliasesRepo = require('../repositories/termAliases.repo');
const canonicalTermsRepo = require('../repositories/canonicalTerms.repo');
const recordTermLinksRepo = require('../repositories/recordTermLinks.repo');

const listMerges = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const rows = await mergeAuditLogRepo.list({ page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
  res.json({ data: rows });
});

const revertMerge = asyncHandler(async (req, res) => {
  const log = await mergeAuditLogRepo.findById(req.params.id);
  if (!log) return res.status(404).json({ error: { message: 'Merge log not found' } });
  if (log.reverted_at) return res.status(400).json({ error: { message: '이미 되돌린 병합입니다' } });

  const alias = log.alias_id ? await termAliasesRepo.findById(log.alias_id) : null;
  const originalCanonicalTerm = alias ? await canonicalTermsRepo.findById(alias.canonical_term_id) : null;
  const termType = originalCanonicalTerm ? originalCanonicalTerm.term_type : 'symptom';

  let newTerm = await canonicalTermsRepo.findByNormalized(termType, log.normalized_alias_text);
  if (!newTerm) {
    newTerm = await canonicalTermsRepo.create({
      termType,
      canonicalText: log.alias_text,
      normalizedText: log.normalized_alias_text,
      origin: 'manual',
      needsReview: true,
    });
  }

  if (alias) {
    await recordTermLinksRepo.reassignAliasLinks(alias.id, newTerm.id);
    await termAliasesRepo.deleteById(alias.id);
  }

  const reverted = await mergeAuditLogRepo.markReverted(log.id, {
    revertedBy: req.body.revertedBy || 'user',
    revertedReason: req.body.reason || null,
  });

  res.json({ data: { auditLog: reverted, newTerm } });
});

module.exports = { listMerges, revertMerge };
