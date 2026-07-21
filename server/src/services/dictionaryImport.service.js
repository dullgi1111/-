const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const fileParserService = require('./fileParser.service');
const canonicalTermsRepo = require('../repositories/canonicalTerms.repo');
const termAliasesRepo = require('../repositories/termAliases.repo');
const termDefinitionsRepo = require('../repositories/termDefinitions.repo');
const { normalizeSpaced } = require('../utils/textNormalize');

const LINE_SPLIT_RE = /\r?\n/;
// Common separators between a term and its description: colon, dash, tab, or 2+ spaces.
const LINE_PARTS_RE = /^(.{1,60}?)\s*[:：\-–\t]\s+(.+)$/;

// pdf-parse injects a "-- 1 of 3 --" style marker between pages inside the
// flattened .text output — not real content, must never be treated as a term.
const PAGE_MARKER_RE = /^--?\s*\d+\s+of\s+\d+\s*--?$/i;

function stripNoise(line) {
  return line
    .replace(/^\s*[•\-*·]\s*/, '') // leading bullet markers
    .replace(/^\d+[.)]\s*/, '') // leading numbering "1. " / "1) "
    .trim();
}

function parseFreeformText(text) {
  const rawLines = text.split(LINE_SPLIT_RE).map((l) => l.trim()).filter(Boolean);
  return rawLines
    .filter((l) => !PAGE_MARKER_RE.test(l))
    .map(stripNoise)
    .filter((l) => l.length > 0 && l.length <= 200) // drop stray long paragraphs, not term-list lines
    .map((line) => {
      const match = line.match(LINE_PARTS_RE);
      if (match) {
        return { canonicalText: match[1].trim(), description: match[2].trim() };
      }
      return { canonicalText: line, description: '' };
    });
}

async function parsePdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  // Join each page's own text directly rather than using result.text, which has
  // library-injected "-- N of M --" separators spliced in between pages.
  const text = Array.isArray(result.pages) && result.pages.length > 0
    ? result.pages.map((p) => p.text || '').join('\n')
    : result.text;
  return { mode: 'freeform', rows: parseFreeformText(text) };
}

async function parseDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return { mode: 'freeform', rows: parseFreeformText(result.value) };
}

async function parseSpreadsheet(filePath, ext) {
  const { headers, rows } = await fileParserService.parseFile(filePath, ext);
  return { mode: 'table', headers, rows };
}

async function parseDictionaryFile(filePath, ext) {
  if (ext === 'pdf') return parsePdf(filePath);
  if (ext === 'docx') return parseDocx(filePath);
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return parseSpreadsheet(filePath, ext);
  const err = new Error('지원하지 않는 파일 형식입니다 (.pdf, .docx, .xlsx, .xls, .csv만 가능)');
  err.status = 400;
  throw err;
}

const TABLE_TEXT_HINTS = ['용어', '표준용어', '단어', '명칭'];
const TABLE_DESC_HINTS = ['정의', '설명', '의미', '뜻', '내용'];
const TABLE_ALIAS_HINTS = ['별칭', '동의어', '유사어'];
const TABLE_CATEGORY_HINTS = ['대분류', '구분', '유형', '분류', '종류'];
const CATEGORY_VALUE_MAP = { 증상: 'symptom', 고장: 'symptom', 조치: 'action', 수리: 'action', 부품: 'part', 자재: 'part' };

function detectColumn(headers, hints, fallbackToFirst) {
  for (const h of headers) {
    if (hints.some((hint) => h.includes(hint))) return h;
  }
  return fallbackToFirst ? headers[0] : null;
}

function splitAliasCell(text) {
  return (text || '')
    .split(/[,;、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Keyword heuristic for "자동 분류": checked in this order because a phrase like
// "베어링 마모로 인한 교체" could contain both an action word and a symptom word —
// action wins first since "what was done" is the more specific signal, symptom
// second, and anything left over (mostly bare component names) falls to part.
const ACTION_HINTS = ['교체', '수리', '점검', '주입', '청소', '조정', '교환', '정비', '체결', '용접', '도장', '세척', '보충', '분해', '조립', '재설치', '수선', '충전', '보수'];
const SYMPTOM_HINTS = ['마모', '소음', '누유', '누출', '진동', '과열', '파손', '이상', '불량', '고장', '균열', '부식', '변형', '손상', '오작동', '정지', '떨림', '냄새', '마찰', '균등'];

function guessTermType(text) {
  const t = text || '';
  if (ACTION_HINTS.some((k) => t.includes(k))) return 'action';
  if (SYMPTOM_HINTS.some((k) => t.includes(k))) return 'symptom';
  return 'part';
}

// Parses one file and tags every resulting row with a term type. If `termType`
// is the fixed value the user picked, every row gets that type. If it's the
// 'auto' sentinel: a table row that already has a 구분/대분류-style column whose
// value maps cleanly to symptom/action/part uses that (it's ground truth, not a
// guess); otherwise falls back to the keyword heuristic on the term + definition text.
async function buildRowsForFile(termType, filePath, ext) {
  const parsed = await parseDictionaryFile(filePath, ext);
  const resolveType = (text, explicitCategory) => {
    if (termType !== 'auto') return termType;
    if (explicitCategory) {
      const mapped = CATEGORY_VALUE_MAP[explicitCategory.trim()];
      if (mapped) return mapped;
    }
    return guessTermType(text);
  };

  if (parsed.mode === 'freeform') {
    return parsed.rows.map((r) => ({
      termType: resolveType(`${r.canonicalText} ${r.description}`),
      canonicalText: r.canonicalText,
      description: r.description,
      aliases: [],
    }));
  }

  const { headers, rows } = parsed;
  const textCol = detectColumn(headers, TABLE_TEXT_HINTS, true);
  const descCol = detectColumn(headers, TABLE_DESC_HINTS, false);
  const aliasCol = detectColumn(headers, TABLE_ALIAS_HINTS, false);
  const categoryCol = detectColumn(headers, TABLE_CATEGORY_HINTS, false);

  return rows
    .map((row) => {
      const canonicalText = (row[textCol] || '').trim();
      const description = descCol ? row[descCol] : '';
      return {
        termType: resolveType(`${canonicalText} ${description}`, categoryCol ? row[categoryCol] : null),
        canonicalText,
        description,
        aliases: aliasCol ? splitAliasCell(row[aliasCol]) : [],
      };
    })
    .filter((r) => r.canonicalText);
}

const VALID_TERM_TYPES = new Set(['symptom', 'action', 'part']);

async function bulkImportTerms(rows) {
  const result = { created: 0, updatedExisting: 0, definitionsAdded: 0, aliasesAdded: 0, errors: [] };

  for (const [idx, row] of rows.entries()) {
    const termType = row.termType;
    const canonicalText = (row.canonicalText || '').trim();
    if (!VALID_TERM_TYPES.has(termType) || !canonicalText) {
      result.errors.push({ row: idx + 1, message: '구분 또는 용어가 비어있습니다' });
      continue;
    }

    const normalizedText = normalizeSpaced(canonicalText);
    let canonicalTerm = await canonicalTermsRepo.findByNormalized(termType, normalizedText);
    if (!canonicalTerm) {
      canonicalTerm = await canonicalTermsRepo.create({
        termType,
        canonicalText,
        normalizedText,
        origin: 'manual',
        needsReview: false,
      });
      result.created++;
    } else {
      result.updatedExisting++;
    }

    const definitionText = (row.description || '').trim();
    if (definitionText) {
      const inserted = await termDefinitionsRepo.create({
        canonicalTermId: canonicalTerm.id,
        definitionText,
        sourceLabel: row.sourceLabel || null,
      });
      if (inserted) result.definitionsAdded++;
    }

    const aliases = Array.isArray(row.aliases) ? row.aliases : [];
    for (const aliasText of aliases) {
      const trimmed = (aliasText || '').trim();
      if (!trimmed) continue;
      const normalizedAlias = normalizeSpaced(trimmed);
      if (normalizedAlias === normalizedText) continue; // same as canonical text itself
      await termAliasesRepo.create({
        canonicalTermId: canonicalTerm.id,
        aliasText: trimmed,
        normalizedAliasText: normalizedAlias,
        source: 'manual',
      });
      result.aliasesAdded++;
    }
  }

  return result;
}

module.exports = { parseDictionaryFile, buildRowsForFile, parseFreeformText, bulkImportTerms };
