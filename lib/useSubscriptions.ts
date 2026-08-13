import { CATEGORY_COLORS, SubscriptionFormValues } from '@/lib/subscriptionTypes';
import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { DEFAULT_CURRENCY } from '@/lib/currency';
import { cancelAllRemindersFor } from '@/lib/notifications';
import { useConvexQueryGate } from '@/lib/useConvexQueryGate';
import { useMutation, useQuery } from 'convex/react';
import dayjs from 'dayjs';
import { useMemo } from 'react';

export const DEFAULT_TRIAL_DAYS = 7;

function nextRenewalDate(frequency: SubscriptionFormValues['frequency'], from = dayjs()) {
    return frequency === 'Monthly' ? from.add(1, 'month') : from.add(1, 'year');
}

function mapSubscription(doc: Doc<'subscriptions'>): Subscription {
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
        isTrial: doc.isTrial,
        trialEndsAt: doc.trialEndsAt,
        householdSize: doc.householdSize,
        reminderDaysBefore: doc.reminderDaysBefore,
        usageCount: doc.usageCount,
        usageSince: doc.usageSince,
        priceHistory: doc.priceHistory,
    };
}

export function useSubscription(id: string | undefined) {
    const { canQuery, isAuthResolving } = useConvexQueryGate();

    const doc = useQuery(
        api.subscriptions.get,
        canQuery && id ? { id: id as Id<'subscriptions'> } : 'skip',
    );

    const subscription = useMemo(() => (doc ? mapSubscription(doc) : null), [doc]);
    const isLoading = Boolean(id) && (isAuthResolving || (canQuery && doc === undefined));

    return { subscription, isLoading };
}

export function useSubscriptions() {
    const { canQuery, isAuthResolving } = useConvexQueryGate();

    // A live subscription: every mutation below re-pushes to all consumers, so the
    // Home, Subscriptions, Insights and detail screens can never drift out of sync.
    const docs = useQuery(api.subscriptions.list, canQuery ? {} : 'skip');

    const subscriptions = useMemo(() => (docs ?? []).map(mapSubscription), [docs]);
    const isLoading = isAuthResolving || (canQuery && docs === undefined);

    const createMutation = useMutation(api.subscriptions.create);
    const updateMutation = useMutation(api.subscriptions.update);
    const setStatusMutation = useMutation(api.subscriptions.setStatus);
    const endTrialMutation = useMutation(api.subscriptions.endTrial);
    const removeMutation = useMutation(api.subscriptions.remove);
    const logUsageMutation = useMutation(api.subscriptions.logUsage);
    const resetUsageMutation = useMutation(api.subscriptions.resetUsage);

    const assertAuthenticated = () => {
        if (!canQuery) {
            throw new Error(
                'Please wait for your secure data connection before managing subscriptions.',
            );
        }
    };

    const createSubscription = async (values: SubscriptionFormValues) => {
        assertAuthenticated();
        const now = dayjs();
        // A trial's first charge lands the day it ends, so that date is the renewal.
        const trialEnd = values.isTrial
            ? now.add(values.trialDays ?? DEFAULT_TRIAL_DAYS, 'day')
            : null;

        return await createMutation({
            name: values.name,
            price: values.price,
            currency: values.currency ?? DEFAULT_CURRENCY,
            billing: values.frequency,
            category: values.category,
            // Only CSV import sets this, so a cancelled or paused subscription can be
            // restored as it was rather than coming back active and inflating spend.
            status: values.status ?? 'active',
            startDate: now.toISOString(),
            renewalDate: (trialEnd ?? nextRenewalDate(values.frequency, now)).toISOString(),
            color: CATEGORY_COLORS[values.category],
            isTrial: Boolean(trialEnd),
            trialEndsAt: trialEnd?.toISOString(),
            householdSize: values.householdSize ?? 1,
            paymentMethod: values.paymentMethod,
        });
    };

    const updateSubscription = async (id: string, values: SubscriptionFormValues) => {
        assertAuthenticated();
        const existing = subscriptions.find((subscription) => subscription.id === id);
        const wasTrial = Boolean(existing?.isTrial && existing.trialEndsAt);
        const wantsTrial = Boolean(values.isTrial);

        // Only recompute trial dates on an actual transition — editing the price of a
        // running trial must not silently restart its countdown.
        let trialFields: { isTrial: boolean; trialEndsAt?: string; renewalDate?: string } = {
            isTrial: wantsTrial,
        };
        if (wantsTrial && !wasTrial) {
            const trialEnd = dayjs().add(values.trialDays ?? DEFAULT_TRIAL_DAYS, 'day');
            trialFields = {
                isTrial: true,
                trialEndsAt: trialEnd.toISOString(),
                renewalDate: trialEnd.toISOString(),
            };
        } else if (!wantsTrial && wasTrial) {
            trialFields = {
                isTrial: false,
                renewalDate: nextRenewalDate(values.frequency).toISOString(),
            };
        }

        return await updateMutation({
            id: id as Id<'subscriptions'>,
            name: values.name,
            price: values.price,
            billing: values.frequency,
            category: values.category,
            currency: values.currency ?? existing?.currency ?? DEFAULT_CURRENCY,
            color: CATEGORY_COLORS[values.category],
            householdSize: values.householdSize ?? 1,
            paymentMethod: values.paymentMethod ?? '',
            ...trialFields,
        });
    };

    /** Converts a running trial into a paid subscription starting one full cycle from now. */
    const endTrial = async (id: string, frequency: SubscriptionFormValues['frequency']) => {
        assertAuthenticated();
        return await endTrialMutation({
            id: id as Id<'subscriptions'>,
            renewalDate: nextRenewalDate(frequency).toISOString(),
        });
    };

    /** Records one use. Pass -1 to undo a mis-tap. */
    const logUsage = async (id: string, delta: 1 | -1 = 1) => {
        assertAuthenticated();
        return await logUsageMutation({ id: id as Id<'subscriptions'>, delta });
    };

    const resetUsage = async (id: string) => {
        assertAuthenticated();
        return await resetUsageMutation({ id: id as Id<'subscriptions'> });
    };

    const setSubscriptionStatus = async (id: string, status: 'active' | 'paused' | 'cancelled') => {
        assertAuthenticated();
        // Paused and cancelled subscriptions must stop nagging immediately.
        if (status !== 'active') await cancelAllRemindersFor(id);
        return await setStatusMutation({ id: id as Id<'subscriptions'>, status });
    };

    const deleteSubscription = async (id: string) => {
        assertAuthenticated();
        await cancelAllRemindersFor(id);
        return await removeMutation({ id: id as Id<'subscriptions'> });
    };

    /**
     * Adds many subscriptions in one go, for CSV import. Runs sequentially rather than
     * with Promise.all so a mid-import failure leaves a knowable number written rather
     * than an arbitrary interleaving, and reports exactly which rows failed.
     */
    const importSubscriptions = async (rows: SubscriptionFormValues[]) => {
        assertAuthenticated();
        const failed: { name: string; reason: string }[] = [];
        let imported = 0;

        for (const row of rows) {
            try {
                await createSubscription(row);
                imported += 1;
            } catch (error) {
                failed.push({
                    name: row.name,
                    reason: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return { imported, failed };
    };

    return {
        subscriptions,
        isLoading,
        createSubscription,
        importSubscriptions,
        updateSubscription,
        endTrial,
        logUsage,
        resetUsage,
        setSubscriptionStatus,
        deleteSubscription,
    };
}
