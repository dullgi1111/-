const express = require('express');
const controller = require('../controllers/dictionary.controller');
const importController = require('../controllers/dictionaryImport.controller');
const { uploadDictionaryFile } = require('../middleware/upload');

const router = express.Router();
router.get('/terms', controller.listTerms);
router.delete('/terms/all', controller.removeAllTerms);
router.get('/terms/:id', controller.getTerm);
router.post('/terms', controller.createTerm);
router.put('/terms/:id', controller.updateTerm);
router.post('/terms/:id/mark-reviewed', controller.markReviewed);
router.delete('/terms/:id', controller.removeTerm);
router.post('/terms/:id/aliases', controller.addAlias);
router.post('/merge', controller.mergeTerms);
router.post(
  '/import',
  uploadDictionaryFile.fields([
    { name: 'symptom', maxCount: 10 },
    { name: 'action', maxCount: 10 },
    { name: 'part', maxCount: 10 },
    { name: 'auto', maxCount: 10 },
  ]),
  importController.uploadAndCommit
);

module.exports = router;
