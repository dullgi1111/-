const classificationService = require('./classification.service');
const termMatchingService = require('./termMatching.service');
const maintenanceRecordsRepo = require('../repositories/maintenanceRecords.repo');
const recordTermLinksRepo = require('../repositories/recordTermLinks.repo');
const { splitPhrases, isTooLong } = require('../utils/phraseSplit');

async function processRecord({
  batchId,
  rawRowId,
  equipmentName,
  recordDate,
  companySource,
  mappedMaintenanceTypeRawValue,
  symptomText,
  actionText,
  partText,
  enteredBy,
}) {
  const classification = await classificationService.classify({
    symptomText,
    actionText,
    mappedRawValue: mappedMaintenanceTypeRawValue,
  });

  const record = await maintenanceRecordsRepo.create({
    batch_id: batchId || null,
    raw_row_id: rawRowId || null,
    equipment_name: equipmentName,
    record_date: recordDate,
    company_source: companySource || null,
    maintenance_type: classification.maintenanceType,
    maintenance_type_source: classification.source,
    maintenance_type_raw_value: classification.rawValue,
    maintenance_type_confidence: classification.confidence,
    matched_keywords: classification.matchedKeywords,
    symptom_text: symptomText || null,
    action_text: actionText || null,
    part_text: partText || null,
    entered_by: enteredBy || null,
  });

  const fieldMap = { symptom: symptomText, action: actionText, part: partText };
  const links = [];
  for (const [fieldType, text] of Object.entries(fieldMap)) {
    const phrases = splitPhrases(text);
    for (const phrase of phrases) {
      if (isTooLong(phrase)) {
        links.push(
          await recordTermLinksRepo.create({
            recordId: record.id,
            fieldType,
            rawPhrase: phrase,
            canonicalTermId: null,
            aliasId: null,
            matchType: 'skipped_too_long',
            similarityScore: null,
          })
        );
        continue;
      }
      const resolved = await termMatchingService.resolvePhrase({ termType: fieldType, rawPhrase: phrase, sourceRecordId: record.id });
      if (resolved) {
        links.push(
          await recordTermLinksRepo.create({
            recordId: record.id,
            fieldType,
            rawPhrase: phrase,
            canonicalTermId: resolved.canonicalTermId,
            aliasId: resolved.aliasId,
            matchType: resolved.matchType,
            similarityScore: resolved.similarityScore,
          })
        );
      }
    }
  }

  return { record, links };
}

module.exports = { processRecord };
