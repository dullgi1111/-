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

export function getReport(dateFrom, dateTo) {
  return get(`/dashboard/report?dateFrom=${dateFrom}&dateTo=${dateTo}`);
}
