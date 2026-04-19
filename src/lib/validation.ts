import type { ZodError, ZodIssue, ZodSchema } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Transform a Zod error into a user-friendly validation envelope.
 *
 * Addresses:
 *   - Dyslexia audit F-002 (human-readable field labels alongside camelCase paths)
 *   - Dyslexia audit F-007 (strip raw Zod internals from client-bound payload)
 *   - Dyscalculia audit F-008 (plain-language paraphrase of field names)
 *
 * Returned shape (stable, documented):
 * ```
 * {
 *   error: "Validation failed",
 *   details: [
 *     {
 *       field:       "portfolioBalance",   // camelCase JS property path (a.b.c joined)
 *       fieldLabel:  "Portfolio balance",  // plain-language label for UI display
 *       message:     "Please enter a value of at least 0.",
 *       code:        "too_small"            // zod code, useful for i18n on the client
 *     }
 *   ]
 * }
 * ```
 *
 * Maintainers: add to `FIELD_LABELS` when introducing a new field. Missing
 * entries fall back to a Title-Cased split of the camelCase path — readable
 * but not paraphrased.
 */

const FIELD_LABELS: Record<string, string> = {
  // financial.ts
  portfolioBalance: 'Portfolio balance',
  equityPct: 'Share of portfolio in stocks',
  bondPct: 'Share of portfolio in bonds',
  cashPct: 'Share of portfolio in cash',
  intlPct: 'Share in international stocks',
  expectedReturn: 'Expected yearly return',
  expectedInflation: 'Expected yearly inflation',
  fxDriftAnnualRate: 'Yearly currency drift',
  fxDriftEnabled: 'Apply currency drift',
  savingsRate: 'Share of income saved',
  targetAnnualIncome: 'Target yearly retirement income',
  targetRetirementAge: 'Target retirement age',
  // Dyslexia F-013 — Social Security + per-account labels
  ssCola: 'Social Security cost-of-living adjustment',
  ssCutYear: 'Year Social Security benefits are cut',
  ssCutEnabled: 'Apply Social Security cut scenario',
  ssExempt: 'Exempt Social Security from state tax',
  traditionalBalance: 'Traditional account balance',
  rothBalance: 'Roth account balance',
  taxableBalance: 'Taxable account balance',
  hsaBalance: 'HSA account balance',
  traditionalLoadPct: 'Traditional account sales load',
  rothLoadPct: 'Roth account sales load',
  taxableLoadPct: 'Taxable account sales load',
  hsaLoadPct: 'HSA account sales load',
  traditionalFeesPct: 'Traditional account yearly fees',
  rothFeesPct: 'Roth account yearly fees',
  taxableFeesPct: 'Taxable account yearly fees',
  hsaFeesPct: 'HSA account yearly fees',
  retirementPath: 'Retirement path',
  fireTargetAge: 'FIRE target age',
  annualSavings: 'Yearly savings amount',

  // fees.ts
  brokerageFeePct: 'Advisor or brokerage fee',
  brokerageExpenseRatio: 'Fund expense ratio',
  fxSpreadPct: 'Currency exchange spread',
  transferFeeFixed: 'Fixed transfer fee',

  // withdrawal.ts
  strategyType: 'Withdrawal strategy',
  withdrawalRate: 'Withdrawal rate',
  ceilingRate: 'Ceiling withdrawal rate',
  floorRate: 'Floor withdrawal rate',
  adjustmentPct: 'Guardrails adjustment',
  bucket1Years: 'Short-term bucket size (years)',
  bucket2Years: 'Medium-term bucket size (years)',
  refillThreshold: 'Bucket refill threshold',
  essentialSpending: 'Essential yearly spending',
  discretionaryBudget: 'Discretionary yearly spending',
  maxDiscretionaryRate: 'Maximum discretionary rate',
  spendingModel: 'Spending model',
  declineRate: 'Spending decline rate',
  rothConversionEnabled: 'Roth conversions on',
  rothConversionAmount: 'Yearly Roth conversion amount',
  rothConversionEndAge: 'Age Roth conversions end',

  // common
  email: 'Email address',
  displayName: 'Display name',
  locale: 'Language / region',
  currency: 'Currency',
};

function titleCaseFromCamel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function fieldPath(issue: ZodIssue): string {
  return issue.path.map((p) => String(p)).join('.');
}

function labelFor(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  // If nested, label only the last segment by default.
  const leaf = field.split('.').pop() ?? field;
  return FIELD_LABELS[leaf] ?? titleCaseFromCamel(leaf);
}

/**
 * Rewrite a Zod issue's message into plain language where the default
 * message is too technical. Keeps unchanged messages verbatim.
 */
function plainMessage(issue: ZodIssue, label: string): string {
  const raw = issue.message || '';

  switch (issue.code) {
    case 'invalid_type':
      return `${label} expects a ${issue.expected}. You sent ${issue.received}.`;
    case 'too_small': {
      const min = (issue as { minimum?: number | bigint }).minimum;
      if (typeof min === 'number' || typeof min === 'bigint') {
        return `${label} must be at least ${min}.`;
      }
      return raw || `${label} is below the allowed minimum.`;
    }
    case 'too_big': {
      const max = (issue as { maximum?: number | bigint }).maximum;
      if (typeof max === 'number' || typeof max === 'bigint') {
        return `${label} must be at most ${max}.`;
      }
      return raw || `${label} is above the allowed maximum.`;
    }
    case 'invalid_enum_value': {
      const opts = (issue as { options?: readonly unknown[] }).options;
      if (Array.isArray(opts) && opts.length) {
        return `${label} must be one of: ${opts.join(', ')}.`;
      }
      return raw;
    }
    case 'invalid_string':
      return raw || `${label} has an invalid format.`;
    case 'unrecognized_keys':
      return `Unexpected field(s) in the request body.`;
    default:
      return raw || `${label} is invalid.`;
  }
}

export interface ValidationIssue {
  field: string;
  fieldLabel: string;
  message: string;
  code: string;
}

export interface ValidationErrorPayload {
  error: 'Validation failed';
  details: ValidationIssue[];
}

/**
 * Convert a Zod error (or Fastify `error.validation` array) into the stable
 * client-bound envelope. Raw Zod internals are kept server-side only.
 */
export function toValidationErrorPayload(
  error: ZodError | { issues: ZodIssue[] } | ZodIssue[],
): ValidationErrorPayload {
  const issues: ZodIssue[] = Array.isArray(error)
    ? error
    : 'issues' in error
      ? error.issues
      : [];

  const details: ValidationIssue[] = issues.map((issue) => {
    const field = fieldPath(issue) || '(root)';
    const fieldLabel = labelFor(field);
    return {
      field,
      fieldLabel,
      message: plainMessage(issue, fieldLabel),
      code: issue.code,
    };
  });

  return { error: 'Validation failed', details };
}

/**
 * Return the `{ fieldName: label }` map for the given field names.
 * Used by GET handlers to ship a `_labels` sibling alongside success responses
 * so frontends don't need to duplicate the mapping (Dyslexia F-013).
 */
export function getLabelsFor(fields: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (FIELD_LABELS[f]) out[f] = FIELD_LABELS[f];
    else out[f] = titleCaseFromCamel(f);
  }
  return out;
}

/**
 * Parse `request.body` through a Zod schema. On failure, send a 400 with the
 * plain-language envelope and return `null`. On success, return the parsed
 * data so callers can narrow types.
 *
 * Dashboard Dyslexia F-007 / F-011 — eliminates the 16 `details: parsed.error.issues`
 * call sites that bypassed `toValidationErrorPayload`.
 *
 * Usage:
 *   const data = validateBody(schema, request, reply);
 *   if (!data) return;           // reply already sent
 *   // use `data`
 */
export function validateBody<T>(
  schema: ZodSchema<T>,
  request: FastifyRequest,
  reply: FastifyReply,
): T | null {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400).send(toValidationErrorPayload(parsed.error));
    return null;
  }
  return parsed.data;
}
