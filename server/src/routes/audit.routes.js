const express = require('express');
const controller = require('../controllers/audit.controller');

const router = express.Router();
router.get('/merges', controller.listMerges);
router.post('/merges/:id/revert', controller.revertMerge);

module.exports = router;
