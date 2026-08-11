import { formatCurrency } from '@/lib/utils';
import { Share } from 'react-native';

/** Where an invite was triggered from, so the funnel is measurable in PostHog. */
export type InviteSource = 'settings' | 'insights_savings' | 'wrapped';

export const LUMORA_INVITE_URL = 'https://lumora.app';

/**
 * Builds the invite copy. Leads with the user's own reclaimed savings when they have
 * some — a concrete number is a far stronger recommendation than a generic app pitch,
 * and it is the moment they actually feel like recommending it.
 */
export function buildInviteMessage(reclaimedYearly = 0, currency?: string): string {
    if (reclaimedYearly > 0) {
        return (
            `I've clawed back ${formatCurrency(reclaimedYearly, currency)} a year in forgotten subscriptions using Lumora. ` +
            `It tracks what you're paying for and warns you before free trials start charging.\n\n${LUMORA_INVITE_URL}`
        );
    }

    return (
        `Lumora keeps every subscription and free trial in one place, and warns you before ` +
        `anything renews. Worth a look if you've ever forgotten to cancel something.\n\n${LUMORA_INVITE_URL}`
    );
}

export type InviteResult = 'shared' | 'dismissed' | 'failed';

/**
 * Opens the OS share sheet. Uses React Native's text-sharing `Share` API rather than
 * expo-sharing, which only handles files.
 */
export async function shareLumora(reclaimedYearly = 0, currency?: string): Promise<InviteResult> {
    try {
        const result = await Share.share({
            message: buildInviteMessage(reclaimedYearly, currency),
            // Android puts the title on the chooser; iOS ignores it.
            title: 'Lumora — subscription tracker',
        });

        return result.action === Share.sharedAction ? 'shared' : 'dismissed';
    } catch (error) {
        console.error('Invite share failed:', error);
        return 'failed';
    }
}
