import { get, put } from './client';

export function getSettings() {
  return get('/settings');
}

export function updateSettings(updates) {
  return put('/settings', updates);
}
