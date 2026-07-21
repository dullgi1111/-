CREATE TABLE term_definitions (
  id BIGSERIAL PRIMARY KEY,
  canonical_term_id BIGINT NOT NULL REFERENCES canonical_terms(id) ON DELETE CASCADE,
  definition_text TEXT NOT NULL,
  source_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (canonical_term_id, definition_text)
);
CREATE INDEX idx_definitions_canonical ON term_definitions(canonical_term_id);

-- Preserve any single description that was already set before this migration.
INSERT INTO term_definitions (canonical_term_id, definition_text, source_label)
SELECT id, description, '이전 데이터'
FROM canonical_terms
WHERE description IS NOT NULL AND trim(description) != ''
ON CONFLICT DO NOTHING;
