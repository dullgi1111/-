const asyncHandler = require('../middleware/asyncHandler');
const repo = require('../repositories/maintenanceTypeMap.repo');

const list = asyncHandler(async (req, res) => {
  const rows = await repo.list();
  res.json({ data: rows });
});

const create = asyncHandler(async (req, res) => {
  const { rawValue, maintenanceType } = req.body;
  if (!rawValue || !maintenanceType) {
    return res.status(400).json({ error: { message: 'rawValue, maintenanceType가 필요합니다' } });
  }
  const row = await repo.create({ rawValue, maintenanceType });
  res.status(201).json({ data: row });
});

const remove = asyncHandler(async (req, res) => {
  await repo.remove(req.params.id);
  res.status(204).send();
});

module.exports = { list, create, remove };
