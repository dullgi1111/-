const express = require('express');
const controller = require('../controllers/equipment.controller');

const router = express.Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.get('/:id/history', controller.history);
router.get('/:id/detail', controller.detail);

module.exports = router;
