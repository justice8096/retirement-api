-- Add per-account Load % and Fees % to user_financial_settings.
-- Both stored as decimal fractions (0.005 = 0.5%); client sends whole-%.
-- Represents recurring annual drag on return.

ALTER TABLE "user_financial_settings"
  ADD COLUMN "traditional_load_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "roth_load_pct"        DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "taxable_load_pct"     DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "hsa_load_pct"         DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "traditional_fees_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "roth_fees_pct"        DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "taxable_fees_pct"     DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "hsa_fees_pct"         DECIMAL(65,30) NOT NULL DEFAULT 0;
