const path = require('path');
const asyncHandler = require('../middleware/asyncHandler');
const dictionaryImportService = require('../services/dictionaryImport.service');

const TERM_TYPES = ['symptom', 'action', 'part', 'auto'];

const uploadAndCommit = asyncHandler(async (req, res) => {
  const filesByType = req.files || {};
  const allRows = [];
  const emptyFiles = [];

  for (const termType of TERM_TYPES) {
    const files = filesByType[termType] || [];
    for (const file of files) {
      const ext = path.extname(file.originalname).slice(1).toLowerCase();
      const rows = await dictionaryImportService.buildRowsForFile(termType, file.path, ext);
      if (rows.length === 0) {
        emptyFiles.push(file.originalname);
        continue;
      }
      for (const row of rows) row.sourceLabel = file.originalname;
      allRows.push(...rows);
    }
  }

  if (allRows.length === 0) {
    const detail = emptyFiles.length > 0
      ? `다음 파일에서 텍스트를 하나도 추출하지 못했습니다: ${emptyFiles.join(', ')}. PDF라면 텍스트가 이미지처럼 저장되어 있거나(스캔본 등), 일부 PDF 저장 프로그램이 글자를 그림으로 저장하는 경우일 수 있습니다 — 원본이 워드/한글/엑셀 파일이라면 PDF로 바꾸지 말고 그 파일을 그대로 올려보세요.`
      : '가져올 파일이 없습니다. 파일마다 구분을 지정했는지 확인하세요.';
    return res.status(400).json({ error: { message: detail } });
  }

  const result = await dictionaryImportService.bulkImportTerms(allRows);
  if (emptyFiles.length > 0) result.emptyFiles = emptyFiles;
  res.json({ data: result });
});

module.exports = { uploadAndCommit };
