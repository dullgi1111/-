-- KEP 계전팀 1차 피드백 16건 반영: 정비이력에 작업명/작업내용/수행반 컬럼 추가,
-- 설비에 설비기본정보 엑셀 원본 컬럼(설비명칭/기능유형/설비유형/section/설비등급) 추가.
ALTER TABLE maintenance_records ADD COLUMN work_name TEXT;
ALTER TABLE maintenance_records ADD COLUMN work_content TEXT;
ALTER TABLE maintenance_records ADD COLUMN work_team TEXT;

ALTER TABLE equipment ADD COLUMN item_no TEXT;
ALTER TABLE equipment ADD COLUMN master_name TEXT;
ALTER TABLE equipment ADD COLUMN function_type TEXT;
ALTER TABLE equipment ADD COLUMN equipment_type TEXT;
ALTER TABLE equipment ADD COLUMN section TEXT;
ALTER TABLE equipment ADD COLUMN grade_label TEXT;
ALTER TABLE equipment ADD COLUMN grade_num INT;

CREATE UNIQUE INDEX idx_equipment_item_no ON equipment(item_no) WHERE item_no IS NOT NULL;
