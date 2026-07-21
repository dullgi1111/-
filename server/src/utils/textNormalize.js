function normalizeSpaced(s) {
  if (!s) return '';
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()·・"'"''、]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTight(s) {
  return normalizeSpaced(s).replace(/\s+/g, '');
}

module.exports = { normalizeSpaced, normalizeTight };
