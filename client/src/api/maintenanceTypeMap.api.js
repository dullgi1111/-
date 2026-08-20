import { get, post, del } from './client';

export function listMappings() {
  return get('/maintenance-type-map');
}

export function createMapping({ rawValue, maintenanceType }) {
  return post('/maintenance-type-map', { rawValue, maintenanceType });
}

export function removeMapping(id) {
  return del(`/maintenance-type-map/${id}`);
}
