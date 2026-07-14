import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface ProGateProps {
    isPro: boolean;
    title: string;
    description: string;
    children: ReactNode;
}

const ProGate = ({ isPro, title, description, children }: ProGateProps) => {
    const router = useRouter();

    if (isPro) return <>{children}</>;

    return (
        <Pressable className="auth-card items-center gap-3 py-8" onPress={() => router.push('/paywall')} accessibilityRole="button" accessibilityLabel={`Unlock ${title} with Pro`}>
            <Text style={{ fontSize: 28 }}>🔒</Text>
            <Text className="text-base font-sans-semibold text-primary">{title}</Text>
            <Text className="max-w-70 text-center text-sm font-sans-medium text-muted-foreground">{description}</Text>
            <View className="mt-1 rounded-full bg-accent px-5 py-2">
                <Text className="text-sm font-sans-bold text-primary">Unlock with Pro</Text>
            </View>
        </Pressable>
    );
};

export default ProGate;
