const REQUIRED_FIELDS = ['equipmentName', 'recordDate'];
const SYSTEM_FIELDS = ['equipmentName', 'recordDate', 'maintenanceType', 'symptomText', 'actionText', 'partText', 'companySource'];

function validateMapping(mapping) {
  if (!mapping || typeof mapping !== 'object') {
    const err = new Error('컬럼 매핑 정보가 없습니다');
    err.status = 400;
    throw err;
  }
  const missing = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  if (missing.length > 0) {
    const err = new Error(`필수 필드가 매핑되지 않았습니다: ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

function applyMapping(rawRow, mapping) {
  const mapped = {};
  for (const field of SYSTEM_FIELDS) {
    const sourceColumn = mapping[field];
    const value = sourceColumn ? rawRow[sourceColumn] : '';
    mapped[field] = value === undefined || value === null ? '' : String(value).trim();
  }
  return mapped;
}

module.exports = { REQUIRED_FIELDS, SYSTEM_FIELDS, validateMapping, applyMapping };
