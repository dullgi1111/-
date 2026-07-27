const express = require('express');
const controller = require('../controllers/inventory.controller');

const router = express.Router();
router.get('/', controller.list);
router.put('/:termId', controller.update);

module.exports = router;
