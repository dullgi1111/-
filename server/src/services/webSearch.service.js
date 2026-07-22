const env = require('../config/env');

// Google Custom Search JSON API returns a spelling.correctedQuery field
// when it thinks the query is a misspelling of something more common —
// that's the signal used here to flag a dictionary term as a possible typo.
async function checkSpelling(query) {
  if (!env.googleSearchApiKey || !env.googleSearchCx) {
    const err = new Error('웹 검색 기능이 아직 설정되지 않았습니다 (관리자 문의)');
    err.status = 503;
    throw err;
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', env.googleSearchApiKey);
  url.searchParams.set('cx', env.googleSearchCx);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '3');

  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json?.error?.message || '웹 검색 요청이 실패했습니다');
    err.status = res.status;
    throw err;
  }

  const correctedQuery = json.spelling?.correctedQuery || null;
  return {
    query,
    hasSuggestion: !!correctedQuery,
    suggestedText: correctedQuery,
    totalResults: json.searchInformation?.totalResults ?? null,
  };
}

module.exports = { checkSpelling };
