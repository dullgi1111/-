CREATE TABLE classification_keywords (
  id BIGSERIAL PRIMARY KEY,
  keyword TEXT NOT NULL,
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('breakdown_repair','preventive_inspection','other')),
  weight NUMERIC(3,1) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (keyword, maintenance_type)
);

CREATE TABLE maintenance_type_value_map (
  id BIGSERIAL PRIMARY KEY,
  raw_value_normalized TEXT NOT NULL UNIQUE,
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('breakdown_repair','preventive_inspection','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
