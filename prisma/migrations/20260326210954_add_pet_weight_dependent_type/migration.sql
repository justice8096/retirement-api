-- AlterTable
ALTER TABLE "household_members" ADD COLUMN     "dependent_type" TEXT;

-- AlterTable
ALTER TABLE "household_pets" ADD COLUMN     "name" TEXT,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weight" INTEGER,
ADD COLUMN     "weight_tier" TEXT;
