const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const maintenanceRecordsRepo = require('../repositories/maintenanceRecords.repo');

const router = express.Router();

router.get(
  '/:name/history',
  asyncHandler(async (req, res) => {
    const rows = await maintenanceRecordsRepo.historyForEquipment(req.params.name);
    res.json({ data: rows });
  })
);

module.exports = router;
