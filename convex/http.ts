import { httpRouter } from 'convex/server';
import { internal } from './_generated/api';
import { httpAction } from './_generated/server';
import { isEntitledAt, PRO_ENTITLEMENT_ID } from './limits';

/**
 * RevenueCat webhook.
 *
 * Configure in the RevenueCat dashboard under Integrations → Webhooks:
 *   URL:            https://<deployment>.convex.site/revenuecat/webhook
 *   Authorization:  the value of REVENUECAT_WEBHOOK_SECRET
 *
 * Two things about RevenueCat webhooks are easy to get wrong and expensive:
 *
 * 1. **They are not signed.** There is no HMAC to verify — the shared Authorization
 *    header is the entire security boundary. Make it long and random, and never log the
 *    request body, which contains the subscriber's purchase history.
 *
 * 2. **CANCELLATION does not mean "revoke access".** It means auto-renew was switched
 *    off; the user has paid through to `expiration_at_ms` and is still entitled until
 *    then. Revoking on the event type rather than the expiry would cut off a paying
 *    customer mid-period. Every decision below is made on the expiry timestamp.
 */

/** Anonymous ids belong to users who have not signed in; there is nothing to attach. */
function isRealAppUserId(id: unknown): id is string {
    return typeof id === 'string' && id.length > 0 && !id.startsWith('$RCAnonymousID:');
}

interface RevenueCatEvent {
    type?: string;
    app_user_id?: string;
    original_app_user_id?: string;
    transferred_from?: string[];
    transferred_to?: string[];
    product_id?: string;
    entitlement_ids?: string[] | null;
    expiration_at_ms?: number | null;
    store?: string;
    environment?: string;
    event_timestamp_ms?: number;
}

const http = httpRouter();

http.route({
    path: '/revenuecat/webhook',
    method: 'POST',
    handler: httpAction(async (ctx, request) => {
        const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
        if (!secret) {
            // Refuse rather than accept unauthenticated writes to entitlements.
            return new Response('Webhook not configured', { status: 503 });
        }

        if (request.headers.get('Authorization') !== secret) {
            return new Response('Unauthorized', { status: 401 });
        }

        let event: RevenueCatEvent;
        try {
            const body = (await request.json()) as { event?: RevenueCatEvent };
            event = body.event ?? {};
        } catch {
            return new Response('Malformed body', { status: 400 });
        }

        // A sandbox purchase must never grant production Pro: without this, any
        // TestFlight tester can hand themselves a paid plan.
        const isSandbox = event.environment === 'SANDBOX';
        const expectSandbox = process.env.REVENUECAT_ACCEPT_SANDBOX === 'true';
        if (isSandbox !== expectSandbox) {
            return new Response(null, { status: 200 });
        }

        // A transfer moves entitlements between accounts; the old one loses them.
        for (const previousUserId of event.transferred_from ?? []) {
            if (!isRealAppUserId(previousUserId)) continue;
            await ctx.runMutation(internal.entitlements.upsert, {
                userId: previousUserId,
                isPro: false,
                eventTimestampMs: event.event_timestamp_ms,
            });
        }

        const userId = event.app_user_id ?? event.original_app_user_id;
        if (!isRealAppUserId(userId)) {
            // Nothing to attach this to. 200 so RevenueCat stops retrying.
            return new Response(null, { status: 200 });
        }

        const grantsPro = (event.entitlement_ids ?? []).includes(PRO_ENTITLEMENT_ID);
        const expiresAt = event.expiration_at_ms ?? undefined;

        // The expiry decides, not the event type. See isEntitledAt.
        const isPro = isEntitledAt(grantsPro, expiresAt, Date.now());

        await ctx.runMutation(internal.entitlements.upsert, {
            userId,
            isPro,
            productId: event.product_id,
            expiresAt,
            store: event.store,
            environment: event.environment,
            eventTimestampMs: event.event_timestamp_ms,
        });

        // Always 200 on anything understood, including event types not handled above —
        // a non-2xx makes RevenueCat retry the same delivery for days.
        return new Response(null, { status: 200 });
    }),
});

export default http;
