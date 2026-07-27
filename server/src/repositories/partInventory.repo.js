const { pool } = require('../config/db');

async function list({ lowStockOnly } = {}) {
  const conditions = ["ct.term_type = 'part'", "ct.status != 'deprecated'"];
  if (lowStockOnly) conditions.push('pi.min_stock_alert IS NOT NULL AND COALESCE(pi.stock_quantity, 0) <= pi.min_stock_alert');
  const { rows } = await pool.query(
    `SELECT
       ct.id AS canonical_term_id,
       ct.canonical_text,
       ct.occurrence_count,
       COALESCE(pi.stock_quantity, 0) AS stock_quantity,
       COALESCE(pi.unit, '개') AS unit,
       pi.min_stock_alert,
       pi.updated_at
     FROM canonical_terms ct
     LEFT JOIN part_inventory pi ON pi.canonical_term_id = ct.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ct.canonical_text`
  );
  return rows;
}

async function upsert(canonicalTermId, { stockQuantity, unit, minStockAlert }) {
  const { rows } = await pool.query(
    `INSERT INTO part_inventory (canonical_term_id, stock_quantity, unit, min_stock_alert)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (canonical_term_id) DO UPDATE
       SET stock_quantity = EXCLUDED.stock_quantity,
           unit = EXCLUDED.unit,
           min_stock_alert = EXCLUDED.min_stock_alert,
           updated_at = now()
     RETURNING *`,
    [canonicalTermId, stockQuantity ?? 0, unit || '개', minStockAlert ?? null]
  );
  return rows[0];
}

module.exports = { list, upsert };
