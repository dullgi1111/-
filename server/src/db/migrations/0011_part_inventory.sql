CREATE TABLE part_inventory (
  id BIGSERIAL PRIMARY KEY,
  canonical_term_id BIGINT NOT NULL UNIQUE REFERENCES canonical_terms(id) ON DELETE CASCADE,
  stock_quantity INT NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '개',
  min_stock_alert INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
