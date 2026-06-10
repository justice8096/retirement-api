-- Income composition + ACA assumptions on UserFinancialSettings.
-- Dollar amounts are encrypted at rest (stored as TEXT ciphertext, like the
-- balance columns). The rest are plain assumption fields with defaults so
-- existing rows backfill to the same values the dashboard used session-only.

ALTER TABLE "user_financial_settings"
  ADD COLUMN "traditional_annual"            TEXT,
  ADD COLUMN "roth_annual"                   TEXT,
  ADD COLUMN "taxable_brokerage_annual"      TEXT,
  ADD COLUMN "pension_annual"                TEXT,
  ADD COLUMN "ss_annual"                     TEXT,
  ADD COLUMN "total_annual_need"             TEXT,
  ADD COLUMN "taxable_brokerage_taxable_pct" DECIMAL(65,30) NOT NULL DEFAULT 0.5,
  ADD COLUMN "filing_status"                 TEXT    NOT NULL DEFAULT 'joint',
  ADD COLUMN "apportion_strategy"            TEXT    NOT NULL DEFAULT 'manual',
  ADD COLUMN "subsidy_regime"                TEXT    NOT NULL DEFAULT 'cliff',
  ADD COLUMN "first_year_unsubsidized"       BOOLEAN NOT NULL DEFAULT true;
