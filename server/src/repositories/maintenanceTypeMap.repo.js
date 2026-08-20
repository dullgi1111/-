const { pool } = require('../config/db');

async function list() {
  const { rows } = await pool.query('SELECT * FROM maintenance_type_value_map ORDER BY raw_value_normalized');
  return rows;
}

async function create({ rawValue, maintenanceType }) {
  const normalized = rawValue.trim().toLowerCase();
  const { rows } = await pool.query(
    `INSERT INTO maintenance_type_value_map (raw_value_normalized, maintenance_type) VALUES ($1,$2)
     ON CONFLICT (raw_value_normalized) DO UPDATE SET maintenance_type = EXCLUDED.maintenance_type
     RETURNING *`,
    [normalized, maintenanceType]
  );
  return rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM maintenance_type_value_map WHERE id = $1', [id]);
}

module.exports = { list, create, remove };
