CREATE TABLE activity_log (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  area TEXT NOT NULL,
  item TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  note TEXT
);
CREATE INDEX idx_activity_log_occurred ON activity_log(occurred_at DESC);
CREATE INDEX idx_activity_log_area ON activity_log(area);
