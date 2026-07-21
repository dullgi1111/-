import { get } from './client';

export function getSummary() {
  return get('/dashboard/summary');
}

export function getRecentDiscoveries(limit = 20) {
  return get(`/dashboard/recent-discoveries?limit=${limit}`);
}

export function getRecentMerges(limit = 20) {
  return get(`/dashboard/recent-merges?limit=${limit}`);
}

export function getTrends() {
  return get('/dashboard/trends');
}
