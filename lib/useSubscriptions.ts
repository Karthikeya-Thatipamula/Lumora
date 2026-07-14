import { CATEGORY_COLORS, SubscriptionFormValues } from "@/components/CreateSubscriptionModal";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cancelReminder } from "@/lib/notifications";
import { useMutation, useQuery } from "convex/react";
import dayjs from "dayjs";

function nextRenewalDate(frequency: SubscriptionFormValues["frequency"], from = dayjs()) {
    return frequency === "Monthly" ? from.add(1, "month") : from.add(1, "year");
}

export function useSubscription(id: string | undefined) {
    const doc = useQuery(api.subscriptions.get, id ? { id: id as Id<"subscriptions"> } : "skip");

    const subscription: Subscription | null = doc
        ? {
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
        }
        : null;

    return { subscription, isLoading: doc === undefined };
}

export function useSubscriptions() {
    const docs = useQuery(api.subscriptions.list);
    const createMutation = useMutation(api.subscriptions.create);
    const updateMutation = useMutation(api.subscriptions.update);
    const setStatusMutation = useMutation(api.subscriptions.setStatus);
    const removeMutation = useMutation(api.subscriptions.remove);

    const subscriptions: Subscription[] = (docs ?? []).map((doc) => ({
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
    }));

    const createSubscription = (values: SubscriptionFormValues) => {
        const now = dayjs();
        return createMutation({
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
    };

    const updateSubscription = (id: string, values: SubscriptionFormValues) => {
        return updateMutation({
            id: id as Id<"subscriptions">,
            name: values.name,
            price: values.price,
            billing: values.frequency,
            category: values.category,
            color: CATEGORY_COLORS[values.category],
        });
    };

    const setSubscriptionStatus = (id: string, status: "active" | "paused" | "cancelled") => {
        return setStatusMutation({ id: id as Id<"subscriptions">, status });
    };

    const deleteSubscription = async (id: string) => {
        await cancelReminder(id);
        return removeMutation({ id: id as Id<"subscriptions"> });
    };

    return {
        subscriptions,
        isLoading: docs === undefined,
        createSubscription,
        updateSubscription,
        setSubscriptionStatus,
        deleteSubscription,
    };
}
