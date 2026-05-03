-- Add rental_properties JSONB column to user_financial_settings (Todo #36).
-- Persists the RentalProperty[] portfolio that was session-only in PRs
-- #118 (data model) and #120 (MC kernel integration). Default '[]' means
-- existing rows get an empty portfolio — matches the session-only
-- behavior they had before this column existed.
--
-- Shape is validated at the application boundary (Zod schema in
-- src/routes/financial.ts), not at the database level — this is a
-- passthrough column, same pattern as user_preferences.preferences and
-- user_grocery_data.tagged_items.

ALTER TABLE "user_financial_settings"
  ADD COLUMN "rental_properties" JSONB NOT NULL DEFAULT '[]';
