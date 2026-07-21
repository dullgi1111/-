const { pool } = require('../config/db');

async function get(key) {
  const { rows } = await pool.query('SELECT value FROM system_settings WHERE key = $1', [key]);
  return rows[0] ? rows[0].value : null;
}

async function getNumber(key, fallback) {
  const value = await get(key);
  if (value === null) return fallback;
  const num = parseFloat(value);
  return Number.isNaN(num) ? fallback : num;
}

async function set(key, value) {
  const { rows } = await pool.query(
    `INSERT INTO system_settings (key, value) VALUES ($1,$2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now() RETURNING *`,
    [key, String(value)]
  );
  return rows[0];
}

async function all() {
  const { rows } = await pool.query('SELECT * FROM system_settings ORDER BY key');
  return rows;
}

module.exports = { get, getNumber, set, all };
