const asyncHandler = require('../middleware/asyncHandler');
const { pool } = require('../config/db');
const activityLogRepo = require('../repositories/activityLog.repo');

const summary = asyncHandler(async (req, res) => {
  const [
    byTypeResult,
    totalsResult,
    reviewCountResult,
    weekBatchesResult,
    lowStockResult,
    needsTypeReviewResult,
    needsReviewEquipmentResult,
  ] = await Promise.all([
    pool.query(`SELECT maintenance_type, COUNT(*)::int AS count FROM maintenance_records WHERE is_deleted = false GROUP BY maintenance_type`),
    pool.query(`SELECT COUNT(*)::int AS total FROM maintenance_records WHERE is_deleted = false`),
    pool.query(`SELECT COUNT(*)::int AS count FROM canonical_terms WHERE needs_review = true`),
    pool.query(`SELECT COUNT(*)::int AS count FROM import_batches WHERE uploaded_at >= now() - interval '7 days'`),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM part_inventory WHERE min_stock_alert IS NOT NULL AND stock_quantity <= min_stock_alert`
    ),
    pool.query(`SELECT COUNT(*)::int AS count FROM maintenance_records WHERE is_deleted = false AND type_confirmed = false`),
    pool.query(`SELECT COUNT(*)::int AS count FROM equipment WHERE status = 'active' AND needs_review = true`),
  ]);

  res.json({
    data: {
      byType: byTypeResult.rows,
      totalRecords: totalsResult.rows[0].total,
      needsReviewTerms: reviewCountResult.rows[0].count,
      batchesThisWeek: weekBatchesResult.rows[0].count,
      lowStockCount: lowStockResult.rows[0].count,
      needsTypeReviewCount: needsTypeReviewResult.rows[0].count,
      needsReviewEquipmentCount: needsReviewEquipmentResult.rows[0].count,
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

const equipmentStats = asyncHandler(async (req, res) => {
  // grouped by equipment_id (the normalized/canonical equipment) rather than the
  // raw equipment_name text, so spelling variants of the same machine roll up together
  const { rows } = await pool.query(`
    SELECT
      e.id AS equipment_id,
      e.equipment_name,
      e.needs_review,
      COUNT(mr.id)::int AS total,
      COUNT(mr.id) FILTER (WHERE mr.maintenance_type = 'breakdown_repair')::int AS breakdown_count,
      COUNT(mr.id) FILTER (WHERE mr.maintenance_type = 'preventive_inspection')::int AS inspection_count,
      COUNT(mr.id) FILTER (WHERE mr.maintenance_type = 'other')::int AS other_count,
      COUNT(mr.id) FILTER (WHERE mr.maintenance_type = 'unknown')::int AS unknown_count,
      MAX(mr.record_date) AS last_record_date
    FROM equipment e
    JOIN maintenance_records mr ON mr.equipment_id = e.id AND mr.is_deleted = false
    WHERE e.status = 'active'
    GROUP BY e.id, e.equipment_name, e.needs_review
    ORDER BY total DESC
  `);
  res.json({ data: rows });
});

// 설비명 끝의 연속된 알파벳(예: "FF-3401P"의 "P", "LS-652LP"의 "LP", "SL23PLS"의
// "PLS")을 설비라인으로 취급한다. KEP 원본 자료에 별도 컬럼이 없어 설비명 문자열에서
// 뽑아내는 값이라, equipment 테이블에 저장하지 않고 매번 이 표현식으로 계산한다.
const EQUIPMENT_LINE_EXPR = "substring(equipment_name from '[A-Za-z]+$')";

const equipmentLines = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT ${EQUIPMENT_LINE_EXPR} AS line, COUNT(*)::int AS count
    FROM equipment
    WHERE status != 'deprecated' AND ${EQUIPMENT_LINE_EXPR} IS NOT NULL
    GROUP BY line
    ORDER BY count DESC
  `);
  res.json({ data: rows });
});

// 집계 기준 드롭다운에서 고를 수 있는 값 -> 실제 컬럼 매핑. SQL 인젝션 방지를 위해
// 화이트리스트에 있는 값만 컬럼명으로 사용한다 (req.query 값을 직접 보간하지 않음).
const REPORT_GROUP_BY_COLUMNS = {
  equipment_name: 'equipment_name',
  symptom_text: 'symptom_text',
  work_team: 'work_team',
  work_name: 'work_name',
  work_content: 'work_content',
  maintenance_type: 'maintenance_type',
  equipment_line: EQUIPMENT_LINE_EXPR,
};

const report = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const groupBy = REPORT_GROUP_BY_COLUMNS[req.query.groupBy] ? req.query.groupBy : 'equipment_name';
  const groupByColumn = REPORT_GROUP_BY_COLUMNS[groupBy];
  if (!dateFrom || !dateTo) {
    return res.status(400).json({ error: { message: 'dateFrom, dateTo가 필요합니다' } });
  }

  const [byTypeResult, topGroupResult, newTermsResult, topPartsResult, companiesResult] = await Promise.all([
    pool.query(
      `SELECT maintenance_type, COUNT(*)::int AS count
       FROM maintenance_records
       WHERE is_deleted = false AND record_date BETWEEN $1 AND $2
       GROUP BY maintenance_type`,
      [dateFrom, dateTo]
    ),
    pool.query(
      `SELECT ${groupByColumn} AS group_value, COUNT(*)::int AS count
       FROM maintenance_records
       WHERE is_deleted = false AND record_date BETWEEN $1 AND $2 AND ${groupByColumn} IS NOT NULL
       GROUP BY ${groupByColumn}
       ORDER BY count DESC
       LIMIT 10`,
      [dateFrom, dateTo]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM canonical_terms WHERE origin = 'auto_discovered' AND created_at::date BETWEEN $1 AND $2`,
      [dateFrom, dateTo]
    ),
    pool.query(
      `SELECT ct.canonical_text, COUNT(*)::int AS count
       FROM record_term_links l
       JOIN maintenance_records mr ON mr.id = l.record_id
       JOIN canonical_terms ct ON ct.id = l.canonical_term_id
       WHERE l.field_type = 'part' AND mr.is_deleted = false AND mr.record_date BETWEEN $1 AND $2
       GROUP BY ct.canonical_text
       ORDER BY count DESC
       LIMIT 10`,
      [dateFrom, dateTo]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT company_source)::int AS count
       FROM maintenance_records
       WHERE is_deleted = false AND record_date BETWEEN $1 AND $2 AND company_source IS NOT NULL`,
      [dateFrom, dateTo]
    ),
  ]);

  const totalRecords = byTypeResult.rows.reduce((sum, r) => sum + r.count, 0);

  res.json({
    data: {
      dateFrom,
      dateTo,
      totalRecords,
      byType: byTypeResult.rows,
      groupBy,
      topGroup: topGroupResult.rows,
      newTermsCount: newTermsResult.rows[0].count,
      topParts: topPartsResult.rows,
      companyCount: companiesResult.rows[0].count,
    },
  });
});

const activityLog = asyncHandler(async (req, res) => {
  const { area, page, limit } = req.query;
  const [rows, summaryData] = await Promise.all([
    activityLogRepo.list({ area, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : 100 }),
    activityLogRepo.summary(),
  ]);
  res.json({ data: { rows, summary: summaryData } });
});

module.exports = { summary, recentDiscoveries, recentMerges, trends, equipmentStats, equipmentLines, report, activityLog };
