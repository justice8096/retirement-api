-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('cost_correction', 'new_location', 'review_rating', 'supplemental_data');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "FeatureSet" AS ENUM ('basic', 'premium');

-- CreateEnum
CREATE TYPE "UnlockReason" AS ENUM ('contribution', 'purchase', 'grandfathered', 'admin_grant');

-- CreateEnum
CREATE TYPE "GrantedReason" AS ENUM ('purchase', 'grandfathered', 'admin_grant');

-- CreateTable
CREATE TABLE "data_releases" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_usd" INTEGER NOT NULL DEFAULT 0,
    "stripe_price_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_release_purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "granted_reason" "GrantedReason" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_release_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "ContributionType" NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'pending',
    "location_id" TEXT,
    "title" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "admin_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_key" TEXT NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feature_unlocks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature_set" "FeatureSet" NOT NULL,
    "unlocked_via" "UnlockReason" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feature_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_releases_version_key" ON "data_releases"("version");

-- CreateIndex
CREATE INDEX "data_releases_published_at_idx" ON "data_releases"("published_at");

-- CreateIndex
CREATE INDEX "user_release_purchases_user_id_idx" ON "user_release_purchases"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_release_purchases_user_id_release_id_key" ON "user_release_purchases"("user_id", "release_id");

-- CreateIndex
CREATE INDEX "contributions_user_id_idx" ON "contributions"("user_id");

-- CreateIndex
CREATE INDEX "contributions_status_idx" ON "contributions"("status");

-- CreateIndex
CREATE INDEX "contributions_type_idx" ON "contributions"("type");

-- CreateIndex
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_key_key" ON "user_badges"("user_id", "badge_key");

-- CreateIndex
CREATE INDEX "user_feature_unlocks_user_id_idx" ON "user_feature_unlocks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_feature_unlocks_user_id_feature_set_key" ON "user_feature_unlocks"("user_id", "feature_set");

-- AddForeignKey
ALTER TABLE "user_release_purchases" ADD CONSTRAINT "user_release_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_release_purchases" ADD CONSTRAINT "user_release_purchases_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "data_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feature_unlocks" ADD CONSTRAINT "user_feature_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
