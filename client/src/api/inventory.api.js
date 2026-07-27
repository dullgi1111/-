import { get, put } from './client';

export function listInventory(params = {}) {
  const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const qs = new URLSearchParams(cleaned).toString();
  return get(`/inventory${qs ? `?${qs}` : ''}`);
}

export function updateInventory(termId, payload) {
  return put(`/inventory/${termId}`, payload);
}
