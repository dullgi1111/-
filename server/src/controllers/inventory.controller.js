const asyncHandler = require('../middleware/asyncHandler');
const canonicalTermsRepo = require('../repositories/canonicalTerms.repo');
const partInventoryRepo = require('../repositories/partInventory.repo');
const activityLogRepo = require('../repositories/activityLog.repo');

const list = asyncHandler(async (req, res) => {
  const { lowStockOnly } = req.query;
  const rows = await partInventoryRepo.list({ lowStockOnly: lowStockOnly === 'true' });
  res.json({ data: rows });
});

const update = asyncHandler(async (req, res) => {
  const term = await canonicalTermsRepo.findById(req.params.termId);
  if (!term || term.term_type !== 'part') {
    return res.status(404).json({ error: { message: '부품 용어를 찾을 수 없습니다' } });
  }
  const { stockQuantity, unit, minStockAlert } = req.body;
  if (stockQuantity !== undefined && (!Number.isInteger(stockQuantity) || stockQuantity < 0)) {
    return res.status(400).json({ error: { message: 'stockQuantity는 0 이상의 정수여야 합니다' } });
  }
  const before = await partInventoryRepo.getByTermId(term.id);
  const row = await partInventoryRepo.upsert(term.id, { stockQuantity, unit, minStockAlert });
  const oldQty = before ? before.stock_quantity : 0;
  if (oldQty !== row.stock_quantity) {
    await activityLogRepo.log({
      area: '재고 관리',
      item: `${term.canonical_text} · 재고수량`,
      oldValue: String(oldQty),
      newValue: String(row.stock_quantity),
      linkPath: '/inventory',
    });
  }
  res.json({ data: row });
});

module.exports = { list, update };
