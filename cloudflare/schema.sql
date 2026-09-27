PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS flower_species (
  species_key TEXT PRIMARY KEY,
  name_ko TEXT NOT NULL,
  name_en TEXT,
  seed_price INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL,
  growth_minutes INTEGER NOT NULL,
  completion_reward INTEGER NOT NULL,
  season_label TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_stage_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  species_key TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  stage_name_ko TEXT NOT NULL,
  r2_object_key TEXT NOT NULL,
  public_url TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/webp',
  asset_version INTEGER NOT NULL DEFAULT 1,
  sha256 TEXT,
  width INTEGER,
  height INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(species_key, stage_key, asset_version),
  FOREIGN KEY (species_key) REFERENCES flower_species(species_key)
);

CREATE INDEX IF NOT EXISTS idx_growth_stage_assets_species
ON growth_stage_assets(species_key, stage_order, active);
