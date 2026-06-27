import SubscriptionCard from "@/components/SubscriptionCard";
import { useSubscriptionStore } from "@/lib/subscriptionStore";
import { styled } from "nativewind";
import { usePostHog } from 'posthog-react-native';
import { useEffect, useState } from "react";
import { FlatList, Text, TextInput, View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

const SafeAreaView = styled(RNSafeAreaView);

const Subscriptions = () => {
    const posthog = usePostHog();
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const { subscriptions } = useSubscriptionStore();

    useEffect(() => {
        posthog.capture('subscriptions_screen_viewed', {
            total_subscriptions: subscriptions.length,
            timestamp: new Date().toISOString(),
        });
        console.info('[Analytics] Subscriptions screen viewed');
    }, []);

    useEffect(() => {
        if (searchQuery.trim()) {
            posthog.capture('subscriptions_searched', {
                search_query: searchQuery,
                result_count: filteredSubscriptions.length,
                timestamp: new Date().toISOString(),
            });
        }
    }, [searchQuery]);

    const filteredSubscriptions = subscriptions.filter((subscription) =>
        subscription.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subscription.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        subscription.plan?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSubscriptionPress = (id: string) => {
        const isExpanding = expandedId !== id;
        setExpandedId(expandedId === id ? null : id);
        
        const subscription = subscriptions.find(s => s.id === id);
        posthog.capture(isExpanding ? 'subscription_expanded' : 'subscription_collapsed', {
            subscription_id: id,
            subscription_name: subscription?.name,
            source: 'subscriptions_screen',
            timestamp: new Date().toISOString(),
        });
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <FlatList
                data={filteredSubscriptions}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                    <View className="px-5 pt-5">
                        <Text className="text-3xl font-sans-bold text-primary mb-5">Subscriptions</Text>
                        <TextInput
                            className="bg-card rounded-xl px-4 py-3 text-dark mb-4"
                            placeholder="Search subscriptions..."
                            placeholderTextColor="#666"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                }
                renderItem={({ item }) => (
                    <SubscriptionCard
                        {...item}
                        expanded={expandedId === item.id}
                        onPress={() => handleSubscriptionPress(item.id)}
                    />
                )}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListEmptyComponent={<Text className="text-center text-muted-foreground mt-10">No subscriptions found</Text>}
            />
        </SafeAreaView>
    )
}
export default Subscriptions