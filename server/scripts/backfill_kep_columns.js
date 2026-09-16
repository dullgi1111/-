// Phase 3 synthetic backfill: populates work_name/work_content/work_team on
// maintenance_records for the existing 100k synthetic dataset. Template-based
// text generation only -- never reuses real KEP free-text, per the session's
// confidentiality rule. Category correlations (수행반 분포 등) come from
// aggregate counts extracted from the real KEP work-history file, not from
// any real row's own text.
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ACTION_PHRASES = {
  '분해 점검/정비': ['분해 점검', '분해 정비'],
  '설비/부품 교체': ['부품 교체', '설비 교체'],
  '신설/변경/개조': ['개조 작업', '변경 작업'],
  '수리/보수': ['수리 작업', '보수 작업'],
  '검사/진단': ['진단 점검', '상태 검사'],
  '기타': ['일반 정비 작업', '현장 조치 작업'],
  '임시보수(Valve포함)': ['Valve 임시보수', '임시 응급조치'],
  '교정': ['계기 교정', '교정 작업'],
  '청소/마감처리': ['청소 및 마감', '마감 처리'],
  '테스트': ['동작 테스트', '기능 테스트'],
  '확인 (이상 없음)': ['이상유무 확인', '정상 여부 확인'],
};

const SYMPTOM_PHRASES = {
  '고장.결함.수명소진': '고장·결함 발생',
  '기타': '기타 사유 발생',
  '주기적 점검/정비': '주기적 점검 일정 도래',
  '예방 점검/정비': '예방 점검 일정 도래',
  '설비개선': '설비개선 필요 확인',
  '운전 Condition 이상': '운전 Condition 이상 감지',
  '정기/임시 보수': '정기/임시 보수 필요',
  '예지정비': '예지정비 신호 감지',
  '법규': '법규 대응 필요',
  '사고.이상': '사고·이상 발생',
  'SHE': 'SHE 관련 사유 발생',
};

const WORK_TEAM_WEIGHTS = [
  ['전기/계장', 1478],
  ['기계/장치', 1445],
  ['보일러', 60],
  ['포장', 14],
  ['공무팀', 4],
  ['안전환경팀', 2],
  ['기술기획팀', 2],
  ['소방', 1],
  ['생산', 1],
];
const WORK_TEAM_TOTAL = WORK_TEAM_WEIGHTS.reduce((s, [, w]) => s + w, 0);

function pickWorkTeam(rand) {
  let acc = 0;
  const target = rand * WORK_TEAM_TOTAL;
  for (const [name, weight] of WORK_TEAM_WEIGHTS) {
    acc += weight;
    if (target < acc) return name;
  }
  return WORK_TEAM_WEIGHTS[0][0];
}

function buildWorkName(equipmentName, actionText, id) {
  const variants = ACTION_PHRASES[actionText] || ACTION_PHRASES['기타'];
  const phrase = variants[id % variants.length];
  return `${equipmentName} ${phrase}`;
}

function buildWorkContent(symptomText, actionText, id) {
  // ~19% blank, matching the real work-history file's 작업내용 blank rate
  if (id % 100 < 19) return null;
  const symptomPhrase = SYMPTOM_PHRASES[symptomText] || '현장 확인 필요 사유 발생';
  const variants = ACTION_PHRASES[actionText] || ACTION_PHRASES['기타'];
  const actionPhrase = variants[(id + 1) % variants.length];
  return `${symptomPhrase}으로 ${actionPhrase} 실시`;
}

async function main() {
  const client = await pool.connect();
  try {
    console.log('로딩: maintenance_records id/equipment_name/symptom_text/action_text ...');
    const { rows } = await client.query(
      `SELECT id, equipment_name, symptom_text, action_text FROM maintenance_records WHERE is_deleted = false`
    );
    console.log(`대상 ${rows.length}건. 배치 업데이트 시작...`);

    const BATCH = 1000;
    let done = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const values = [];
      const params = [];
      chunk.forEach((r, idx) => {
        const workName = buildWorkName(r.equipment_name, r.action_text, r.id);
        const workContent = buildWorkContent(r.symptom_text, r.action_text, r.id);
        const rand = ((r.id * 2654435761) % 1000000) / 1000000; // deterministic pseudo-random per id
        const workTeam = pickWorkTeam(Math.abs(rand));
        const base = idx * 4;
        values.push(`($${base + 1}::bigint, $${base + 2}::text, $${base + 3}::text, $${base + 4}::text)`);
        params.push(r.id, workName, workContent, workTeam);
      });
      await client.query(
        `UPDATE maintenance_records AS m
         SET work_name = v.work_name, work_content = v.work_content, work_team = v.work_team
         FROM (VALUES ${values.join(',')}) AS v(id, work_name, work_content, work_team)
         WHERE m.id = v.id`,
        params
      );
      done += chunk.length;
      if (done % 10000 === 0 || done === rows.length) console.log(`  ${done}/${rows.length}`);
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
