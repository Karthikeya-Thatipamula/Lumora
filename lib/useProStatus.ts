import {
    getPurchasesReady,
    hasProEntitlement,
    isPurchasesConfigured,
    subscribeToPurchasesReady,
} from '@/lib/purchases';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';

/**
 * Whether the signed-in user has the Pro entitlement.
 *
 * This hook mounts in tab screens, and React runs child effects before parent ones — so
 * it used to call `getCustomerInfo()` before the root layout had configured RevenueCat.
 * The rejection was swallowed, `isPro` was never set, and because the dependency array
 * was empty the effect never retried: a paying user saw the paywall and locked ProGates
 * for the entire session, not just at cold start.
 *
 * Waiting on the readiness signal fixes the ordering without depending on where in the
 * tree this happens to be called from.
 */
export function useProStatus() {
    const isReady = useSyncExternalStore(
        subscribeToPurchasesReady,
        getPurchasesReady,
        // Nothing is configured during a web prerender.
        () => false,
    );

    const [isPro, setIsPro] = useState(false);
    const [isLoading, setIsLoading] = useState(isPurchasesConfigured);

    useEffect(() => {
        if (!isPurchasesConfigured) {
            setIsLoading(false);
            return;
        }

        // Keep the spinner up until the SDK is usable rather than reporting "not Pro".
        if (!isReady) return;

        let isMounted = true;
        const applyCustomerInfo = (info: CustomerInfo) => {
            if (!isMounted) return;
            setIsPro(hasProEntitlement(info));
            setIsLoading(false);
        };

        Purchases.getCustomerInfo()
            .then(applyCustomerInfo)
            .catch(() => isMounted && setIsLoading(false));
        Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);

        return () => {
            isMounted = false;
            Purchases.removeCustomerInfoUpdateListener(applyCustomerInfo);
        };
    }, [isReady]);

    return { isPro, isLoading };
}
