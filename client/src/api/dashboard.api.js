import { get } from './client';

export function getSummary() {
  return get('/dashboard/summary');
}

export function getTrends() {
  return get('/dashboard/trends');
}

export function getEquipmentStats() {
  return get('/dashboard/equipment-stats');
}

export function getEquipmentLines() {
  return get('/dashboard/equipment-lines');
}

export function getSymptomOptions() {
  return get('/dashboard/symptom-options');
}

export function getWorkTeamOptions() {
  return get('/dashboard/work-team-options');
}

export function getReport(dateFrom, dateTo, groupBy) {
  const qs = new URLSearchParams({ dateFrom, dateTo, ...(groupBy ? { groupBy } : {}) }).toString();
  return get(`/dashboard/report?${qs}`);
}

export function getActivityLog(limit = 100) {
  return get(`/dashboard/activity-log?limit=${limit}`);
}
