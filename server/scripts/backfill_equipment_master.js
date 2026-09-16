// Phase 4 synthetic backfill: populates the 5 설비기본정보 fields (설비명칭/기능유형/
// 설비유형/section/설비등급) plus item_no on the existing ~18.5k equipment rows, using
// only real category-level distributions extracted from KEP's equipment-master file
// (counts, not row text) -- never real free text. 설비명칭/설비유형 are set equal to
// equipment_name, mirroring the near-identical relationship found in the real file
// (199/200 sampled rows had 설비명칭 === 설비유형).
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const FUNCTION_TYPE_WEIGHTS = [
  ['계장', 6757], ['배관', 5921], ['소방', 2208], ['장치', 1777],
  ['기계', 1401], ['전기', 466], ['시험', 149],
];

const GRADE_WEIGHTS = [
  ['1 등급', 127], ['2 등급', 179], ['3 등급', 2499], ['4 등급', 2192],
];

// real top sections (counts from the source file) + a synthesized tail of the
// same K2</letter> naming pattern to cover the remaining weight of the other
// ~39 real sections whose individual counts weren't captured.
const SECTION_WEIGHTS_REAL = [
  ['K2Q/P', 1327], ['K2L/P', 1298], ['K2L/M', 1248], ['K2P/P', 1237], ['K2P/M', 1233],
  ['K2N/P', 1230], ['K2M/P', 1218], ['K2M/M', 1152], ['K2N/M', 1139], ['K2Q/M', 1126],
  ['K2A/P', 1084], ['K2L/F', 460], ['K2N/F', 449], ['DOL/DOL', 423], ['K2Q/F', 418],
];
const SECTION_TAIL = ['K2A/M', 'K2A/F', 'K2B/P', 'K2B/M', 'K2C/P', 'K2C/M', 'K2D/P', 'K2D/M'].map((s) => [s, 450]);
const SECTION_WEIGHTS = [...SECTION_WEIGHTS_REAL, ...SECTION_TAIL];

function pick(weights, rand) {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  const target = rand * total;
  for (const [name, weight] of weights) {
    acc += weight;
    if (target < acc) return name;
  }
  return weights[0][0];
}

function gradeNum(label) {
  const m = label.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT id, equipment_name FROM equipment WHERE status != 'deprecated'`);
    console.log(`대상 ${rows.length}건. 배치 업데이트 시작...`);

    const BATCH = 500;
    let done = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const values2 = [];
      const params2 = [];
      chunk.forEach((r, idx) => {
        const functionType = pick(FUNCTION_TYPE_WEIGHTS, pseudoRandom(r.id * 7.13));
        const gradeLabel = pick(GRADE_WEIGHTS, pseudoRandom(r.id * 3.71));
        const section = pick(SECTION_WEIGHTS, pseudoRandom(r.id * 11.37));
        const itemNo = `EQ-${String(r.id).padStart(6, '0')}`;
        const base = idx * 8;
        values2.push(
          `($${base + 1}::bigint, $${base + 2}::text, $${base + 3}::text, $${base + 4}::text, $${base + 5}::text, $${base + 6}::text, $${base + 7}::text, $${base + 8}::int)`
        );
        params2.push(r.id, itemNo, r.equipment_name, functionType, r.equipment_name, section, gradeLabel, gradeNum(gradeLabel));
      });
      await client.query(
        `UPDATE equipment AS e
         SET item_no = v.item_no, master_name = v.master_name, function_type = v.function_type,
             equipment_type = v.equipment_type, section = v.section, grade_label = v.grade_label,
             grade_num = v.grade_num, needs_review = false
         FROM (VALUES ${values2.join(',')}) AS v(id, item_no, master_name, function_type, equipment_type, section, grade_label, grade_num)
         WHERE e.id = v.id`,
        params2
      );
      done += chunk.length;
      if (done % 5000 === 0 || done === rows.length) console.log(`  ${done}/${rows.length}`);
    }
    console.log('완료.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
