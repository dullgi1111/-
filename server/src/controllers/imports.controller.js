const fs = require('fs');
const path = require('path');
const asyncHandler = require('../middleware/asyncHandler');
const { uploadsRoot } = require('../middleware/upload');
const fileParserService = require('../services/fileParser.service');
const columnMappingService = require('../services/columnMapping.service');
const importPipelineService = require('../services/importPipeline.service');
const importAnalysisService = require('../services/importAnalysis.service');
const importBatchesRepo = require('../repositories/importBatches.repo');
const rawImportRowsRepo = require('../repositories/rawImportRows.repo');
const { mergeTables } = require('../utils/mergeTables');
const { rowsToCsv } = require('../utils/csvExport');

const uploadFile = asyncHandler(async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) return res.status(400).json({ error: { message: '파일이 없습니다' } });

  const parsedFiles = [];
  for (const file of files) {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const { headers, rows } = await fileParserService.parseFile(file.path, ext);
    parsedFiles.push({ headers, rows, ext });
  }

  const { headers, rows } = mergeTables(parsedFiles);
  const exts = [...new Set(parsedFiles.map((f) => f.ext))].join(',');
  const originalFilenames = files.map((f) => f.originalname).join(', ');

  const batch = await importBatchesRepo.create({
    source_type: 'file_upload',
    company_source: req.body.companySource || null,
    original_filename: originalFilenames,
    file_path: null,
    file_ext: exts,
    detected_columns: headers,
    status: 'uploaded',
    total_rows: rows.length,
  });

  const batchDir = path.join(uploadsRoot, String(batch.id));
  fs.mkdirSync(batchDir, { recursive: true });
  const savedPaths = files.map((file, idx) => {
    const ext = path.extname(file.originalname);
    const finalPath = path.join(batchDir, `original_${idx + 1}${ext}`);
    fs.renameSync(file.path, finalPath);
    return finalPath;
  });
  fs.writeFileSync(path.join(batchDir, 'parsed_rows.json'), JSON.stringify(rows));
  const updated = await importBatchesRepo.update(batch.id, { file_path: JSON.stringify(savedPaths) });

  res.status(201).json({
    data: {
      batchId: updated.id,
      detectedColumns: headers,
      sampleRows: rows.slice(0, 10),
      totalRows: rows.length,
    },
  });
});

const preview = asyncHandler(async (req, res) => {
  const batch = await importBatchesRepo.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: { message: 'Batch not found' } });
  const batchDir = path.join(uploadsRoot, String(batch.id));
  const rows = JSON.parse(fs.readFileSync(path.join(batchDir, 'parsed_rows.json'), 'utf8'));
  res.json({
    data: { batchId: batch.id, detectedColumns: batch.detected_columns, sampleRows: rows.slice(0, 10), totalRows: rows.length },
  });
});

const exportRows = asyncHandler(async (req, res) => {
  const batch = await importBatchesRepo.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: { message: 'Batch not found' } });
  const batchDir = path.join(uploadsRoot, String(batch.id));
  const rows = JSON.parse(fs.readFileSync(path.join(batchDir, 'parsed_rows.json'), 'utf8'));
  const csv = rowsToCsv(batch.detected_columns, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="import_batch_${batch.id}.csv"`);
  res.send(csv);
});

const setMapping = asyncHandler(async (req, res) => {
  const { companySource, columnMapping } = req.body;
  columnMappingService.validateMapping(columnMapping);
  const batch = await importBatchesRepo.update(req.params.id, {
    company_source: companySource || null,
    column_mapping: JSON.stringify(columnMapping),
    status: 'mapped',
  });
  res.json({ data: batch });
});

const analyze = asyncHandler(async (req, res) => {
  const batch = await importBatchesRepo.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: { message: 'Batch not found' } });
  if (!batch.column_mapping) {
    return res.status(400).json({ error: { message: '컬럼 매핑을 먼저 완료하세요' } });
  }
  const batchDir = path.join(uploadsRoot, String(batch.id));
  const rows = JSON.parse(fs.readFileSync(path.join(batchDir, 'parsed_rows.json'), 'utf8'));
  const stats = await importAnalysisService.analyzeRows(rows, batch.column_mapping);
  res.json({ data: stats });
});

const commit = asyncHandler(async (req, res) => {
  const batch = await importBatchesRepo.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: { message: 'Batch not found' } });
  if (batch.status !== 'mapped') {
    return res.status(400).json({ error: { message: '컬럼 매핑을 먼저 완료하세요' } });
  }

  const batchDir = path.join(uploadsRoot, String(batch.id));
  const rows = JSON.parse(fs.readFileSync(path.join(batchDir, 'parsed_rows.json'), 'utf8'));
  await rawImportRowsRepo.createMany(batch.id, rows);
  await importBatchesRepo.update(batch.id, { status: 'processing', committed_at: new Date() });

  res.status(202).json({ data: { batchId: batch.id, status: 'processing' } });

  importPipelineService.runPipeline(batch.id).catch((err) => {
    console.error(`Import pipeline failed for batch ${batch.id}:`, err);
    importBatchesRepo.update(batch.id, { status: 'failed', error_summary: JSON.stringify({ message: err.message }) });
  });
});

const cancel = asyncHandler(async (req, res) => {
  const batch = await importBatchesRepo.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: { message: 'Batch not found' } });
  if (batch.status !== 'processing') {
    return res.status(400).json({ error: { message: '진행 중인 배치만 취소할 수 있습니다' } });
  }
  const updated = await importBatchesRepo.update(batch.id, { status: 'cancelled', completed_at: new Date() });
  res.json({ data: updated });
});

const getOne = asyncHandler(async (req, res) => {
  const batch = await importBatchesRepo.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: { message: 'Batch not found' } });
  res.json({ data: batch });
});

const list = asyncHandler(async (req, res) => {
  const { status, companySource, page, limit } = req.query;
  const rows = await importBatchesRepo.list({
    status,
    companySource,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ data: rows });
});

const listErrors = asyncHandler(async (req, res) => {
  const rows = await rawImportRowsRepo.listByBatch(req.params.id, { status: 'error' });
  res.json({ data: rows });
});

const remove = asyncHandler(async (req, res) => {
  const batch = await importBatchesRepo.findById(req.params.id);
  if (!batch) return res.status(404).json({ error: { message: 'Batch not found' } });
  if (!['uploaded', 'mapped'].includes(batch.status)) {
    return res.status(400).json({ error: { message: '커밋 전 상태에서만 삭제할 수 있습니다' } });
  }
  await importBatchesRepo.remove(batch.id);
  res.status(204).send();
});

module.exports = { uploadFile, preview, exportRows, setMapping, analyze, commit, cancel, getOne, list, listErrors, remove };
