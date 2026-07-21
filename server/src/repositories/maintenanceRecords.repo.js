const { pool } = require('../config/db');

async function create(fields) {
  const columns = Object.keys(fields);
  const params = Object.values(fields);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const { rows } = await pool.query(
    `INSERT INTO maintenance_records (${columns.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`,
    params
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM maintenance_records WHERE id = $1 AND is_deleted = false', [id]);
  return rows[0] || null;
}

async function list({ equipment, dateFrom, dateTo, month, maintenanceType, companySource, page = 1, limit = 50 } = {}) {
  const conditions = ['is_deleted = false'];
  const params = [];
  if (equipment) { params.push(`%${equipment}%`); conditions.push(`equipment_name ILIKE $${params.length}`); }
  if (dateFrom) { params.push(dateFrom); conditions.push(`record_date >= $${params.length}`); }
  if (dateTo) { params.push(dateTo); conditions.push(`record_date <= $${params.length}`); }
  if (month) { params.push(Number(month)); conditions.push(`EXTRACT(MONTH FROM record_date) = $${params.length}`); }
  if (maintenanceType) { params.push(maintenanceType); conditions.push(`maintenance_type = $${params.length}`); }
  if (companySource) { params.push(companySource); conditions.push(`company_source = $${params.length}`); }
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT * FROM maintenance_records WHERE ${conditions.join(' AND ')} ORDER BY record_date DESC, id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function historyForEquipment(equipmentName) {
  const { rows } = await pool.query(
    'SELECT * FROM maintenance_records WHERE equipment_name = $1 AND is_deleted = false ORDER BY record_date DESC',
    [equipmentName]
  );
  return rows;
}

async function update(id, fields) {
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    params.push(value);
    sets.push(`${key} = $${params.length}`);
  }
  params.push(id);
  const { rows } = await pool.query(
    `UPDATE maintenance_records SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0];
}

async function softDelete(id) {
  await pool.query('UPDATE maintenance_records SET is_deleted = true, updated_at = now() WHERE id = $1', [id]);
}

async function softDeleteAll() {
  const { rowCount } = await pool.query(
    `UPDATE maintenance_records SET is_deleted = true, updated_at = now() WHERE is_deleted = false`
  );
  return rowCount;
}

module.exports = { create, findById, list, historyForEquipment, update, softDelete, softDeleteAll };
