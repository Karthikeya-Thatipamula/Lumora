import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';

// Re-exported from the server so the limit exists exactly once. It used to be defined
// here, client-side only, which is what made it bypassable.
import { FREE_ACTIVE_SUBSCRIPTION_LIMIT, PRO_ENTITLEMENT_ID } from '@/convex/limits';

export { PRO_ENTITLEMENT_ID };
export const FREE_SUBSCRIPTION_LIMIT = FREE_ACTIVE_SUBSCRIPTION_LIMIT;

const isExpoGo = Constants.appOwnership === 'expo';

const nativeStoreApiKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});
const testStoreApiKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY;

// Expo Go cannot use App Store / Play Store RevenueCat keys because the native
// store modules are not available there. A RevenueCat Test Store key can still
// be provided for Expo Go previews; otherwise purchases intentionally no-op.
const apiKey = isExpoGo ? testStoreApiKey : nativeStoreApiKey;

export const isPurchasesConfigured = Boolean(apiKey);

let hasConfigured = false;

/**
 * `configure` runs once per JS session; the signed-in user is set separately with
 * `logIn`/`logOut`.
 *
 * This used to be a single `configure({ apiKey, appUserID })` behind a boolean latch,
 * which meant signing out and back in as a different user in the same session left
 * RevenueCat still identified as the *first* user — so user B saw user A's Pro
 * entitlement. Identity has to be a separate, repeatable call.
 */
function ensureConfigured(): boolean {
    if (!isPurchasesConfigured || !apiKey) return false;
    if (hasConfigured) return true;

    try {
        Purchases.configure({ apiKey });
        hasConfigured = true;
        notifyReady();
        return true;
    } catch (error) {
        console.warn(
            'Purchases configuration skipped:',
            error instanceof Error ? error.message : error,
        );
        return false;
    }
}

// `useProStatus` mounts in tab screens, whose effects React runs *before* the root
// layout's. Without a signal to wait on, it would call getCustomerInfo() before
// configure() had run, swallow the rejection, and leave a paying user on the free tier
// for the whole session because its effect never re-ran.
type ReadyListener = () => void;
const readyListeners = new Set<ReadyListener>();

function notifyReady() {
    for (const listener of readyListeners) listener();
}

/** Subscribe to the moment the SDK becomes usable. Returns an unsubscribe function. */
export function subscribeToPurchasesReady(listener: ReadyListener): () => void {
    readyListeners.add(listener);
    return () => {
        readyListeners.delete(listener);
    };
}

/** Whether the SDK has been configured and can be called. */
export function getPurchasesReady(): boolean {
    return hasConfigured;
}

/**
 * Points RevenueCat at the signed-in user. Call whenever the Clerk user id changes.
 *
 * The Clerk id is deliberately the RevenueCat `appUserID`: it is the same join key the
 * Convex documents, PostHog identity and Sentry user all use.
 */
export async function identifyPurchaseUser(appUserID: string): Promise<void> {
    if (!ensureConfigured()) return;

    try {
        await Purchases.logIn(appUserID);
    } catch (error) {
        console.warn('Purchases logIn failed:', error instanceof Error ? error.message : error);
    }
}

/**
 * Detaches the signed-out user, so the next sign-in starts from an anonymous id rather
 * than inheriting the previous user's entitlements.
 */
export async function resetPurchaseUser(): Promise<void> {
    if (!hasConfigured) return;

    try {
        await Purchases.logOut();
    } catch (error) {
        // logOut throws when already anonymous, which is a no-op rather than a problem.
        console.warn('Purchases logOut skipped:', error instanceof Error ? error.message : error);
    }
}

export function hasProEntitlement(info: CustomerInfo): boolean {
    return typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
}
