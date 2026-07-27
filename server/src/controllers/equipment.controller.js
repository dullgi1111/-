const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const equipmentRepo = require('../repositories/equipment.repo');
const equipmentAliasesRepo = require('../repositories/equipmentAliases.repo');
const maintenanceRecordsRepo = require('../repositories/maintenanceRecords.repo');
const recordTermLinksRepo = require('../repositories/recordTermLinks.repo');
const { normalizeSpaced } = require('../utils/textNormalize');

const list = asyncHandler(async (req, res) => {
  const { needsReview, search, page, limit } = req.query;
  const rows = await equipmentRepo.list({
    needsReview: needsReview !== undefined ? needsReview === 'true' : undefined,
    search,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json({ data: rows });
});

const getOne = asyncHandler(async (req, res) => {
  const equipment = await equipmentRepo.findById(req.params.id);
  if (!equipment) return res.status(404).json({ error: { message: 'Equipment not found' } });
  const aliases = await equipmentAliasesRepo.listByEquipment(equipment.id);
  res.json({ data: { ...equipment, aliases } });
});

const createSchema = z.object({
  equipmentName: z.string().min(1),
  modelNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  spec: z.string().optional(),
  installDate: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const create = asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  const normalizedName = normalizeSpaced(body.equipmentName);
  const existing = await equipmentRepo.findByNormalized(normalizedName);
  if (existing) return res.status(409).json({ error: { message: '이미 등록된 설비명입니다' } });
  const equipment = await equipmentRepo.create({
    equipmentName: body.equipmentName,
    normalizedName,
    modelNumber: body.modelNumber,
    manufacturer: body.manufacturer,
    spec: body.spec,
    installDate: body.installDate,
    location: body.location,
    notes: body.notes,
    origin: 'manual',
    needsReview: false,
  });
  res.status(201).json({ data: equipment });
});

const update = asyncHandler(async (req, res) => {
  const fields = {};
  if (req.body.equipmentName !== undefined) {
    fields.equipment_name = req.body.equipmentName;
    fields.normalized_name = normalizeSpaced(req.body.equipmentName);
  }
  if (req.body.modelNumber !== undefined) fields.model_number = req.body.modelNumber;
  if (req.body.manufacturer !== undefined) fields.manufacturer = req.body.manufacturer;
  if (req.body.spec !== undefined) fields.spec = req.body.spec;
  if (req.body.installDate !== undefined) fields.install_date = req.body.installDate || null;
  if (req.body.location !== undefined) fields.location = req.body.location;
  if (req.body.notes !== undefined) fields.notes = req.body.notes;
  if (req.body.needsReview !== undefined) fields.needs_review = req.body.needsReview;
  const equipment = await equipmentRepo.update(req.params.id, fields);
  if (!equipment) return res.status(404).json({ error: { message: 'Equipment not found' } });
  res.json({ data: equipment });
});

const remove = asyncHandler(async (req, res) => {
  const equipment = await equipmentRepo.findById(req.params.id);
  if (!equipment) return res.status(404).json({ error: { message: 'Equipment not found' } });
  await equipmentRepo.softDelete(req.params.id);
  res.status(204).send();
});

const history = asyncHandler(async (req, res) => {
  const rows = await maintenanceRecordsRepo.historyForEquipmentId(req.params.id);
  res.json({ data: rows });
});

const detail = asyncHandler(async (req, res) => {
  const equipment = await equipmentRepo.findById(req.params.id);
  if (!equipment) return res.status(404).json({ error: { message: 'Equipment not found' } });
  const [profile, topTerms] = await Promise.all([
    maintenanceRecordsRepo.profileForEquipmentId(equipment.id),
    recordTermLinksRepo.topTermsForEquipment(equipment.id, 5),
  ]);
  res.json({ data: { ...equipment, ...profile, topTerms } });
});

module.exports = { list, getOne, create, update, remove, history, detail };
