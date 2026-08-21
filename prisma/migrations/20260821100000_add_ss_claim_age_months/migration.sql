-- Month-precision SS claim age: months past ssClaimAge (0-11). SSA reckons
-- claim dates in months; claiming at 67y4m = ss_claim_age 67 + 4 months.
ALTER TABLE "household_members" ADD COLUMN "ss_claim_age_months" INTEGER NOT NULL DEFAULT 0;
