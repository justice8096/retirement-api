-- Add primary-residence mortgage fields to user_financial_settings (Todo #28).
-- Payment is in USD per month, NOT CPI-inflated (mortgage P+I is nominal,
-- so the kernel applies it without multiplying by cumulative inflation).
-- End year is the exclusive sim-year cutoff for natural payoff. Both
-- default 0, meaning "no mortgage configured" — existing rows get this
-- safe default and continue to behave as before this column existed.
--
-- Early payoff is modeled by the user as a oneTimeExpense LifeEvent for
-- the remaining principal + setting mortgageEndYear to the payoff year.
-- The api stores raw values; behavior lives in the dashboard kernel.

ALTER TABLE "user_financial_settings"
  ADD COLUMN "mortgage_monthly_payment" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "mortgage_end_year"        INTEGER         NOT NULL DEFAULT 0;
