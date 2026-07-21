const express = require('express');
const controller = require('../controllers/settings.controller');

const router = express.Router();
router.get('/', controller.getAll);
router.put('/', controller.update);

module.exports = router;
