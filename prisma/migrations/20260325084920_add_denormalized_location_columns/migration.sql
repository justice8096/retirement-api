-- AlterTable
ALTER TABLE "admin_locations" ADD COLUMN     "country" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "monthly_cost_total" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "region" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "admin_location_history_location_id_version_idx" ON "admin_location_history"("location_id", "version");

-- CreateIndex
CREATE INDEX "admin_location_supplements_location_id_idx" ON "admin_location_supplements"("location_id");

-- CreateIndex
CREATE INDEX "admin_locations_country_idx" ON "admin_locations"("country");

-- CreateIndex
CREATE INDEX "admin_locations_region_idx" ON "admin_locations"("region");

-- CreateIndex
CREATE INDEX "admin_locations_currency_idx" ON "admin_locations"("currency");

-- CreateIndex
CREATE INDEX "admin_locations_monthly_cost_total_idx" ON "admin_locations"("monthly_cost_total");

-- CreateIndex
CREATE INDEX "admin_locations_name_idx" ON "admin_locations"("name");

-- CreateIndex
CREATE INDEX "household_members_household_id_idx" ON "household_members"("household_id");

-- CreateIndex
CREATE INDEX "household_pets_household_id_idx" ON "household_pets"("household_id");

-- CreateIndex
CREATE INDEX "user_custom_locations_user_id_idx" ON "user_custom_locations"("user_id");

-- CreateIndex
CREATE INDEX "user_location_overrides_user_id_idx" ON "user_location_overrides"("user_id");

-- CreateIndex
CREATE INDEX "user_scenarios_user_id_idx" ON "user_scenarios"("user_id");
