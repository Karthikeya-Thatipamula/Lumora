import { hasProEntitlement, isPurchasesConfigured } from '@/lib/purchases';
import { useEffect, useState } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';

export function useProStatus() {
    const [isPro, setIsPro] = useState(false);
    const [isLoading, setIsLoading] = useState(isPurchasesConfigured);

    useEffect(() => {
        if (!isPurchasesConfigured) {
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        const applyCustomerInfo = (info: CustomerInfo) => {
            if (!isMounted) return;
            setIsPro(hasProEntitlement(info));
            setIsLoading(false);
        };

        Purchases.getCustomerInfo().then(applyCustomerInfo).catch(() => isMounted && setIsLoading(false));
        Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);

        return () => {
            isMounted = false;
            Purchases.removeCustomerInfoUpdateListener(applyCustomerInfo);
        };
    }, []);

    return { isPro, isLoading };
}
