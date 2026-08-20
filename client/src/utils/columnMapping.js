// Guesses which uploaded-file column maps to which system field, from the header
// text alone. Runs entirely client-side (no API call, no cost) in three tiers,
// each stricter tier tried first so the best available match wins:
//   1. exact match against a known synonym, ignoring outer whitespace
//   2. exact match ignoring ALL whitespace/punctuation ("설비 명" === "설비명")
//   3. fuzzy match (edit-distance + bigram overlap) against known synonyms, to
//      catch headers not in the synonym list at all (typos, unlisted phrasing)
const FUZZY_THRESHOLD = 0.55;
// Bigram-dice is noisy on short Korean header words (a single-character typo can wipe
// out 2 of 3 bigrams), so weight edit-distance similarity more heavily for that case.

export const SYSTEM_FIELD_HINTS = {
  equipmentName: [
    '설비명', '기기명', '장비명', '설비이름', '기기이름', '기계명',
    '설비', '기기', '장비', '기계', '호기명', '호기', '라인명', '라인',
  ],
  recordDate: [
    '점검일자', '정비일자', '작업일자', '수리일자', '발생일자', '등록일자',
    '점검날짜', '정비날짜', '작업날짜', '수리날짜', '발생일', '작업일시', '일시',
    '일자', '날짜',
  ],
  maintenanceType: [
    '정비유형', '정비구분', '작업구분', '점검구분', '정비종류', '작업유형',
    '구분', '유형', '종류',
  ],
  symptomText: [
    '고장증상', '고장내용', '고장현상', '불량내용', '이상현상', '발생내용', '문제점',
    '증상', '현상',
  ],
  actionText: [
    '조치내용', '조치사항', '수리내용', '작업내용', '처리내용', '정비내용',
    '수리사항', '수리방법', '조치결과', '조치',
  ],
  partText: [
    '부품명', '자재명', '교체부품', '사용부품', '부품리스트', '자재리스트',
    '부품', '자재',
  ],
  companySource: [
    '등록업체', '정비업체', '작업업체', '수리업체', '시공업체', '협력업체',
    '업체명', '업체',
  ],
};

function stripToTight(str) {
  return str.replace(/[\s_\-/().,·]/g, '');
}

function bigrams(str) {
  const grams = [];
  for (let i = 0; i < str.length - 1; i++) grams.push(str.slice(i, i + 2));
  return grams;
}

function diceCoefficient(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  const mapB = new Map();
  for (const g of bigramsB) mapB.set(g, (mapB.get(g) || 0) + 1);
  let intersection = 0;
  for (const g of bigramsA) {
    const count = mapB.get(g) || 0;
    if (count > 0) {
      intersection++;
      mapB.set(g, count - 1);
    }
  }
  return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev = curr;
  }
  return prev[n];
}

function levenshteinSimilarity(a, b) {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function fuzzyScore(a, b) {
  return 0.35 * diceCoefficient(a, b) + 0.65 * levenshteinSimilarity(a, b);
}

export function guessMapping(detectedColumns, systemFields, hints = SYSTEM_FIELD_HINTS) {
  const guessed = {};
  const confidence = {};
  const used = new Set();
  const candidates = detectedColumns.map((c) => {
    const trimmed = c.trim();
    return { raw: c, trimmed, tight: stripToTight(trimmed) };
  });

  // Exact/tight/partial matches are unambiguous string containment checks, so every
  // field gets a chance at those before any field falls back to fuzzy matching --
  // otherwise a weak fuzzy hit for an earlier field could steal a column that a later
  // field would have matched exactly (e.g. actionText fuzzy-claiming "정비업체" before
  // companySource gets to exact-match it).
  for (const field of systemFields) {
    const fieldHints = hints[field.key] || [];
    let match = null;

    // tier 1: exact match, outer whitespace only trimmed
    for (const hint of fieldHints) {
      const hit = candidates.find((c) => !used.has(c.raw) && c.trimmed === hint);
      if (hit) { match = hit.raw; break; }
    }

    // tier 2: exact match ignoring all whitespace/punctuation
    if (!match) {
      for (const hint of fieldHints) {
        const tightHint = stripToTight(hint);
        const hit = candidates.find((c) => !used.has(c.raw) && c.tight === tightHint);
        if (hit) { match = hit.raw; break; }
      }
    }

    // tier 3: substring containment either direction, on the tight form
    if (!match) {
      for (const hint of fieldHints) {
        const tightHint = stripToTight(hint);
        const hit = candidates.find(
          (c) => !used.has(c.raw) && (c.tight.includes(tightHint) || tightHint.includes(c.tight))
        );
        if (hit) { match = hit.raw; break; }
      }
    }

    if (match) {
      guessed[field.key] = match;
      confidence[field.key] = 'exact';
      used.add(match);
    }
  }

  // tier 4: fuzzy match against every hint, only for fields still unmatched, only run
  // after every field has had its shot at an unambiguous match above.
  for (const field of systemFields) {
    if (guessed[field.key]) continue;
    const fieldHints = hints[field.key] || [];
    let best = null;
    for (const c of candidates) {
      if (used.has(c.raw)) continue;
      for (const hint of fieldHints) {
        const score = fuzzyScore(c.tight, stripToTight(hint));
        if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
          best = { raw: c.raw, score };
        }
      }
    }
    if (best) {
      guessed[field.key] = best.raw;
      confidence[field.key] = 'fuzzy';
      used.add(best.raw);
    }
  }

  return { guessed, confidence };
}
