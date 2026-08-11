import { alertDialog } from '@/lib/dialogs';
import { shareLumora } from '@/lib/share';
import { formatCurrency } from '@/lib/utils';
import { usePostHog } from 'posthog-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

interface InviteCardProps {
    reclaimedYearly: number;
    currency?: string;
}

/**
 * Shown once the user has actually saved money. Asking for a recommendation at the
 * moment someone has a concrete number to quote converts far better than a permanent
 * "rate us" nag, and it costs nothing to run.
 */
const InviteCard = ({ reclaimedYearly, currency }: InviteCardProps) => {
    const posthog = usePostHog();
    const [isSharing, setIsSharing] = useState(false);

    const handleInvite = async () => {
        setIsSharing(true);
        try {
            const result = await shareLumora(reclaimedYearly, currency);
            posthog.capture('invite_shared', { result, source: 'insights_savings', reclaimed_yearly: reclaimedYearly });

            if (result === 'failed') {
                alertDialog('Couldn’t open sharing', 'Your device didn’t open the share sheet. Please try again.');
            }
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <View className="auth-card gap-3">
            <Text className="text-base font-sans-semibold text-primary">Know someone overpaying?</Text>
            <Text className="text-sm font-sans-medium text-muted-foreground">
                {reclaimedYearly > 0
                    ? `You've clawed back ${formatCurrency(reclaimedYearly, currency)} a year. Most people have at least one subscription they forgot about.`
                    : 'Most people are paying for at least one subscription they forgot about.'}
            </Text>
            <Pressable
                className="auth-secondary-button"
                onPress={handleInvite}
                disabled={isSharing}
                accessibilityRole="button"
                accessibilityLabel="Share Lumora with a friend"
            >
                <Text className="auth-secondary-button-text">{isSharing ? 'Opening…' : 'Share Lumora'}</Text>
            </Pressable>
        </View>
    );
};

export default InviteCard;
