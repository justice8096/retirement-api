-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('free', 'basic', 'premium', 'admin');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "auth_provider_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'free',
    "stripe_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "adults_count" INTEGER NOT NULL DEFAULT 2,
    "target_annual_income" TEXT,
    "planning_start_year" INTEGER NOT NULL DEFAULT 2026,
    "planning_years" INTEGER NOT NULL DEFAULT 35,
    "requirements" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'primary',
    "name" TEXT,
    "birth_year" INTEGER NOT NULL,
    "ss_pia" TEXT,
    "ss_fra" INTEGER,
    "ss_claim_age" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_pets" (
    "id" TEXT NOT NULL,
    "household_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'dog',
    "breed" TEXT,
    "size" TEXT,
    "birth_year" INTEGER NOT NULL,
    "expected_lifespan" INTEGER NOT NULL DEFAULT 12,

    CONSTRAINT "household_pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_financial_settings" (
    "user_id" TEXT NOT NULL,
    "portfolio_balance" TEXT NOT NULL DEFAULT '500000',
    "fx_drift_enabled" BOOLEAN NOT NULL DEFAULT true,
    "fx_drift_annual_rate" DECIMAL(65,30) NOT NULL DEFAULT 0.01,
    "ss_cut_enabled" BOOLEAN NOT NULL DEFAULT true,
    "ss_cut_year" INTEGER NOT NULL DEFAULT 2033,
    "ss_cola" DECIMAL(65,30) NOT NULL DEFAULT 2.5,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_financial_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" TEXT NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_custom_locations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "location_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_custom_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_location_overrides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "base_location_id" TEXT NOT NULL,
    "base_location_version" INTEGER NOT NULL DEFAULT 1,
    "overrides" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_location_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_scenarios" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scenario_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_grocery_data" (
    "user_id" TEXT NOT NULL,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "lists" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_grocery_data_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "admin_locations" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "location_data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_location_supplements" (
    "location_id" TEXT NOT NULL,
    "data_type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_location_supplements_pkey" PRIMARY KEY ("location_id","data_type")
);

-- CreateTable
CREATE TABLE "admin_shared_data" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_shared_data_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "admin_location_history" (
    "id" SERIAL NOT NULL,
    "location_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "location_data" JSONB NOT NULL,
    "changed_by" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_location_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_provider_id_key" ON "users"("auth_provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "household_profiles_user_id_key" ON "household_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_location_overrides_user_id_base_location_id_key" ON "user_location_overrides"("user_id", "base_location_id");

-- AddForeignKey
ALTER TABLE "household_profiles" ADD CONSTRAINT "household_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_pets" ADD CONSTRAINT "household_pets_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_financial_settings" ADD CONSTRAINT "user_financial_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_custom_locations" ADD CONSTRAINT "user_custom_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_location_overrides" ADD CONSTRAINT "user_location_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scenarios" ADD CONSTRAINT "user_scenarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_grocery_data" ADD CONSTRAINT "user_grocery_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_location_supplements" ADD CONSTRAINT "admin_location_supplements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "admin_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_location_history" ADD CONSTRAINT "admin_location_history_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "admin_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

