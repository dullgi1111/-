const path = require('path');
const fs = require('fs');
const asyncHandler = require('../middleware/asyncHandler');
const fileParserService = require('../services/fileParser.service');
const equipmentMasterImportService = require('../services/equipmentMasterImport.service');

const importMaster = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: { message: '파일이 없습니다' } });

  try {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const { headers, rows } = await fileParserService.parseFile(file.path, ext);
    const result = await equipmentMasterImportService.importRows(headers, rows);
    res.json({ data: result });
  } finally {
    fs.unlink(file.path, () => {});
  }
});

module.exports = { importMaster };
