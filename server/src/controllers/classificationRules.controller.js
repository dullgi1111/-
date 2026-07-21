const asyncHandler = require('../middleware/asyncHandler');
const repo = require('../repositories/classificationKeywords.repo');

const list = asyncHandler(async (req, res) => {
  const rows = await repo.list();
  res.json({ data: rows });
});

const create = asyncHandler(async (req, res) => {
  const { keyword, maintenanceType, weight } = req.body;
  if (!keyword || !maintenanceType) {
    return res.status(400).json({ error: { message: 'keyword, maintenanceType가 필요합니다' } });
  }
  const row = await repo.create({ keyword, maintenanceType, weight });
  res.status(201).json({ data: row });
});

const remove = asyncHandler(async (req, res) => {
  await repo.remove(req.params.id);
  res.status(204).send();
});

module.exports = { list, create, remove };
