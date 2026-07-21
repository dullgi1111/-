CREATE TABLE canonical_terms (
  id BIGSERIAL PRIMARY KEY,
  term_type TEXT NOT NULL CHECK (term_type IN ('symptom','action','part')),
  canonical_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  description TEXT,
  origin TEXT NOT NULL DEFAULT 'seed' CHECK (origin IN ('seed','auto_discovered','manual')),
  needs_review BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deprecated','merged_away')),
  merged_into_id BIGINT REFERENCES canonical_terms(id),
  occurrence_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (term_type, normalized_text)
);
CREATE INDEX idx_canonical_trgm ON canonical_terms USING GIN (normalized_text gin_trgm_ops);
CREATE INDEX idx_canonical_type ON canonical_terms(term_type, status);

CREATE TABLE term_aliases (
  id BIGSERIAL PRIMARY KEY,
  canonical_term_id BIGINT NOT NULL REFERENCES canonical_terms(id) ON DELETE CASCADE,
  alias_text TEXT NOT NULL,
  normalized_alias_text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('auto_merge','manual','seed')),
  matched_similarity NUMERIC(5,4),
  matched_algorithm_version TEXT,
  matched_at TIMESTAMPTZ,
  source_record_id BIGINT REFERENCES maintenance_records(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (canonical_term_id, normalized_alias_text)
);
CREATE INDEX idx_alias_canonical ON term_aliases(canonical_term_id);
CREATE INDEX idx_alias_trgm ON term_aliases USING GIN (normalized_alias_text gin_trgm_ops);
