-- ============================================
-- Le Wagon Bar — Schéma Vercel Postgres
-- Run: npm run db:setup
-- ============================================

-- Transactions SumUp
CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sumup_id      TEXT UNIQUE,
  date          DATE NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  tip           NUMERIC(10,2) DEFAULT 0,
  currency      TEXT DEFAULT 'EUR',
  payment_type  TEXT,
  status        TEXT DEFAULT 'successful',
  note          TEXT,
  raw_data      JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);

-- Factures fournisseurs
CREATE TABLE IF NOT EXISTS invoices (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  gmail_id      TEXT UNIQUE,
  drive_file_id TEXT,
  drive_url     TEXT,
  filename      TEXT,
  fournisseur   TEXT,
  date_facture  DATE,
  montant_ht    NUMERIC(10,2),
  montant_ttc   NUMERIC(10,2),
  tva           NUMERIC(10,2),
  categorie     TEXT CHECK (categorie IN ('boissons','food','charges','loyer','materiel','salaires','autres')),
  description   TEXT,
  extraction_ok BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date_facture DESC);

-- Événements contextuels
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date        DATE NOT NULL,
  type        TEXT CHECK (type IN ('meteo','ramadan','travaux','evenement','fermeture','concurrence','autre')),
  description TEXT NOT NULL,
  impact      TEXT CHECK (impact IN ('positif','negatif','neutre')) DEFAULT 'neutre',
  source      TEXT DEFAULT 'manual',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth tokens (SumUp + Google)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider      TEXT PRIMARY KEY,
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  scope         TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Exports comptables
CREATE TABLE IF NOT EXISTS exports (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  periode         TEXT NOT NULL,
  type            TEXT CHECK (type IN ('excel','csv')),
  filename        TEXT,
  ca_total        NUMERIC(10,2),
  achats_total    NUMERIC(10,2),
  nb_transactions INT,
  nb_factures     INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Sync log
CREATE TABLE IF NOT EXISTS sync_log (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source      TEXT,
  status      TEXT,
  message     TEXT,
  records     INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Page views (usage tracking)
CREATE TABLE IF NOT EXISTS page_views (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  page        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);

-- Vue: CA par jour
CREATE OR REPLACE VIEW daily_revenue AS
  SELECT
    date,
    SUM(amount) AS ca,
    COUNT(*) AS nb_transactions,
    SUM(tip) AS tips
  FROM transactions
  WHERE status = 'successful'
  GROUP BY date
  ORDER BY date DESC;

-- Vue: dépenses par mois et catégorie
CREATE OR REPLACE VIEW monthly_expenses AS
  SELECT
    DATE_TRUNC('month', date_facture) AS mois,
    categorie,
    SUM(montant_ttc) AS total_ttc,
    SUM(montant_ht) AS total_ht,
    COUNT(*) AS nb_factures
  FROM invoices
  GROUP BY DATE_TRUNC('month', date_facture), categorie
  ORDER BY mois DESC;
