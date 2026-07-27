CREATE TABLE equipment (
  id BIGSERIAL PRIMARY KEY,
  equipment_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  model_number TEXT,
  manufacturer TEXT,
  spec TEXT,
  install_date DATE,
  location TEXT,
  notes TEXT,
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'auto_discovered')),
  needs_review BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  occurrence_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_equipment_trgm ON equipment USING GIN (normalized_name gin_trgm_ops);
CREATE INDEX idx_equipment_status ON equipment(status);

CREATE TABLE equipment_aliases (
  id BIGSERIAL PRIMARY KEY,
  equipment_id BIGINT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  alias_text TEXT NOT NULL,
  normalized_alias_text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('auto_merge', 'manual', 'seed')),
  matched_similarity NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (equipment_id, normalized_alias_text)
);
CREATE INDEX idx_equipment_alias_equipment ON equipment_aliases(equipment_id);
CREATE INDEX idx_equipment_alias_trgm ON equipment_aliases USING GIN (normalized_alias_text gin_trgm_ops);

ALTER TABLE maintenance_records ADD COLUMN equipment_id BIGINT REFERENCES equipment(id);
CREATE INDEX idx_records_equipment_id ON maintenance_records(equipment_id);

-- backfill: one equipment row per distinct existing equipment_name text (approximate
-- normalization here; going forward the app's JS-side matcher owns dedup/merge logic),
-- flagged for review since these were never actually confirmed as canonical
INSERT INTO equipment (equipment_name, normalized_name, origin, needs_review, occurrence_count)
SELECT
  (ARRAY_AGG(equipment_name ORDER BY id))[1],
  lower(regexp_replace(trim(equipment_name), '\s+', ' ', 'g')),
  'auto_discovered',
  true,
  COUNT(*)
FROM maintenance_records
WHERE is_deleted = false
GROUP BY lower(regexp_replace(trim(equipment_name), '\s+', ' ', 'g'))
ON CONFLICT (normalized_name) DO NOTHING;

UPDATE maintenance_records mr
SET equipment_id = e.id
FROM equipment e
WHERE e.normalized_name = lower(regexp_replace(trim(mr.equipment_name), '\s+', ' ', 'g'))
  AND mr.equipment_id IS NULL;
