const importBatchesRepo = require('../repositories/importBatches.repo');
const rawImportRowsRepo = require('../repositories/rawImportRows.repo');
const columnMappingService = require('./columnMapping.service');
const recordPipelineService = require('./recordPipeline.service');

const CHUNK_SIZE = 200;

async function runPipeline(batchId) {
  const batch = await importBatchesRepo.findById(batchId);
  if (!batch) throw new Error('Batch not found');

  const rawRows = await rawImportRowsRepo.listByBatch(batchId, { status: 'pending' });
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < rawRows.length; i += CHUNK_SIZE) {
    const current = await importBatchesRepo.findById(batchId);
    if (current.status === 'cancelled') return;

    const chunk = rawRows.slice(i, i + CHUNK_SIZE);
    for (const rawRow of chunk) {
      try {
        const mapped = columnMappingService.applyMapping(rawRow.raw_data, batch.column_mapping);
        if (!mapped.equipmentName || !mapped.recordDate) {
          throw new Error('설비명 또는 날짜 값이 비어 있습니다');
        }

        await recordPipelineService.processRecord({
          batchId,
          rawRowId: rawRow.id,
          equipmentName: mapped.equipmentName,
          recordDate: mapped.recordDate,
          companySource: mapped.companySource || batch.company_source,
          mappedMaintenanceTypeRawValue: mapped.maintenanceType || null,
          symptomText: mapped.symptomText,
          actionText: mapped.actionText,
          partText: mapped.partText,
          enteredBy: 'import',
        });

        await rawImportRowsRepo.markStatus(rawRow.id, 'processed');
        processed++;
      } catch (err) {
        await rawImportRowsRepo.markStatus(rawRow.id, 'error', err.message);
        errors++;
      }
    }
    await importBatchesRepo.update(batchId, { processed_rows: processed, error_rows: errors });
  }

  await importBatchesRepo.update(batchId, {
    status: 'completed',
    processed_rows: processed,
    error_rows: errors,
    completed_at: new Date(),
  });
}

module.exports = { runPipeline };
