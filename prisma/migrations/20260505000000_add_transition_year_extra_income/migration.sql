-- Add first-year transition extra-income field to user_financial_settings.
-- This is a one-shot dollar amount that boosts MAGI in sim year 0 only —
-- captures severance, unused PTO, final-year bonuses, and year-of-retirement
-- RMDs that can blow up ACA subsidies if a user retires mid-year.
--
-- Default 0 means "no transition spike" — existing rows continue to behave
-- as they did before this column existed (steady-state MAGI only).

ALTER TABLE "user_financial_settings"
  ADD COLUMN "transition_year_extra_income" DECIMAL(65,30) NOT NULL DEFAULT 0;
