CREATE TABLE IF NOT EXISTS country_overrides (
  country_key TEXT PRIMARY KEY,
  data TEXT,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS country_overrides_updated_at
  ON country_overrides (updated_at);
