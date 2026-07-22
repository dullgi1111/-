import { get } from './client';

export function getHistory(equipmentName) {
  return get(`/equipment/${encodeURIComponent(equipmentName)}/history`);
}

export function getDetail(equipmentName) {
  return get(`/equipment/${encodeURIComponent(equipmentName)}/detail`);
}
