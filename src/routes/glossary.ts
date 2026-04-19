import type { FastifyInstance } from 'fastify';

/**
 * Financial-term glossary exposed to any client that needs to show
 * plain-language definitions. Sourced from the JSDoc in `shared/**` so the
 * server stays the single source of truth.
 *
 * Addresses:
 *   - Dyslexia audit F-003 (glossary endpoint)
 *   - Dyscalculia audit F-004 (glossary endpoint)
 *   - Dyscalculia audit F-010 (CAGR + sequence-of-returns-risk definitions)
 *
 * Response shape per term:
 *   {
 *     key:       stable lookup key (snake_case, API-safe),
 *     term:      display name,
 *     aliases:   [synonyms shown in the UI],
 *     plain:     grade-8-readable one-sentence definition,
 *     example:   short worked example,
 *     technical: precise technical definition for advanced readers,
 *     seeAlso:   [related keys]
 *   }
 */

export interface GlossaryEntry {
  key: string;
  term: string;
  aliases: string[];
  plain: string;
  example: string;
  technical: string;
  seeAlso: string[];
}

const GLOSSARY: GlossaryEntry[] = [
  {
    key: 'safe_withdrawal_rate',
    term: 'Safe Withdrawal Rate',
    aliases: ['SWR', '4% rule', 'withdrawal rate'],
    plain: 'The share of your savings you plan to spend each year in retirement.',
    example: 'A 4% rate on a $1,000,000 portfolio means spending $40,000 in year one.',
    technical:
      'Annual withdrawal as a fraction of the starting retirement portfolio. The 4% rule comes from the Trinity study (1998) which tested historical 30-year retirement periods.',
    seeAlso: ['fire_number', 'sequence_risk', 'cagr'],
  },
  {
    key: 'fire_number',
    term: 'FIRE Number',
    aliases: ['target portfolio', 'FI number'],
    plain: 'The amount of savings you need before you can retire on your investments.',
    example:
      'If you spend $40,000 per year and use a 4% withdrawal rate, your FIRE Number is 25 × $40,000 = $1,000,000.',
    technical:
      'Annual spending divided by the safe withdrawal rate. Equivalent to 1 ÷ rate as a multiplier (4% → 25×).',
    seeAlso: ['safe_withdrawal_rate', 'coast_fire', 'barista_fire'],
  },
  {
    key: 'coast_fire',
    term: 'Coast FIRE',
    aliases: ['coast number'],
    plain:
      'The amount you need saved now so that, with no further contributions, compound growth alone will reach your FIRE number by retirement.',
    example:
      'If you need $1,000,000 at age 65 and you are 35 with a 7% expected return, your Coast FIRE is about $131,000 today.',
    technical:
      'Coast = FIRE_Number ÷ (1 + expectedReturn)^(yearsToRetirement).',
    seeAlso: ['fire_number', 'barista_fire'],
  },
  {
    key: 'barista_fire',
    term: 'Barista FIRE',
    aliases: ['partial FIRE'],
    plain:
      'You have enough savings to cover part of your spending, and earn the rest from light part-time work.',
    example:
      'A $500,000 portfolio covering $20,000/year plus a $25,000/year part-time job covers a $45,000/year lifestyle.',
    technical:
      'Any state where portfolio income < annual spending, with the gap filled by reduced-hours labor income.',
    seeAlso: ['fire_number', 'coast_fire'],
  },
  {
    key: 'sequence_risk',
    term: 'Sequence-of-Returns Risk',
    aliases: ['sequence risk', 'SORR'],
    plain:
      'The risk that bad investment years early in retirement do more damage than the same bad years would do later.',
    example:
      'Two retirees with the same average return can end in very different places if one has losses in years 1–3.',
    technical:
      'Because withdrawals compound alongside returns, the ordering of returns matters for portfolio survival; Monte Carlo simulations quantify this.',
    seeAlso: ['monte_carlo', 'guardrails'],
  },
  {
    key: 'cagr',
    term: 'Compound Annual Growth Rate',
    aliases: ['CAGR', 'annualized return'],
    plain:
      'The steady yearly return that would take your portfolio from its starting value to its ending value.',
    example:
      'Growing $10,000 to $20,000 over 10 years is a CAGR of about 7.18% per year.',
    technical:
      'CAGR = (end / start)^(1 / years) − 1.',
    seeAlso: ['expected_return', 'safe_withdrawal_rate'],
  },
  {
    key: 'monte_carlo',
    term: 'Monte Carlo Simulation',
    aliases: ['MC', 'probability simulation'],
    plain:
      'A way to test your plan against thousands of random possible futures to see how often it works.',
    example:
      'If your plan succeeds in 7 out of 10 simulations, it has a 70% success rate.',
    technical:
      'Random sampling of returns and inflation per year across many trials; success = portfolio > 0 at the end of the horizon.',
    seeAlso: ['sequence_risk', 'success_rate'],
  },
  {
    key: 'success_rate',
    term: 'Success Rate',
    aliases: ['probability of success'],
    plain:
      'The share of simulated retirements where you did not run out of money.',
    example: 'A 70% success rate is "7 out of 10 simulated futures left you above $0."',
    technical:
      'count(trials where ending balance > 0) ÷ total trials, as a decimal fraction.',
    seeAlso: ['monte_carlo', 'sequence_risk'],
  },
  {
    key: 'vpw',
    term: 'Variable Percentage Withdrawal',
    aliases: ['VPW'],
    plain:
      'A strategy that divides your remaining portfolio by an age-based number each year, so you spend more later in life.',
    example:
      'At age 65 a divisor of about 21 gives you 1/21 of the portfolio that year. At age 85 it drops to about 10.',
    technical:
      'Divisors come from IRS-style uniform lifetime tables interpolated to each age.',
    seeAlso: ['guardrails', 'bucket_strategy'],
  },
  {
    key: 'guardrails',
    term: 'Guardrails (Guyton-Klinger)',
    aliases: ['guardrails rule'],
    plain:
      'You spend a set percentage, but raise or lower it when markets push you near the edges of a safe range.',
    example:
      'If your withdrawal share climbs above a ceiling, cut spending by 10%. If it falls below a floor, raise spending.',
    technical:
      'If currentRate > ceilingRate, multiply spending by (1 − adjustmentPct). If < floorRate, multiply by (1 + adjustmentPct).',
    seeAlso: ['vpw', 'bucket_strategy'],
  },
  {
    key: 'bucket_strategy',
    term: 'Bucket Strategy',
    aliases: ['buckets', 'multi-bucket'],
    plain:
      'You split your portfolio into short-term cash, medium-term bonds, and long-term stocks, and refill buckets as time goes on.',
    example:
      'Two years of expenses in cash (bucket 1), five in bonds (bucket 2), the rest in stocks (bucket 3).',
    technical:
      'Withdraw first from the short-term bucket; rebalance from growth when higher buckets exceed a threshold.',
    seeAlso: ['vpw', 'guardrails'],
  },
  {
    key: 'floor_ceiling',
    term: 'Floor-Ceiling Strategy',
    aliases: ['essential-discretionary'],
    plain:
      'Cover essentials with guaranteed income, and let discretionary spending flex with how markets perform.',
    example:
      'Essentials of $30k covered by Social Security; discretionary $10–20k flexes with the portfolio.',
    technical:
      'Floor = max(0, essentialSpending − guaranteedIncome); ceiling capped at a discretionary rate of the portfolio.',
    seeAlso: ['guardrails', 'bucket_strategy'],
  },
  {
    key: 'rmd',
    term: 'Required Minimum Distribution',
    aliases: ['RMD'],
    plain:
      'The minimum amount the IRS makes you withdraw each year from certain retirement accounts once you reach a set age.',
    example:
      'A 75-year-old with a $500,000 IRA must withdraw about $20,325 that year (using the 2024 table).',
    technical:
      'Previous year-end balance ÷ IRS uniform lifetime table divisor for current age.',
    seeAlso: ['roth_conversion'],
  },
  {
    key: 'roth_conversion',
    term: 'Roth Conversion',
    aliases: ['Roth ladder'],
    plain:
      'Moving money from a pre-tax IRA into a Roth IRA, paying taxes now so future growth and withdrawals are tax-free.',
    example:
      'Converting $20,000 per year from a Traditional IRA to a Roth during low-income retirement years.',
    technical:
      'Converted amount is taxed as ordinary income in the conversion year; subject to 5-year rule for withdrawals.',
    seeAlso: ['rmd'],
  },
  {
    key: 'expense_ratio',
    term: 'Expense Ratio',
    aliases: ['fund fee', 'OER'],
    plain:
      'The yearly fee you pay a fund, as a percentage of your money invested in it.',
    example:
      'An expense ratio of 0.05% costs $5 per $10,000 invested per year. A 1% ratio costs $100.',
    technical:
      'Net annual operating cost of a fund divided by average net assets.',
    seeAlso: ['brokerage_fee'],
  },
  {
    key: 'brokerage_fee',
    term: 'Brokerage Fee',
    aliases: ['advisor fee'],
    plain:
      'A yearly fee your brokerage or advisor charges on top of any fund fees.',
    example:
      'A 0.25% advisor fee on $500,000 costs $1,250 per year.',
    technical:
      'Asset-under-management (AUM) fee deducted quarterly or annually; compounds against portfolio growth.',
    seeAlso: ['expense_ratio'],
  },
  {
    key: 'fx_drift',
    term: 'FX Drift',
    aliases: ['currency drift', 'exchange-rate drift'],
    plain:
      'How much the US dollar is expected to gain or lose against another currency each year.',
    example:
      'A 2% FX drift means a $1,000/month foreign bill is expected to cost $1,020 next year in dollars.',
    technical:
      'Annual trend in the home-to-local exchange rate, applied as a multiplier to foreign-denominated costs.',
    seeAlso: ['expected_inflation'],
  },
  {
    key: 'expected_inflation',
    term: 'Inflation',
    aliases: ['CPI', 'cost-of-living increase'],
    plain:
      'The rate at which prices rise over time, which shrinks what each dollar buys.',
    example:
      'At 3% inflation, $1,000 of expenses today becomes about $1,806 in 20 years.',
    technical:
      'Annualized change in a price index such as CPI-U; compounds as (1 + rate)^years.',
    seeAlso: ['fx_drift', 'cagr'],
  },
  {
    key: 'expected_return',
    term: 'Expected Return',
    aliases: ['mean return'],
    plain:
      'The average yearly gain you expect from your investments over the long run.',
    example:
      'A 7% expected return on $100,000 means about $7,000 in growth in a typical year.',
    technical:
      'Long-run mean of annual portfolio returns; realized returns vary around this mean per year (see volatility).',
    seeAlso: ['cagr', 'sequence_risk'],
  },
  {
    key: 'blanchett_smile',
    term: 'Spending Smile',
    aliases: ['retirement smile', 'Blanchett smile'],
    plain:
      'A pattern where retirement spending tends to fall in middle years and rise again late in life due to healthcare.',
    example:
      'Go-go years (1–10): spending slowly declines. Slow-go (11–20): lowest. No-go (21+): rises with care costs.',
    technical:
      'Blanchett (2014) identified a U-shaped real-spending curve in retirement. Implementations apply a per-year adjustment factor.',
    seeAlso: ['declining_spending'],
  },
  {
    key: 'declining_spending',
    term: 'Declining Spending',
    aliases: ['spending decline'],
    plain:
      'A model where retirement spending drops a small percent each year, reflecting slower travel and activity in later years.',
    example:
      'A 1% annual decline on $50,000 becomes about $49,500 next year and $40,900 after 20 years.',
    technical:
      'baseSpending × (1 − declineRate)^yearsIntoRetirement.',
    seeAlso: ['blanchett_smile'],
  },
  {
    key: 'aca',
    term: 'ACA',
    aliases: ['Affordable Care Act', 'Obamacare', 'marketplace', 'exchange'],
    plain:
      'A US law that lets you buy health insurance on a government marketplace and may lower the price based on your income.',
    example:
      'A couple retiring at 62 with modest income can buy an ACA plan and pay much less than the sticker price.',
    technical:
      'Patient Protection and Affordable Care Act of 2010. Creates federal and state insurance exchanges and income-tested premium tax credits governed by IRC §36B.',
    seeAlso: ['magi', 'fpl', 'subsidy_cliff', 'applicable_percentage'],
  },
  {
    key: 'magi',
    term: 'MAGI',
    aliases: ['Modified Adjusted Gross Income', 'ACA income'],
    plain:
      'The measure of yearly income the government uses to decide how much health-insurance help you qualify for.',
    example:
      'If your Adjusted Gross Income is $70,000 and you got $20,000 in Social Security, your MAGI for ACA is about $90,000.',
    technical:
      'For ACA purposes: AGI + any tax-exempt interest + non-taxable Social Security benefits + excluded foreign income. Defined in IRC §36B(d)(2)(B).',
    seeAlso: ['aca', 'fpl', 'subsidy_cliff'],
  },
  {
    key: 'fpl',
    term: 'Federal Poverty Level',
    aliases: ['FPL', 'poverty line', 'poverty threshold'],
    plain:
      'A yearly income amount set by the US government, used as a benchmark for many income-based programs.',
    example:
      'For 2024, the poverty line in the lower 48 states is about $15,060 for one person and $20,440 for two.',
    technical:
      'HHS Poverty Guidelines, published annually in the Federal Register. Separate tables for the 48 contiguous states + DC, Alaska, and Hawaii. Household-size adjustment is $5,380 per additional person (2024).',
    seeAlso: ['magi', 'aca', 'subsidy_cliff'],
  },
  {
    key: 'subsidy_cliff',
    term: 'Subsidy Cliff',
    aliases: ['ACA cliff', '400% FPL cliff', 'income cutoff'],
    plain:
      'An income boundary where health-insurance help stops completely. Earning one dollar more than the cutoff can mean losing thousands in help.',
    example:
      'In 2026, a couple earning $81,761 gets no ACA help, while the same couple earning $81,759 may get thousands in premium tax credits.',
    technical:
      'Under pre-ARPA rules, ACA premium tax credits phase out fully at 400% of FPL. The enhanced rules from the 2021 American Rescue Plan removed the cliff and capped premiums at 8.5% of MAGI; those enhanced rules expired Dec 31 2025.',
    seeAlso: ['aca', 'fpl', 'applicable_percentage'],
  },
  {
    key: 'applicable_percentage',
    term: 'Applicable Percentage',
    aliases: ['premium cap', 'expected contribution'],
    plain:
      'The share of your income you are expected to pay for health insurance before ACA help kicks in.',
    example:
      'At 250% of the poverty line under cliff rules, your cap is about 6.5% of income. A $70,000 earner would pay about $4,550 per year; ACA help covers any premium above that.',
    technical:
      'Under cliff (pre-ARPA) rules the sliding scale runs 2.07% (at 100% FPL) up to 9.83% (at 400% FPL). Under enhanced (ARPA/IRA 2021–2025) rules the scale is 0% (≤150% FPL) up to 8.5% flat above 400% FPL.',
    seeAlso: ['aca', 'subsidy_cliff', 'magi'],
  },
];

export default async function glossaryRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/glossary — all terms.
   * GET /api/glossary?key=safe_withdrawal_rate — single term.
   * Public, cache-friendly; no auth required.
   */
  app.get('/', async (request, reply) => {
    const query = request.query as { key?: string } | undefined;
    reply.header('Cache-Control', 'public, max-age=3600');

    if (query?.key) {
      const entry = GLOSSARY.find((g) => g.key === query.key);
      if (!entry) {
        return reply.code(404).send({
          error: 'Term not found',
          field: 'key',
          fieldLabel: 'Glossary term key',
          message: `No glossary entry for key "${query.key}". Call /api/glossary with no parameters to list all terms.`,
        });
      }
      return entry;
    }

    return { terms: GLOSSARY, count: GLOSSARY.length };
  });
}
