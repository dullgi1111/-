const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const recordPipeline = require('../services/recordPipeline.service');
const maintenanceRecordsRepo = require('../repositories/maintenanceRecords.repo');
const recordTermLinksRepo = require('../repositories/recordTermLinks.repo');
const activityLogRepo = require('../repositories/activityLog.repo');

const MAINTENANCE_TYPE_LABELS = {
  breakdown_repair: '고장수리',
  preventive_inspection: '예방점검',
  other: '기타',
  unknown: '미상',
};

const MAINTENANCE_TYPES = ['breakdown_repair', 'preventive_inspection', 'other', 'unknown'];

const createRecordSchema = z.object({
  equipmentName: z.string().min(1),
  recordDate: z.string().min(1),
  companySource: z.string().optional(),
  maintenanceTypeRawValue: z.string().optional(),
  symptomText: z.string().optional(),
  actionText: z.string().optional(),
  partText: z.string().optional(),
  workName: z.string().optional(),
  workContent: z.string().optional(),
  workTeam: z.string().optional(),
  enteredBy: z.string().optional(),
});

const create = asyncHandler(async (req, res) => {
  const body = createRecordSchema.parse(req.body);
  const { record, links } = await recordPipeline.processRecord({
    equipmentName: body.equipmentName,
    recordDate: body.recordDate,
    companySource: body.companySource,
    mappedMaintenanceTypeRawValue: body.maintenanceTypeRawValue,
    symptomText: body.symptomText,
    actionText: body.actionText,
    partText: body.partText,
    workName: body.workName,
    workContent: body.workContent,
    workTeam: body.workTeam,
    enteredBy: body.enteredBy || 'manual',
  });
  res.status(201).json({ data: { record, links } });
});

const list = asyncHandler(async (req, res) => {
  const { equipment, equipmentIds, equipmentLines, symptomTexts, workTeams, dateFrom, dateTo, month, maintenanceType, companySource, needsTypeReview, page, limit } = req.query;
  const rows = await maintenanceRecordsRepo.list({
    equipment,
    equipmentIds: equipmentIds ? equipmentIds.split(',').filter(Boolean) : undefined,
    equipmentLines: equipmentLines ? equipmentLines.split(',').filter(Boolean) : undefined,
    symptomTexts: symptomTexts ? symptomTexts.split(',').filter(Boolean) : undefined,
    workTeams: workTeams ? workTeams.split(',').filter(Boolean) : undefined,
    dateFrom,
    dateTo,
    month,
    maintenanceType,
    companySource,
    needsTypeReview: needsTypeReview === 'true',
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ data: rows });
});

const getOne = asyncHandler(async (req, res) => {
  const record = await maintenanceRecordsRepo.findById(req.params.id);
  if (!record) return res.status(404).json({ error: { message: 'Record not found' } });
  const links = await recordTermLinksRepo.listForRecord(record.id);
  res.json({ data: { record, links } });
});

const remove = asyncHandler(async (req, res) => {
  await maintenanceRecordsRepo.softDelete(req.params.id);
  res.status(204).send();
});

const removeAll = asyncHandler(async (req, res) => {
  const deletedCount = await maintenanceRecordsRepo.softDeleteAll();
  res.json({ data: { deletedCount } });
});

const confirmType = asyncHandler(async (req, res) => {
  const { maintenanceType } = req.body;
  if (!MAINTENANCE_TYPES.includes(maintenanceType)) {
    return res.status(400).json({ error: { message: `maintenanceType은 ${MAINTENANCE_TYPES.join(', ')} 중 하나여야 합니다` } });
  }
  const record = await maintenanceRecordsRepo.findById(req.params.id);
  if (!record) return res.status(404).json({ error: { message: 'Record not found' } });
  const updated = await maintenanceRecordsRepo.update(req.params.id, {
    maintenance_type: maintenanceType,
    maintenance_type_source: 'manual',
    type_confirmed: true,
  });
  if (record.maintenance_type !== maintenanceType) {
    await activityLogRepo.log({
      area: '정비 이력',
      item: `${record.equipment_name} (${record.record_date}) · 정비유형`,
      oldValue: MAINTENANCE_TYPE_LABELS[record.maintenance_type] || record.maintenance_type,
      newValue: MAINTENANCE_TYPE_LABELS[maintenanceType] || maintenanceType,
      note: '사람이 확인',
      linkPath: `/records?recordId=${record.id}`,
    });
  }
  res.json({ data: updated });
});

module.exports = { create, list, getOne, remove, removeAll, confirmType };
