const express = require('express');
const controller = require('../controllers/records.controller');

const router = express.Router();
router.post('/', controller.create);
router.get('/', controller.list);
router.delete('/all', controller.removeAll);
router.get('/:id', controller.getOne);
router.delete('/:id', controller.remove);

module.exports = router;
