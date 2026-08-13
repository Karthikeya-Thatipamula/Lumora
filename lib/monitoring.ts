import * as Sentry from '@sentry/react-native';

/**
 * Crash and error reporting.
 *
 * RouteErrorBoundary already degrades gracefully when a render throws, but until now it
 * reported nothing — a crash in the wild left no trace at all.
 *
 * Everything here is a no-op without EXPO_PUBLIC_SENTRY_DSN, which is the normal state
 * for local development and for anyone who clones the repo. Reporting failures must
 * never become a second source of crashes, so every entry point is guarded.
 */

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** True once Sentry has a DSN and has been initialised. */
export const isMonitoringEnabled = Boolean(dsn);

export function initMonitoring() {
    if (!dsn) return;

    Sentry.init({
        dsn,
        // `APP_ENV` is set per build profile in eas.json; local dev has none.
        environment: process.env.APP_ENV ?? 'development',
        // Breadcrumbs and stack traces only. No session replay, no automatic PII: this
        // app holds people's finances, and none of it belongs in an error report.
        sendDefaultPii: false,
        // Traces are sampled rather than dropped entirely so slow screens stay
        // diagnosable, but at a rate that will not eat the quota on day one.
        tracesSampleRate: 0.1,
    });
}

/**
 * Ties a report to a user without sending anything identifying. The Clerk id is
 * already the join key used by PostHog, Convex and RevenueCat; email and name are
 * deliberately omitted.
 */
export function identifyForMonitoring(userId: string | undefined) {
    if (!isMonitoringEnabled) return;
    Sentry.setUser(userId ? { id: userId } : null);
}

/** Reports a caught error. Safe to call when monitoring is off. */
export function reportError(error: unknown, context?: Record<string, unknown>) {
    if (!isMonitoringEnabled) {
        // Without a DSN this is the only record that the error happened at all.
        console.error('[monitoring]', error, context ?? '');
        return;
    }

    Sentry.captureException(error, context ? { extra: context } : undefined);
}
