import type { Subscription } from '@/lib/subscriptionTypes';
import { DISCOVERY_GROUPS, DiscoveryGroup, SUBSCRIPTION_CATALOG } from '@/constants/catalog';

export interface DiscoveryCoverage {
    coveredGroups: string[];
    missingGroups: DiscoveryGroup[];
    /** 0–100. How much of the common-subscription surface the user has accounted for. */
    percentage: number;
}

/** Text a group's signals are matched against — name, category and plan together. */
function haystackFor(sub: Subscription): string {
    return [sub.name, sub.category, sub.plan].filter(Boolean).join(' ').toLowerCase();
}

function isCovered(group: DiscoveryGroup, haystacks: string[]): boolean {
    return haystacks.some((haystack) => group.signals.some((signal) => haystack.includes(signal)));
}

/**
 * Works out which common subscription categories the user has nothing tracked in.
 *
 * Cancelled entries still count as covered: the user clearly knows about that service,
 * so re-prompting for it would be noise rather than a discovery.
 */
export function getDiscoveryCoverage(subscriptions: Subscription[]): DiscoveryCoverage {
    const haystacks = subscriptions.map(haystackFor);

    const coveredGroups: string[] = [];
    const missingGroups: DiscoveryGroup[] = [];

    for (const group of DISCOVERY_GROUPS) {
        if (isCovered(group, haystacks)) coveredGroups.push(group.id);
        else missingGroups.push(group);
    }

    return {
        coveredGroups,
        missingGroups,
        percentage: Math.round((coveredGroups.length / DISCOVERY_GROUPS.length) * 100),
    };
}

export interface DiscoveryPrompt {
    group: DiscoveryGroup;
    /** Catalog entries from this area that aren't tracked yet, for one-tap adding. */
    quickAdds: typeof SUBSCRIPTION_CATALOG;
}

/** The next few gaps worth asking about, most universal first. */
export function getDiscoveryPrompts(subscriptions: Subscription[], limit = 3): DiscoveryPrompt[] {
    const { missingGroups } = getDiscoveryCoverage(subscriptions);
    const tracked = new Set(subscriptions.map((sub) => sub.name.trim().toLowerCase()));

    return missingGroups.slice(0, limit).map((group) => ({
        group,
        quickAdds: SUBSCRIPTION_CATALOG.filter(
            (entry) =>
                !tracked.has(entry.name.toLowerCase()) &&
                group.signals.some((signal) => entry.name.toLowerCase().includes(signal)),
        ),
    }));
}

/**
 * Where to go to cancel a service. Lumora never cancels anything itself — it points at
 * the provider's own page, which is the honest limit of a tracker that holds no account
 * access. Returns null when we don't have a verified link rather than guessing a URL.
 */
export function getCancellationUrl(subscriptionName: string): string | null {
    const needle = subscriptionName.trim().toLowerCase();
    if (!needle) return null;

    const match = SUBSCRIPTION_CATALOG.find(
        (entry) => entry.name.toLowerCase() === needle || needle.includes(entry.name.toLowerCase()),
    );

    return match?.cancelUrl ?? null;
}
