const asyncHandler = require('../middleware/asyncHandler');
const { pool } = require('../config/db');

const summary = asyncHandler(async (req, res) => {
  const [byTypeResult, totalsResult, reviewCountResult, weekBatchesResult] = await Promise.all([
    pool.query(`SELECT maintenance_type, COUNT(*)::int AS count FROM maintenance_records WHERE is_deleted = false GROUP BY maintenance_type`),
    pool.query(`SELECT COUNT(*)::int AS total FROM maintenance_records WHERE is_deleted = false`),
    pool.query(`SELECT COUNT(*)::int AS count FROM canonical_terms WHERE needs_review = true`),
    pool.query(`SELECT COUNT(*)::int AS count FROM import_batches WHERE uploaded_at >= now() - interval '7 days'`),
  ]);

  res.json({
    data: {
      byType: byTypeResult.rows,
      totalRecords: totalsResult.rows[0].total,
      needsReviewTerms: reviewCountResult.rows[0].count,
      batchesThisWeek: weekBatchesResult.rows[0].count,
    },
  });
});

const recentDiscoveries = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const { rows } = await pool.query(
    `SELECT * FROM canonical_terms WHERE origin = 'auto_discovered' ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  res.json({ data: rows });
});

const recentMerges = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const { rows } = await pool.query('SELECT * FROM term_merge_audit_log ORDER BY merged_at DESC LIMIT $1', [limit]);
  res.json({ data: rows });
});

const trends = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT date_trunc('month', record_date) AS month, maintenance_type, COUNT(*)::int AS count
    FROM maintenance_records
    WHERE is_deleted = false
    GROUP BY month, maintenance_type
    ORDER BY month
  `);
  res.json({ data: rows });
});

module.exports = { summary, recentDiscoveries, recentMerges, trends };
