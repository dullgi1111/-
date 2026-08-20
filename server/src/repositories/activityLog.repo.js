const { pool } = require('../config/db');

async function log({ area, item, oldValue, newValue, note, linkPath }) {
  await pool.query(
    `INSERT INTO activity_log (area, item, old_value, new_value, note, link_path) VALUES ($1,$2,$3,$4,$5,$6)`,
    [area, item, oldValue ?? null, newValue ?? null, note ?? null, linkPath ?? null]
  );
}

async function list({ area, page = 1, limit = 50 } = {}) {
  const conditions = [];
  const params = [];
  if (area) { params.push(area); conditions.push(`area = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT * FROM activity_log ${where} ORDER BY occurred_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function summary() {
  const [totalResult, todayResult, topAreaResult, latestResult] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM activity_log`),
    pool.query(`SELECT COUNT(*)::int AS count FROM activity_log WHERE occurred_at::date = now()::date`),
    pool.query(
      `SELECT area, COUNT(*)::int AS count FROM activity_log GROUP BY area ORDER BY count DESC LIMIT 1`
    ),
    pool.query(`SELECT occurred_at, area, item FROM activity_log ORDER BY occurred_at DESC LIMIT 1`),
  ]);
  return {
    totalCount: totalResult.rows[0].count,
    todayCount: todayResult.rows[0].count,
    topArea: topAreaResult.rows[0] || null,
    latest: latestResult.rows[0] || null,
  };
}

module.exports = { log, list, summary };
