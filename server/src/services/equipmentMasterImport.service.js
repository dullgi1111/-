// KEP 설비기본정보 엑셀(설비 ID/Item No/설비명칭/기능유형/설비유형/Section/설비등급 등 51개 컬럼)을
// 읽어 equipment 테이블에 반영한다. 정비이력에는 Item No가 없으므로, 기존 설비명 퍼지매칭 엔진
// (equipmentMatching.service)으로 설비명칭을 연결하고, 매칭되는 설비가 없으면 새로 만든다.
const equipmentRepo = require('../repositories/equipment.repo');
const equipmentMatchingService = require('./equipmentMatching.service');

const HEADER_ALIASES = {
  itemNo: ['Item No', 'Item No.', 'ItemNo'],
  masterName: ['설비명칭'],
  functionType: ['기능유형'],
  equipmentType: ['설비유형'],
  section: ['Section', 'section'],
  gradeLabel: ['설비등급'],
};

function findColumn(headers, aliases) {
  for (const alias of aliases) {
    const hit = headers.find((h) => h.trim() === alias);
    if (hit) return hit;
  }
  return null;
}

function extractGradeNum(gradeLabel) {
  if (!gradeLabel) return null;
  const match = String(gradeLabel).match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function importRows(headers, rows) {
  const columns = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    columns[key] = findColumn(headers, aliases);
  }
  if (!columns.masterName) {
    const err = new Error('설비명칭 컬럼을 찾지 못했습니다. KEP 설비기본정보 조회 엑셀 형식인지 확인해주세요.');
    err.status = 400;
    throw err;
  }

  const result = { totalRows: rows.length, matched: 0, created: 0, updated: 0, skipped: 0, errors: 0, errorSamples: [] };

  for (const row of rows) {
    const masterName = columns.masterName ? String(row[columns.masterName] || '').trim() : '';
    if (!masterName) {
      result.skipped++;
      continue;
    }
    try {
      const resolved = await equipmentMatchingService.resolveEquipmentName(masterName);
      if (resolved.matchType === 'new_discovery') result.created++;
      else result.matched++;

      const gradeLabel = columns.gradeLabel ? String(row[columns.gradeLabel] || '').trim() || null : null;
      await equipmentRepo.update(resolved.equipmentId, {
        item_no: columns.itemNo ? String(row[columns.itemNo] || '').trim() || null : null,
        master_name: masterName,
        function_type: columns.functionType ? String(row[columns.functionType] || '').trim() || null : null,
        equipment_type: columns.equipmentType ? String(row[columns.equipmentType] || '').trim() || null : null,
        section: columns.section ? String(row[columns.section] || '').trim() || null : null,
        grade_label: gradeLabel,
        grade_num: extractGradeNum(gradeLabel),
        needs_review: false,
      });
      result.updated++;
    } catch (err) {
      result.errors++;
      if (result.errorSamples.length < 5) result.errorSamples.push(err.message);
    }
  }

  return result;
}

module.exports = { importRows };
