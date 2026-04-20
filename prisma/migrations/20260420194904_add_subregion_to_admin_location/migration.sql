-- AlterTable
ALTER TABLE "admin_locations" ADD COLUMN     "subregion" TEXT;

-- Backfill subregion from locationData JSONB. Paired with the region-
-- taxonomy migration that added `subregion` to every location.json.
-- Idempotent: running on rows that already have a subregion is a no-op.
UPDATE "admin_locations"
SET "subregion" = location_data->>'subregion'
WHERE location_data ? 'subregion';

-- CreateIndex
CREATE INDEX "admin_locations_subregion_idx" ON "admin_locations"("subregion");
