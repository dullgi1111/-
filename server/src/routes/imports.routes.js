const express = require('express');
const controller = require('../controllers/imports.controller');
const { upload } = require('../middleware/upload');

const router = express.Router();
router.post('/upload', upload.array('files', 10), controller.uploadFile);
router.get('/:id/preview', controller.preview);
router.get('/:id/export', controller.exportRows);
router.post('/:id/mapping', controller.setMapping);
router.get('/:id/analysis', controller.analyze);
router.post('/:id/commit', controller.commit);
router.post('/:id/cancel', controller.cancel);
router.get('/:id/errors', controller.listErrors);
router.get('/:id', controller.getOne);
router.get('/', controller.list);
router.delete('/:id', controller.remove);

module.exports = router;
