CREATE TABLE import_batches (
  id                BIGSERIAL PRIMARY KEY,
  source_type       TEXT NOT NULL CHECK (source_type IN ('file_upload','manual')),
  company_source    TEXT,
  original_filename TEXT,
  file_path         TEXT,
  file_ext          TEXT,
  detected_columns  TEXT[],
  column_mapping    JSONB,
  status            TEXT NOT NULL DEFAULT 'uploaded'
                      CHECK (status IN ('uploaded','mapped','processing','completed','failed','cancelled')),
  total_rows        INT DEFAULT 0,
  processed_rows    INT DEFAULT 0,
  error_rows        INT DEFAULT 0,
  uploaded_by       TEXT,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  committed_at      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error_summary     JSONB
);

CREATE TABLE raw_import_rows (
  id            BIGSERIAL PRIMARY KEY,
  batch_id      BIGINT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_number    INT NOT NULL,
  raw_data      JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','error','skipped')),
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_raw_rows_batch ON raw_import_rows(batch_id);
