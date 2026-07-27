import { get, post, put, del } from './client';

export function listEquipment(params = {}) {
  const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const qs = new URLSearchParams(cleaned).toString();
  return get(`/equipment${qs ? `?${qs}` : ''}`);
}

export function getEquipment(id) {
  return get(`/equipment/${id}`);
}

export function createEquipment(payload) {
  return post('/equipment', payload);
}

export function updateEquipment(id, payload) {
  return put(`/equipment/${id}`, payload);
}

export function removeEquipment(id) {
  return del(`/equipment/${id}`);
}

export function getHistory(equipmentId) {
  return get(`/equipment/${equipmentId}/history`);
}

export function getDetail(equipmentId) {
  return get(`/equipment/${equipmentId}/detail`);
}
