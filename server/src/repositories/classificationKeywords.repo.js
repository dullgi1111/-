const { pool } = require('../config/db');

async function list() {
  const { rows } = await pool.query('SELECT * FROM classification_keywords ORDER BY maintenance_type, keyword');
  return rows;
}

async function create({ keyword, maintenanceType, weight = 1.0 }) {
  const { rows } = await pool.query(
    `INSERT INTO classification_keywords (keyword, maintenance_type, weight) VALUES ($1,$2,$3)
     ON CONFLICT (keyword, maintenance_type) DO UPDATE SET weight = EXCLUDED.weight
     RETURNING *`,
    [keyword, maintenanceType, weight]
  );
  return rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM classification_keywords WHERE id = $1', [id]);
}

module.exports = { list, create, remove };
