ALTER TABLE maintenance_records ADD COLUMN type_confirmed BOOLEAN NOT NULL DEFAULT false;

-- values read directly from an explicit source column are already trustworthy;
-- only keyword-guessed classifications need a human to confirm them
UPDATE maintenance_records SET type_confirmed = true WHERE maintenance_type_source = 'mapped_column';

CREATE INDEX idx_records_type_confirmed ON maintenance_records(type_confirmed);
