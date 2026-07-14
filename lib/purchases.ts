import { Platform } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';

export const PRO_ENTITLEMENT_ID = 'pro';
export const FREE_SUBSCRIPTION_LIMIT = 5;

// Platform.select returns undefined on web/other platforms, so purchases stay
// unconfigured anywhere without a native store — never fall through to the
// wrong platform's key.
const apiKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

export const isPurchasesConfigured = Boolean(apiKey);

let hasConfigured = false;

/** Call once per app session, as soon as the signed-in Clerk user id is known. */
export function configurePurchases(appUserID: string) {
    if (hasConfigured || !isPurchasesConfigured || !apiKey) return;

    Purchases.configure({ apiKey, appUserID });
    hasConfigured = true;
}

export function hasProEntitlement(info: CustomerInfo): boolean {
    return typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
}
