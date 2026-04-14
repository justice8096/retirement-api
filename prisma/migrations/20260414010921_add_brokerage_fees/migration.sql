-- AlterTable
ALTER TABLE "household_profiles" ALTER COLUMN "planning_years" SET DEFAULT 40;

-- AlterTable
ALTER TABLE "user_financial_settings" ALTER COLUMN "equity_pct" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "bond_pct" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "cash_pct" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "intl_pct" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "expected_return" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "expected_inflation" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "annual_savings" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "savings_rate" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "user_scenarios" ALTER COLUMN "success_rate" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "median_balance" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "p10_balance" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "p90_balance" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "user_withdrawal_strategies" ALTER COLUMN "withdrawal_rate" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "ceiling_rate" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "floor_rate" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "adjustment_pct" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "refill_threshold" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "essential_spending" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "discretionary_budget" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "max_discretionary_rate" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "decline_rate" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "roth_conversion_amount" SET DATA TYPE DECIMAL(65,30);

-- CreateTable
CREATE TABLE "user_brokerage_fees" (
    "user_id" TEXT NOT NULL,
    "brokerage_fee_pct" DECIMAL(65,30) NOT NULL DEFAULT 0.005,
    "brokerage_fee_flat" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "brokerage_annual_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "brokerage_expense_ratio" DECIMAL(65,30) NOT NULL DEFAULT 0.002,
    "wire_transfer_fee_usd" DECIMAL(65,30) NOT NULL DEFAULT 25,
    "wire_transfer_fee_local" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ach_transfer_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fx_spread_pct" DECIMAL(65,30) NOT NULL DEFAULT 0.01,
    "fx_fixed_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fx_provider" TEXT NOT NULL DEFAULT 'bank',
    "local_currency" TEXT NOT NULL DEFAULT 'USD',
    "manual_exchange_rate" DECIMAL(65,30),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_brokerage_fees_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "user_brokerage_fees" ADD CONSTRAINT "user_brokerage_fees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
