INSERT INTO classification_keywords (keyword, maintenance_type, weight) VALUES
  ('점검', 'preventive_inspection', 1.0),
  ('예방', 'preventive_inspection', 1.5),
  ('정기', 'preventive_inspection', 1.0),
  ('순회점검', 'preventive_inspection', 1.5),
  ('사전점검', 'preventive_inspection', 1.5),
  ('고장', 'breakdown_repair', 1.5),
  ('수리', 'breakdown_repair', 1.0),
  ('교체', 'breakdown_repair', 1.0),
  ('결함', 'breakdown_repair', 1.0),
  ('파손', 'breakdown_repair', 1.0),
  ('정지', 'breakdown_repair', 1.0),
  ('긴급수리', 'breakdown_repair', 1.5)
ON CONFLICT (keyword, maintenance_type) DO NOTHING;
