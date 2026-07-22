const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const maintenanceRecordsRepo = require('../repositories/maintenanceRecords.repo');
const recordTermLinksRepo = require('../repositories/recordTermLinks.repo');

const router = express.Router();

router.get(
  '/:name/history',
  asyncHandler(async (req, res) => {
    const rows = await maintenanceRecordsRepo.historyForEquipment(req.params.name);
    res.json({ data: rows });
  })
);

router.get(
  '/:name/detail',
  asyncHandler(async (req, res) => {
    const [profile, topTerms] = await Promise.all([
      maintenanceRecordsRepo.profileForEquipment(req.params.name),
      recordTermLinksRepo.topTermsForEquipment(req.params.name, 5),
    ]);
    if (!profile || profile.total === 0) {
      return res.status(404).json({ error: { message: '해당 설비명의 이력이 없습니다' } });
    }
    res.json({ data: { equipmentName: req.params.name, ...profile, topTerms } });
  })
);

module.exports = router;
