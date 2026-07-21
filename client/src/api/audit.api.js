import { get, post } from './client';

export function listMerges(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return get(`/audit/merges${qs ? `?${qs}` : ''}`);
}

export function revertMerge(id, reason) {
  return post(`/audit/merges/${id}/revert`, { reason });
}
