-- Migration 001: Enrichir events pour Open Data
-- Run: psql $POSTGRES_URL -f db/migrations/001_events_open_data.sql

-- Nouvelles colonnes
ALTER TABLE events ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS date_fin DATE;

-- Index unique pour déduplication (NULL autorisés = events manuels)
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_external_id ON events(external_id) WHERE external_id IS NOT NULL;

-- Index date pour les requêtes temporelles
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date DESC);

-- Étendre le CHECK type (drop + recreate)
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('meteo','ramadan','travaux','evenement','fermeture','concurrence','autre','jour-ferie','vacances-scolaires','travaux-voirie','match-foot'));
