const { pool } = require('../config/db');

// Settings are read on every non-exact term classification (up to 3x per
// phrase). At import-pipeline scale (100k+ rows) that turns into hundreds of
// thousands of redundant round trips for values that almost never change, so
// cache reads briefly and drop the cache on write.
const CACHE_TTL_MS = 10000;
const cache = new Map();

async function get(key) {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const { rows } = await pool.query('SELECT value FROM system_settings WHERE key = $1', [key]);
  const value = rows[0] ? rows[0].value : null;
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
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
  cache.delete(key);
  return rows[0];
}

async function all() {
  const { rows } = await pool.query('SELECT * FROM system_settings ORDER BY key');
  return rows;
}

module.exports = { get, getNumber, set, all };
