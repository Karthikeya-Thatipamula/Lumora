import { CATEGORY_COLORS, SubscriptionFormValues } from "@/components/CreateSubscriptionModal";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { logConvexQueryError } from "@/lib/convexErrors";
import { cancelReminder } from "@/lib/notifications";
import { useConvex, useMutation } from "convex/react";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";

function nextRenewalDate(frequency: SubscriptionFormValues["frequency"], from = dayjs()) {
    return frequency === "Monthly" ? from.add(1, "month") : from.add(1, "year");
}

function mapSubscription(doc: NonNullable<Awaited<ReturnType<ReturnType<typeof useConvex>["query"]>>>): Subscription {
    return {
        id: doc._id,
        name: doc.name,
        plan: doc.plan,
        category: doc.category,
        paymentMethod: doc.paymentMethod,
        status: doc.status,
        statusChangedAt: doc.statusChangedAt,
        startDate: doc.startDate,
        price: doc.price,
        currency: doc.currency,
        billing: doc.billing,
        renewalDate: doc.renewalDate,
        color: doc.color,
        iconKey: doc.iconKey,
        priceHistory: doc.priceHistory,
    };
}

export function useSubscription(id: string | undefined) {
    const convex = useConvex();
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [isLoading, setIsLoading] = useState(Boolean(id));

    useEffect(() => {
        let isMounted = true;

        if (!id) {
            setSubscription(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        convex
            .query(api.subscriptions.get, { id: id as Id<"subscriptions"> })
            .then((doc) => {
                if (!isMounted) return;
                setSubscription(doc ? mapSubscription(doc) : null);
            })
            .catch((error) => {
                if (!isMounted) return;
                logConvexQueryError('Load subscription', error);
                setSubscription(null);
            })
            .finally(() => isMounted && setIsLoading(false));

        return () => {
            isMounted = false;
        };
    }, [convex, id]);

    return { subscription, isLoading };
}

export function useSubscriptions() {
    const convex = useConvex();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshToken, setRefreshToken] = useState(0);
    const createMutation = useMutation(api.subscriptions.create);
    const updateMutation = useMutation(api.subscriptions.update);
    const setStatusMutation = useMutation(api.subscriptions.setStatus);
    const removeMutation = useMutation(api.subscriptions.remove);

    const refreshSubscriptions = useCallback(() => {
        setRefreshToken((token) => token + 1);
    }, []);

    useEffect(() => {
        let isMounted = true;

        setIsLoading(true);
        convex
            .query(api.subscriptions.list, {})
            .then((docs) => {
                if (!isMounted) return;
                setSubscriptions((docs ?? []).map(mapSubscription));
            })
            .catch((error) => {
                if (!isMounted) return;
                logConvexQueryError('Load subscriptions', error);
                setSubscriptions([]);
            })
            .finally(() => isMounted && setIsLoading(false));

        return () => {
            isMounted = false;
        };
    }, [convex, refreshToken]);

    const createSubscription = async (values: SubscriptionFormValues) => {
        const now = dayjs();
        const result = await createMutation({
            name: values.name,
            price: values.price,
            currency: "USD",
            billing: values.frequency,
            category: values.category,
            status: "active",
            startDate: now.toISOString(),
            renewalDate: nextRenewalDate(values.frequency, now).toISOString(),
            color: CATEGORY_COLORS[values.category],
        });
        refreshSubscriptions();
        return result;
    };

    const updateSubscription = async (id: string, values: SubscriptionFormValues) => {
        const result = await updateMutation({
            id: id as Id<"subscriptions">,
            name: values.name,
            price: values.price,
            billing: values.frequency,
            category: values.category,
            color: CATEGORY_COLORS[values.category],
        });
        refreshSubscriptions();
        return result;
    };

    const setSubscriptionStatus = async (id: string, status: "active" | "paused" | "cancelled") => {
        const result = await setStatusMutation({ id: id as Id<"subscriptions">, status });
        refreshSubscriptions();
        return result;
    };

    const deleteSubscription = async (id: string) => {
        await cancelReminder(id);
        const result = await removeMutation({ id: id as Id<"subscriptions"> });
        refreshSubscriptions();
        return result;
    };

    return {
        subscriptions,
        isLoading,
        createSubscription,
        updateSubscription,
        setSubscriptionStatus,
        deleteSubscription,
        refreshSubscriptions,
    };
}
