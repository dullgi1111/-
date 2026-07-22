import { get, del } from './client';

export function listRecords(params = {}) {
  const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const qs = new URLSearchParams(cleaned).toString();
  return get(`/records${qs ? `?${qs}` : ''}`);
}

export function getRecord(id) {
  return get(`/records/${id}`);
}

export function removeRecord(id) {
  return del(`/records/${id}`);
}

export function removeAllRecords() {
  return del('/records/all');
}
