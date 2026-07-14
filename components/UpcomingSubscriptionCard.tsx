import {View, Text} from 'react-native'
import React from 'react'
import {formatCurrency} from "@/lib/utils";
import SubscriptionAvatar from "@/components/SubscriptionAvatar";

const UpcomingSubscriptionCard = ({ name, price, daysLeft, iconKey, currency }: UpcomingSubscription) => {
    return (
        <View className="upcoming-card">
            <View className="upcoming-row">
                <SubscriptionAvatar name={name} iconKey={iconKey} className="upcoming-icon rounded-lg" />
                <View>
                    <Text className="upcoming-price">{formatCurrency(price, currency)}</Text>
                    <Text className="upcoming-meta" numberOfLines={1}>
                        {daysLeft > 1 ? `${daysLeft} days left` : 'Last day'}
                    </Text>
                </View>
            </View>

            <Text className="upcoming-name" numberOfLines={1}>{name}</Text>
        </View>
    )
}
export default UpcomingSubscriptionCard