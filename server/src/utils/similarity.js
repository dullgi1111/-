const { distance } = require('fastest-levenshtein');

const ALGORITHM_VERSION = 'dice+lev+jaccard-v1';

function bigrams(str) {
  const grams = [];
  for (let i = 0; i < str.length - 1; i++) {
    grams.push(str.slice(i, i + 2));
  }
  return grams;
}

function diceCoefficient(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  const mapB = new Map();
  for (const g of bigramsB) {
    mapB.set(g, (mapB.get(g) || 0) + 1);
  }
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

function levenshteinSimilarity(a, b) {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance(a, b) / maxLen;
}

function jaccardTokenSet(a, b) {
  const setA = new Set(a.split(' ').filter(Boolean));
  const setB = new Set(b.split(' ').filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function scoreSimilarity(tightA, tightB, spacedA, spacedB) {
  const dice = diceCoefficient(tightA, tightB);
  const lev = levenshteinSimilarity(tightA, tightB);
  // If the space-stripped forms already match exactly, word-tokenization is just an
  // artifact of whether the source text happened to contain spaces (e.g. "모터교체" vs
  // "모터 교체") — token-set Jaccard would wrongly score that 0 since one side has a
  // single token. Treat that case as fully order-consistent instead of penalizing it.
  const jaccard = tightA === tightB ? 1 : jaccardTokenSet(spacedA, spacedB);
  return 0.4 * dice + 0.3 * lev + 0.3 * jaccard;
}

module.exports = { diceCoefficient, levenshteinSimilarity, jaccardTokenSet, scoreSimilarity, ALGORITHM_VERSION };
