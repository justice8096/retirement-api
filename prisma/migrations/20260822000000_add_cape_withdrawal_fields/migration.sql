-- 'cape' joins the persisted withdrawal-strategy union. The CAPE (Big ERN)
-- strategy reuses the existing ceiling_rate/floor_rate columns for its own
-- clamp range, but needs two knobs no other strategy has: the weight
-- applied to 1/CAPE and the fixed component added to it. Nullable, no
-- default — same pattern as ceiling_rate/floor_rate/adjustment_pct above.
ALTER TABLE "user_withdrawal_strategies"
  ADD COLUMN "cape_multiplier"      DECIMAL(65,30),
  ADD COLUMN "cape_fixed_component" DECIMAL(65,30);
