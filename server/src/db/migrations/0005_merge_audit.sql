CREATE TABLE term_merge_audit_log (
  id BIGSERIAL PRIMARY KEY,
  alias_id BIGINT REFERENCES term_aliases(id),
  canonical_term_id BIGINT NOT NULL REFERENCES canonical_terms(id),
  alias_text TEXT NOT NULL,
  normalized_alias_text TEXT NOT NULL,
  similarity_score NUMERIC(5,4) NOT NULL,
  algorithm_version TEXT NOT NULL,
  source_record_id BIGINT REFERENCES maintenance_records(id),
  merged_by TEXT NOT NULL DEFAULT 'system' CHECK (merged_by IN ('system','user')),
  merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reverted_at TIMESTAMPTZ,
  reverted_by TEXT,
  reverted_reason TEXT
);
CREATE INDEX idx_merge_audit_time ON term_merge_audit_log(merged_at DESC);
CREATE INDEX idx_merge_audit_canonical ON term_merge_audit_log(canonical_term_id);
