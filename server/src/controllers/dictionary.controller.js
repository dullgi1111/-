const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const canonicalTermsRepo = require('../repositories/canonicalTerms.repo');
const termAliasesRepo = require('../repositories/termAliases.repo');
const termDefinitionsRepo = require('../repositories/termDefinitions.repo');
const recordTermLinksRepo = require('../repositories/recordTermLinks.repo');
const { normalizeSpaced } = require('../utils/textNormalize');

const listTerms = asyncHandler(async (req, res) => {
  const { termType, status, needsReview, search, page, limit } = req.query;
  const rows = await canonicalTermsRepo.list({
    termType,
    status,
    needsReview: needsReview !== undefined ? needsReview === 'true' : undefined,
    search,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ data: rows });
});

const getTerm = asyncHandler(async (req, res) => {
  const term = await canonicalTermsRepo.findById(req.params.id);
  if (!term) return res.status(404).json({ error: { message: 'Term not found' } });
  const [aliases, definitions, recentRecords] = await Promise.all([
    termAliasesRepo.listByCanonicalTerm(term.id),
    termDefinitionsRepo.listByCanonicalTerm(term.id),
    recordTermLinksRepo.listRecordsUsingCanonicalTerm(term.id, 10),
  ]);
  res.json({ data: { ...term, aliases, definitions, recentRecords } });
});

const createTermSchema = z.object({
  termType: z.enum(['symptom', 'action', 'part']),
  canonicalText: z.string().min(1),
  description: z.string().optional(),
});

const createTerm = asyncHandler(async (req, res) => {
  const body = createTermSchema.parse(req.body);
  const normalizedText = normalizeSpaced(body.canonicalText);
  const term = await canonicalTermsRepo.create({
    termType: body.termType,
    canonicalText: body.canonicalText,
    normalizedText,
    origin: 'manual',
    needsReview: false,
  });
  if (body.description?.trim()) {
    await termDefinitionsRepo.create({
      canonicalTermId: term.id,
      definitionText: body.description.trim(),
      sourceLabel: '수동 등록',
    });
  }
  res.status(201).json({ data: term });
});

const updateTerm = asyncHandler(async (req, res) => {
  const fields = {};
  if (req.body.canonicalText !== undefined) {
    fields.canonical_text = req.body.canonicalText;
    fields.normalized_text = normalizeSpaced(req.body.canonicalText);
  }
  if (req.body.status !== undefined) fields.status = req.body.status;
  const term = await canonicalTermsRepo.update(req.params.id, fields);
  res.json({ data: term });
});

const markReviewed = asyncHandler(async (req, res) => {
  const term = await canonicalTermsRepo.update(req.params.id, { needs_review: false });
  res.json({ data: term });
});

const removeTerm = asyncHandler(async (req, res) => {
  const term = await canonicalTermsRepo.findById(req.params.id);
  if (!term) return res.status(404).json({ error: { message: 'Term not found' } });
  await canonicalTermsRepo.softDelete(req.params.id);
  res.status(204).send();
});

const removeAllTerms = asyncHandler(async (req, res) => {
  const deletedCount = await canonicalTermsRepo.softDeleteAll();
  res.json({ data: { deletedCount } });
});

const addAlias = asyncHandler(async (req, res) => {
  const { aliasText } = req.body;
  if (!aliasText) return res.status(400).json({ error: { message: 'aliasText가 필요합니다' } });
  const term = await canonicalTermsRepo.findById(req.params.id);
  if (!term) return res.status(404).json({ error: { message: 'Term not found' } });
  const alias = await termAliasesRepo.create({
    canonicalTermId: term.id,
    aliasText,
    normalizedAliasText: normalizeSpaced(aliasText),
    source: 'manual',
  });
  res.status(201).json({ data: alias });
});

const mergeTerms = asyncHandler(async (req, res) => {
  const { fromTermId, intoTermId } = req.body;
  if (!fromTermId || !intoTermId) {
    return res.status(400).json({ error: { message: 'fromTermId, intoTermId가 필요합니다' } });
  }
  if (String(fromTermId) === String(intoTermId)) {
    return res.status(400).json({ error: { message: '같은 용어로는 병합할 수 없습니다' } });
  }

  const fromTerm = await canonicalTermsRepo.findById(fromTermId);
  const intoTerm = await canonicalTermsRepo.findById(intoTermId);
  if (!fromTerm || !intoTerm) return res.status(404).json({ error: { message: 'Term not found' } });
  if (fromTerm.term_type !== intoTerm.term_type) {
    return res.status(400).json({ error: { message: '같은 term_type끼리만 병합할 수 있습니다' } });
  }

  await termAliasesRepo.create({
    canonicalTermId: intoTerm.id,
    aliasText: fromTerm.canonical_text,
    normalizedAliasText: fromTerm.normalized_text,
    source: 'manual',
  });
  await termAliasesRepo.reassignCanonicalTerm(fromTerm.id, intoTerm.id);
  await recordTermLinksRepo.reassignCanonicalLinks(fromTerm.id, intoTerm.id);
  const updatedFromTerm = await canonicalTermsRepo.update(fromTerm.id, { status: 'merged_away', merged_into_id: intoTerm.id });

  res.json({ data: { fromTerm: updatedFromTerm, intoTerm } });
});

module.exports = { listTerms, getTerm, createTerm, updateTerm, markReviewed, removeTerm, removeAllTerms, addAlias, mergeTerms };
