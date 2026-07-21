CREATE TABLE record_term_links (
  id BIGSERIAL PRIMARY KEY,
  record_id BIGINT NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN ('symptom','action','part')),
  raw_phrase TEXT NOT NULL,
  canonical_term_id BIGINT REFERENCES canonical_terms(id),
  alias_id BIGINT REFERENCES term_aliases(id),
  match_type TEXT NOT NULL CHECK (match_type IN ('exact','alias_auto_merge','new_discovery','skipped_too_long')),
  similarity_score NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_link_record ON record_term_links(record_id);
CREATE INDEX idx_link_term ON record_term_links(canonical_term_id);
