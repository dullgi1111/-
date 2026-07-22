const express = require('express');
const controller = require('../controllers/dashboard.controller');

const router = express.Router();
router.get('/summary', controller.summary);
router.get('/recent-discoveries', controller.recentDiscoveries);
router.get('/recent-merges', controller.recentMerges);
router.get('/trends', controller.trends);
router.get('/equipment-stats', controller.equipmentStats);

module.exports = router;
