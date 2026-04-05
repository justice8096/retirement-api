-- AlterTable: Add FIRE and allocation fields to financial settings
ALTER TABLE "user_financial_settings" ADD COLUMN "equity_pct" DECIMAL(5,4) NOT NULL DEFAULT 0.60;
ALTER TABLE "user_financial_settings" ADD COLUMN "bond_pct" DECIMAL(5,4) NOT NULL DEFAULT 0.30;
ALTER TABLE "user_financial_settings" ADD COLUMN "cash_pct" DECIMAL(5,4) NOT NULL DEFAULT 0.10;
ALTER TABLE "user_financial_settings" ADD COLUMN "intl_pct" DECIMAL(5,4) NOT NULL DEFAULT 0.20;
ALTER TABLE "user_financial_settings" ADD COLUMN "expected_return" DECIMAL(5,4) NOT NULL DEFAULT 0.07;
ALTER TABLE "user_financial_settings" ADD COLUMN "expected_inflation" DECIMAL(5,4) NOT NULL DEFAULT 0.025;
ALTER TABLE "user_financial_settings" ADD COLUMN "retirement_path" TEXT NOT NULL DEFAULT 'traditional';
ALTER TABLE "user_financial_settings" ADD COLUMN "fire_target_age" INTEGER;
ALTER TABLE "user_financial_settings" ADD COLUMN "annual_savings" DECIMAL(15,2);
ALTER TABLE "user_financial_settings" ADD COLUMN "savings_rate" DECIMAL(5,4);
ALTER TABLE "user_financial_settings" ADD COLUMN "traditional_balance" TEXT;
ALTER TABLE "user_financial_settings" ADD COLUMN "roth_balance" TEXT;
ALTER TABLE "user_financial_settings" ADD COLUMN "taxable_balance" TEXT;
ALTER TABLE "user_financial_settings" ADD COLUMN "hsa_balance" TEXT;

-- CreateTable: Withdrawal strategies
CREATE TABLE "user_withdrawal_strategies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "strategy_type" TEXT NOT NULL DEFAULT 'fixed',
    "withdrawal_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.04,
    "ceiling_rate" DECIMAL(5,4),
    "floor_rate" DECIMAL(5,4),
    "adjustment_pct" DECIMAL(5,4),
    "bucket1_years" INTEGER,
    "bucket2_years" INTEGER,
    "refill_threshold" DECIMAL(5,2),
    "essential_spending" DECIMAL(15,2),
    "discretionary_budget" DECIMAL(15,2),
    "max_discretionary_rate" DECIMAL(5,4),
    "spending_model" TEXT NOT NULL DEFAULT 'level',
    "decline_rate" DECIMAL(5,4),
    "roth_conversion_enabled" BOOLEAN NOT NULL DEFAULT false,
    "roth_conversion_amount" DECIMAL(15,2),
    "roth_conversion_end_age" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_withdrawal_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_withdrawal_strategies_user_id_key" ON "user_withdrawal_strategies"("user_id");

-- AddForeignKey
ALTER TABLE "user_withdrawal_strategies" ADD CONSTRAINT "user_withdrawal_strategies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add scenario metadata fields
ALTER TABLE "user_scenarios" ADD COLUMN "scenario_type" TEXT NOT NULL DEFAULT 'deterministic';
ALTER TABLE "user_scenarios" ADD COLUMN "success_rate" DECIMAL(5,2);
ALTER TABLE "user_scenarios" ADD COLUMN "median_balance" DECIMAL(15,2);
ALTER TABLE "user_scenarios" ADD COLUMN "p10_balance" DECIMAL(15,2);
ALTER TABLE "user_scenarios" ADD COLUMN "p90_balance" DECIMAL(15,2);
ALTER TABLE "user_scenarios" ADD COLUMN "simulation_runs" INTEGER;
ALTER TABLE "user_scenarios" ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false;
