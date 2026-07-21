const asyncHandler = require('../middleware/asyncHandler');
const settingsRepo = require('../repositories/settings.repo');

const getAll = asyncHandler(async (req, res) => {
  const rows = await settingsRepo.all();
  res.json({ data: rows });
});

const update = asyncHandler(async (req, res) => {
  const updates = req.body;
  const results = [];
  for (const [key, value] of Object.entries(updates)) {
    results.push(await settingsRepo.set(key, value));
  }
  res.json({ data: results });
});

module.exports = { getAll, update };
