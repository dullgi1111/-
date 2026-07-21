import { get, post, del } from './client';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export function uploadFile(files, companySource, signal) {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  if (companySource) form.append('companySource', companySource);
  return post('/imports/upload', form, { signal });
}

export function preview(batchId) {
  return get(`/imports/${batchId}/preview`);
}

export function exportUrl(batchId) {
  return `${BASE_URL}/imports/${batchId}/export`;
}

export function setMapping(batchId, { companySource, columnMapping }) {
  return post(`/imports/${batchId}/mapping`, { companySource, columnMapping });
}

export function analyze(batchId) {
  return get(`/imports/${batchId}/analysis`);
}

export function commit(batchId) {
  return post(`/imports/${batchId}/commit`);
}

export function cancelBatch(batchId) {
  return post(`/imports/${batchId}/cancel`);
}

export function getBatch(batchId) {
  return get(`/imports/${batchId}`);
}

export function listBatches(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return get(`/imports${qs ? `?${qs}` : ''}`);
}

export function listErrors(batchId) {
  return get(`/imports/${batchId}/errors`);
}

export function removeBatch(batchId) {
  return del(`/imports/${batchId}`);
}
