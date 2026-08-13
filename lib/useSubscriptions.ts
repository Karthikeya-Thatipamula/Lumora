import {
    CATEGORY_COLORS,
    type Frequency,
    type Subscription,
    type SubscriptionFormValues,
    type SubscriptionStatus,
} from '@/lib/subscriptionTypes';
import { api } from '@/convex/_generated/api';
import { MAX_IMPORT_BATCH } from '@/convex/limits';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { DEFAULT_CURRENCY } from '@/lib/currency';
import { cancelAllRemindersFor } from '@/lib/notifications';
import { useConvexQueryGate } from '@/lib/useConvexQueryGate';
import { useMutation, useQuery } from 'convex/react';
import dayjs from 'dayjs';
import { useMemo } from 'react';

export const DEFAULT_TRIAL_DAYS = 7;

/**
 * An exhaustive switch with no `default`, deliberately.
 *
 * This was `frequency === 'Monthly' ? +1 month : +1 year`, so every value that was not
 * exactly the string "Monthly" — including "monthly" — silently billed annually. Now that
 * `Frequency` is a literal union, adding a cycle here fails to compile rather than
 * quietly picking a wrong answer.
 */
function nextRenewalDate(frequency: Frequency, from = dayjs()) {
    switch (frequency) {
        case 'Monthly':
            return from.add(1, 'month');
        case 'Yearly':
            return from.add(1, 'year');
    }
}

/**
 * Swaps Convex's bookkeeping fields for a plain `id`.
 *
 * This used to copy all twenty-two fields by hand, which made it a drift vector in its
 * own right: a new schema field silently failed to reach the client until someone
 * remembered to add a line here. Now that `Subscription` is derived from
 * `Doc<'subscriptions'>`, the rest passes through and the compiler enforces the shape.
 */
function mapSubscription({
    _id,
    _creationTime,
    userId,
    ...rest
}: Doc<'subscriptions'>): Subscription {
    return { id: _id, ...rest };
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
    const createManyMutation = useMutation(api.subscriptions.createMany);
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

    const setSubscriptionStatus = async (id: string, status: SubscriptionStatus) => {
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
     * Adds many subscriptions in one go, for CSV import.
     *
     * One mutation per chunk rather than one per row. The old loop called `create`
     * individually, which re-probed the user's whole table every iteration and — more
     * importantly — never checked the free-plan limit, so this was the path around the
     * paywall. The server now decides how many rows fit and reports the rest.
     */
    const importSubscriptions = async (rows: SubscriptionFormValues[]) => {
        assertAuthenticated();

        const failed: { name: string; reason: string }[] = [];
        let imported = 0;
        let rejectedForLimit = 0;
        let limit: number | null = null;

        for (let start = 0; start < rows.length; start += MAX_IMPORT_BATCH) {
            const chunk = rows.slice(start, start + MAX_IMPORT_BATCH);
            const now = dayjs();

            try {
                const result = await createManyMutation({
                    rows: chunk.map((row) => {
                        const trialEnd = row.isTrial
                            ? now.add(row.trialDays ?? DEFAULT_TRIAL_DAYS, 'day')
                            : null;
                        return {
                            name: row.name,
                            price: row.price,
                            billing: row.frequency,
                            status: row.status ?? 'active',
                            category: row.category,
                            currency: row.currency ?? DEFAULT_CURRENCY,
                            paymentMethod: row.paymentMethod,
                            color: CATEGORY_COLORS[row.category],
                            startDate: now.toISOString(),
                            renewalDate: (
                                trialEnd ?? nextRenewalDate(row.frequency, now)
                            ).toISOString(),
                            householdSize: row.householdSize ?? 1,
                        };
                    }),
                });

                imported += result.imported;
                failed.push(...result.failed);
                rejectedForLimit += result.rejectedForLimit;
                limit = result.limit;
            } catch (error) {
                // A whole chunk failing is a transport or auth problem, not a bad row.
                const reason = error instanceof Error ? error.message : 'Unknown error';
                failed.push(...chunk.map((row) => ({ name: row.name, reason })));
            }
        }

        return { imported, failed, rejectedForLimit, limit };
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
