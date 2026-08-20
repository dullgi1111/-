-- Classification switches from probabilistic keyword-scoring to a
-- deterministic rule-table lookup (maintenance_type_value_map). Rows with
-- no matching rule are marked 'unmapped' instead of being guessed at, so
-- they land in the existing "분류 검토 필요" queue for a human to decide.
ALTER TABLE maintenance_records DROP CONSTRAINT maintenance_records_maintenance_type_source_check;
ALTER TABLE maintenance_records ADD CONSTRAINT maintenance_records_maintenance_type_source_check
  CHECK (maintenance_type_source IN ('mapped_column','keyword_classifier','manual','unmapped'));

-- Seed the rule table with KEP's real 현상 categories so the edit screen
-- isn't empty and new uploads keep classifying the same way the seeded
-- demo data already does.
INSERT INTO maintenance_type_value_map (raw_value_normalized, maintenance_type) VALUES
  ('고장.결함.수명소진', 'breakdown_repair'),
  ('사고.이상', 'breakdown_repair'),
  ('운전 condition 이상', 'breakdown_repair'),
  ('예방 점검/정비', 'preventive_inspection'),
  ('주기적 점검/정비', 'preventive_inspection'),
  ('정기/임시 보수', 'preventive_inspection'),
  ('예지정비', 'preventive_inspection'),
  ('설비개선', 'other'),
  ('법규', 'other'),
  ('she', 'other'),
  ('기타', 'other')
ON CONFLICT (raw_value_normalized) DO NOTHING;

-- classification_min_confidence no longer applies now that classification
-- is an exact-match lookup instead of a confidence-scored guess.
DELETE FROM system_settings WHERE key = 'classification_min_confidence';

-- The weighted-keyword scorer this table backed is removed; classification
-- is now a plain lookup against maintenance_type_value_map only.
DROP TABLE IF EXISTS classification_keywords;
