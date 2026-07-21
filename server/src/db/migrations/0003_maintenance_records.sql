CREATE TABLE maintenance_records (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT REFERENCES import_batches(id),
  raw_row_id BIGINT REFERENCES raw_import_rows(id),
  equipment_name TEXT NOT NULL,
  record_date DATE NOT NULL,
  company_source TEXT,
  maintenance_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (maintenance_type IN ('breakdown_repair','preventive_inspection','other','unknown')),
  maintenance_type_source TEXT NOT NULL
    CHECK (maintenance_type_source IN ('mapped_column','keyword_classifier','manual')),
  maintenance_type_raw_value TEXT,
  maintenance_type_confidence NUMERIC(4,3),
  matched_keywords TEXT[],
  symptom_text TEXT,
  action_text TEXT,
  part_text TEXT,
  entered_by TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_records_equipment ON maintenance_records(equipment_name);
CREATE INDEX idx_records_date ON maintenance_records(record_date);
CREATE INDEX idx_records_type ON maintenance_records(maintenance_type);
CREATE INDEX idx_records_batch ON maintenance_records(batch_id);
