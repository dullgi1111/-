const MAX_PHRASE_LENGTH = 40;

function splitPhrases(text) {
  if (!text) return [];
  return text
    .split(/[,/·、;]|\s+및\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function isTooLong(phrase) {
  return phrase.length > MAX_PHRASE_LENGTH;
}

module.exports = { splitPhrases, isTooLong, MAX_PHRASE_LENGTH };
