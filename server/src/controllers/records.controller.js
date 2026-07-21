const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const recordPipeline = require('../services/recordPipeline.service');
const maintenanceRecordsRepo = require('../repositories/maintenanceRecords.repo');
const recordTermLinksRepo = require('../repositories/recordTermLinks.repo');

const createRecordSchema = z.object({
  equipmentName: z.string().min(1),
  recordDate: z.string().min(1),
  companySource: z.string().optional(),
  maintenanceTypeRawValue: z.string().optional(),
  symptomText: z.string().optional(),
  actionText: z.string().optional(),
  partText: z.string().optional(),
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
    enteredBy: body.enteredBy || 'manual',
  });
  res.status(201).json({ data: { record, links } });
});

const list = asyncHandler(async (req, res) => {
  const { equipment, dateFrom, dateTo, month, maintenanceType, companySource, page, limit } = req.query;
  const rows = await maintenanceRecordsRepo.list({
    equipment,
    dateFrom,
    dateTo,
    month,
    maintenanceType,
    companySource,
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

module.exports = { create, list, getOne, remove, removeAll };
