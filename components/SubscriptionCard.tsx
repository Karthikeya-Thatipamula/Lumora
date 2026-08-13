import type { Subscription } from '@/lib/subscriptionTypes';
import { View, Text, Pressable } from 'react-native';
import React from 'react';
import { daysUntil } from '@/lib/dates';
import { formatCurrency, formatStatusLabel, formatSubscriptionDateTime } from '@/lib/utils';
import { clsx } from 'clsx';
import SubscriptionAvatar from '@/components/SubscriptionAvatar';

/**
 * Spreads the subscription's own fields rather than taking a single `subscription` prop,
 * which is how the callers already use it. A single-object prop would be a nicer shape
 * and better for the React Compiler, but that is a separate change.
 */
interface SubscriptionCardProps extends Omit<Subscription, 'id'> {
    expanded: boolean;
    onPress: () => void;
    onManagePress?: () => void;
    onDeletePress?: () => void;
}

const SubscriptionCard = ({
    name,
    price,
    currency,
    iconKey,
    billing,
    color,
    category,
    plan,
    renewalDate,
    expanded,
    onPress,
    onManagePress,
    onDeletePress,
    paymentMethod,
    startDate,
    status,
    isTrial,
    trialEndsAt,
    householdSize,
}: SubscriptionCardProps) => {
    const onTrial = Boolean(isTrial && trialEndsAt && status !== 'cancelled');
    const trialDaysLeft = onTrial ? (daysUntil(trialEndsAt) ?? 0) : 0;
    const splitWays = householdSize && householdSize > 1 ? householdSize : 0;
    const isCancelled = status === 'cancelled';

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`${name}, ${formatCurrency(splitWays ? price / splitWays : price, currency)} per ${billing}`}
            className={clsx(
                'sub-card',
                expanded && 'sub-card-expanded',
                isCancelled && 'opacity-60',
            )}
        >
            {/* The category colour reads as a spine rather than a fill. Filling the card
                with these light pastels left near-white dark-mode text unreadable on top. */}
            {color && <View className="sub-spine" style={{ backgroundColor: color }} />}

            <View className="sub-head">
                <View className="sub-main">
                    <SubscriptionAvatar name={name} iconKey={iconKey} className="sub-icon" />
                    <View className="sub-copy">
                        <Text numberOfLines={1} className="sub-title">
                            {name}
                        </Text>
                        <Text numberOfLines={1} ellipsizeMode="tail" className="sub-meta">
                            {category?.trim() ||
                                plan?.trim() ||
                                (renewalDate ? formatSubscriptionDateTime(renewalDate) : '')}
                        </Text>
                    </View>
                </View>

                <View className="sub-price-box">
                    <Text className="sub-price">
                        {formatCurrency(splitWays ? price / splitWays : price, currency)}
                    </Text>
                    <Text className="sub-billing" numberOfLines={1}>
                        {splitWays ? `${billing} · share` : billing}
                    </Text>
                </View>
            </View>

            {(onTrial || splitWays > 0 || isCancelled) && (
                <View className="mt-2 flex-row flex-wrap gap-2">
                    {onTrial && (
                        <View className="sub-badge sub-badge-accent">
                            <Text className="sub-badge-text-accent">
                                {trialDaysLeft === 0
                                    ? 'Trial ends today'
                                    : `Trial · ${trialDaysLeft}d left`}
                            </Text>
                        </View>
                    )}
                    {splitWays > 0 && (
                        <View className="sub-badge">
                            <Text className="sub-badge-text">
                                Split {splitWays} ways · {formatCurrency(price, currency)} total
                            </Text>
                        </View>
                    )}
                    {isCancelled && (
                        <View className="sub-badge">
                            <Text className="sub-badge-text">Cancelled</Text>
                        </View>
                    )}
                </View>
            )}

            {expanded && (
                <View className="sub-bdy">
                    <View className="sub-details">
                        <View className="sub-row">
                            <View className="sub-row-copy">
                                <Text className="sub-label">Payment:</Text>
                                <Text className="sub-value" numberOfLines={1} ellipsizeMode="tail">
                                    {paymentMethod?.trim() || 'Not provided'}
                                </Text>
                            </View>
                        </View>
                        <View className="sub-row">
                            <View className="sub-row-copy">
                                <Text className="sub-label">Category:</Text>
                                <Text className="sub-value" numberOfLines={1} ellipsizeMode="tail">
                                    {category?.trim() || plan?.trim() || 'Not provided'}
                                </Text>
                            </View>
                        </View>
                        <View className="sub-row">
                            <View className="sub-row-copy">
                                <Text className="sub-label">Started:</Text>
                                <Text className="sub-value" numberOfLines={1} ellipsizeMode="tail">
                                    {startDate
                                        ? formatSubscriptionDateTime(startDate)
                                        : 'Not provided'}
                                </Text>
                            </View>
                        </View>
                        <View className="sub-row">
                            <View className="sub-row-copy">
                                <Text className="sub-label">
                                    {onTrial ? 'First charge:' : 'Renewal date:'}
                                </Text>
                                <Text className="sub-value" numberOfLines={1} ellipsizeMode="tail">
                                    {renewalDate
                                        ? formatSubscriptionDateTime(renewalDate)
                                        : 'Not provided'}
                                </Text>
                            </View>
                        </View>
                        <View className="sub-row">
                            <View className="sub-row-copy">
                                <Text className="sub-label">Status:</Text>
                                <Text className="sub-value" numberOfLines={1} ellipsizeMode="tail">
                                    {onTrial
                                        ? 'Free trial'
                                        : status
                                          ? formatStatusLabel(status)
                                          : 'Not provided'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View className="flex-row gap-3">
                        {onManagePress && (
                            <Pressable
                                className="sub-cancel flex-1"
                                onPress={onManagePress}
                                accessibilityRole="button"
                                accessibilityLabel={`Manage ${name}`}
                            >
                                <Text className="sub-cancel-text">Manage</Text>
                            </Pressable>
                        )}
                        {onDeletePress && (
                            <Pressable
                                className="sub-delete"
                                onPress={onDeletePress}
                                accessibilityRole="button"
                                accessibilityLabel={`Delete ${name}`}
                            >
                                <Text className="sub-delete-text">Delete</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            )}
        </Pressable>
    );
};
export default SubscriptionCard;
