import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';

export const PRO_ENTITLEMENT_ID = 'pro';
export const FREE_SUBSCRIPTION_LIMIT = 5;

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
export const isPurchasesPreviewMode = isExpoGo && !testStoreApiKey;

let hasConfigured = false;

/** Call once per app session, as soon as the signed-in Clerk user id is known. */
export function configurePurchases(appUserID: string) {
    if (hasConfigured || !isPurchasesConfigured || !apiKey) return;

    try {
        Purchases.configure({ apiKey, appUserID });
        hasConfigured = true;
    } catch (error) {
        console.warn('Purchases configuration skipped:', error instanceof Error ? error.message : error);
    }
}

export function hasProEntitlement(info: CustomerInfo): boolean {
    return typeof info.entitlements.active[PRO_ENTITLEMENT_ID] !== 'undefined';
}
