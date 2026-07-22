import { get, post, put, del } from './client';

export function listTerms(params = {}) {
  const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const qs = new URLSearchParams(cleaned).toString();
  return get(`/dictionary/terms${qs ? `?${qs}` : ''}`);
}

export function getTerm(id) {
  return get(`/dictionary/terms/${id}`);
}

export function createTerm(payload) {
  return post('/dictionary/terms', payload);
}

export function updateTerm(id, payload) {
  return put(`/dictionary/terms/${id}`, payload);
}

export function markReviewed(id) {
  return post(`/dictionary/terms/${id}/mark-reviewed`);
}

export function removeTerm(id) {
  return del(`/dictionary/terms/${id}`);
}

export function removeAllTerms() {
  return del('/dictionary/terms/all');
}

export function addAlias(id, aliasText) {
  return post(`/dictionary/terms/${id}/aliases`, { aliasText });
}

export function mergeTerms(fromTermId, intoTermId) {
  return post('/dictionary/merge', { fromTermId, intoTermId });
}

export function checkTypo(id) {
  return post(`/dictionary/terms/${id}/check-typo`);
}

export function applyCorrection(id, correctedText) {
  return post(`/dictionary/terms/${id}/apply-correction`, { correctedText });
}

// entries: [{ file: File, termTypes: Array<'symptom'|'action'|'part'> }]
// A file tagged with multiple types is appended once per type, so its content
// gets imported separately under each selected term type.
export function importFiles(entries, signal) {
  const form = new FormData();
  for (const { file, termTypes } of entries) {
    for (const termType of termTypes) form.append(termType, file);
  }
  return post('/dictionary/import', form, { signal });
}
