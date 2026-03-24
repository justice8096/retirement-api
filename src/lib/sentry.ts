/**
 * Sentry error monitoring integration.
 *
 * Initializes Sentry when SENTRY_DSN is set. Otherwise, provides no-op
 * wrappers so the rest of the code doesn't need to check.
 *
 * Usage in .env:
 *   SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
 */

let sentryModule: typeof import('@sentry/node') | null = null;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('[sentry] SENTRY_DSN not set — error monitoring disabled');
    return;
  }

  try {
    sentryModule = await import('@sentry/node');
    sentryModule.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.npm_package_version || '0.1.0',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      // Don't send PII (user emails, IPs) by default
      sendDefaultPii: false,
    });
    console.log('[sentry] Initialized error monitoring');
  } catch (err) {
    console.warn('[sentry] Failed to initialize:', (err as Error).message);
  }
}

/**
 * Capture an exception to Sentry (no-op if not initialized).
 */
export function captureException(error: unknown, context: Record<string, unknown> = {}): void {
  if (sentryModule) {
    sentryModule.captureException(error, { extra: context });
  }
}

/**
 * Capture a message to Sentry (no-op if not initialized).
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (sentryModule) {
    sentryModule.captureMessage(message, level);
  }
}

/**
 * Set user context for Sentry (called after auth).
 */
export function setUser(user: { id: string } | null): void {
  if (sentryModule) {
    sentryModule.setUser(user ? { id: user.id } : null);
  }
}
