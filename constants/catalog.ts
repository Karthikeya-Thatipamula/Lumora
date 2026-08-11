import type { Category } from '@/lib/subscriptionTypes';
import type { IconKey } from '@/constants/icons';

export interface CatalogEntry {
    name: string;
    category: Category;
    /** Typical monthly list price in USD — a starting point the user edits, not a quote. */
    typicalMonthlyUsd: number;
    iconKey?: IconKey;
    /** Days of free trial the service commonly offers, when it offers one. */
    commonTrialDays?: number;
    /** Provider's own cancellation/manage page. Lumora only ever links out to it. */
    cancelUrl?: string;
}

/**
 * Prefills for the services people most often track. Manual entry is the single biggest
 * drop-off point in a subscription tracker — every field we can fill for the user is one
 * fewer reason to abandon setup.
 *
 * Prices are indicative US list prices and drift over time; they are presented as editable
 * defaults and never saved without the user confirming.
 */
export const SUBSCRIPTION_CATALOG: CatalogEntry[] = [
    {
        name: 'Netflix',
        category: 'Entertainment',
        typicalMonthlyUsd: 15.49,
        cancelUrl: 'https://www.netflix.com/cancelplan',
    },
    {
        name: 'Spotify',
        category: 'Entertainment',
        typicalMonthlyUsd: 11.99,
        iconKey: 'spotify',
        commonTrialDays: 30,
        cancelUrl: 'https://www.spotify.com/account/subscription/',
    },
    {
        name: 'YouTube Premium',
        category: 'Entertainment',
        typicalMonthlyUsd: 13.99,
        commonTrialDays: 30,
        cancelUrl: 'https://www.youtube.com/paid_memberships',
    },
    {
        name: 'Disney+',
        category: 'Entertainment',
        typicalMonthlyUsd: 9.99,
        cancelUrl: 'https://www.disneyplus.com/account/subscription',
    },
    {
        name: 'Amazon Prime',
        category: 'Entertainment',
        typicalMonthlyUsd: 14.99,
        commonTrialDays: 30,
        cancelUrl: 'https://www.amazon.com/gp/primecentral',
    },
    {
        name: 'Apple TV+',
        category: 'Entertainment',
        typicalMonthlyUsd: 9.99,
        commonTrialDays: 7,
        cancelUrl: 'https://apps.apple.com/account/subscriptions',
    },

    {
        name: 'ChatGPT Plus',
        category: 'AI Tools',
        typicalMonthlyUsd: 20,
        iconKey: 'openai',
        cancelUrl: 'https://chatgpt.com/#settings/Subscription',
    },
    {
        name: 'Claude Pro',
        category: 'AI Tools',
        typicalMonthlyUsd: 20,
        iconKey: 'claude',
        cancelUrl: 'https://claude.ai/settings/billing',
    },
    {
        name: 'GitHub Copilot',
        category: 'Developer Tools',
        typicalMonthlyUsd: 10,
        iconKey: 'github',
        commonTrialDays: 30,
        cancelUrl: 'https://github.com/settings/billing',
    },
    {
        name: 'Midjourney',
        category: 'AI Tools',
        typicalMonthlyUsd: 10,
        cancelUrl: 'https://www.midjourney.com/account',
    },

    {
        name: 'Figma',
        category: 'Design',
        typicalMonthlyUsd: 15,
        iconKey: 'figma',
        cancelUrl: 'https://www.figma.com/settings',
    },
    {
        name: 'Canva Pro',
        category: 'Design',
        typicalMonthlyUsd: 12.99,
        iconKey: 'canva',
        commonTrialDays: 30,
        cancelUrl: 'https://www.canva.com/settings/billing-and-plans',
    },
    {
        name: 'Adobe Creative Cloud',
        category: 'Design',
        typicalMonthlyUsd: 59.99,
        iconKey: 'adobe',
        commonTrialDays: 7,
        cancelUrl: 'https://account.adobe.com/plans',
    },

    {
        name: 'Notion',
        category: 'Productivity',
        typicalMonthlyUsd: 10,
        iconKey: 'notion',
        cancelUrl: 'https://www.notion.so/my-settings',
    },
    {
        name: 'Dropbox',
        category: 'Productivity',
        typicalMonthlyUsd: 11.99,
        iconKey: 'dropbox',
        commonTrialDays: 30,
        cancelUrl: 'https://www.dropbox.com/account/plan',
    },
    {
        name: 'Google One',
        category: 'Productivity',
        typicalMonthlyUsd: 1.99,
        cancelUrl: 'https://one.google.com/settings',
    },
    {
        name: 'Microsoft 365',
        category: 'Productivity',
        typicalMonthlyUsd: 9.99,
        commonTrialDays: 30,
        cancelUrl: 'https://account.microsoft.com/services',
    },
    {
        name: 'iCloud+',
        category: 'Productivity',
        typicalMonthlyUsd: 2.99,
        cancelUrl: 'https://apps.apple.com/account/subscriptions',
    },
    {
        name: 'Medium',
        category: 'Productivity',
        typicalMonthlyUsd: 5,
        iconKey: 'medium',
        cancelUrl: 'https://medium.com/me/settings',
    },
];

export interface DiscoveryGroup {
    id: string;
    label: string;
    /** Asked directly, because the user has nothing tracked in this area. */
    prompt: string;
    /** Lowercase fragments that count as "already covered" when found in a name or category. */
    signals: string[];
    /** Shown as examples when prompting. Not necessarily in the catalog. */
    examples: string[];
}

/**
 * The categories people most reliably forget they are paying for.
 *
 * This is the answer to the one real weakness of a manual tracker: a subscription you have
 * forgotten never shows up, because you never enter it. Bank-linked competitors solve that
 * by taking your banking credentials. Prompting by category recovers most of the same value
 * without asking for any of that access.
 */
export const DISCOVERY_GROUPS: DiscoveryGroup[] = [
    {
        id: 'streaming',
        label: 'Streaming',
        prompt: 'Any TV or film streaming?',
        signals: [
            'netflix',
            'disney',
            'hulu',
            'prime video',
            'youtube premium',
            'apple tv',
            'max',
            'paramount',
            'peacock',
            'hotstar',
            'jiocinema',
            'sony liv',
            'zee5',
        ],
        examples: ['Netflix', 'Disney+', 'Prime Video'],
    },
    {
        id: 'music',
        label: 'Music',
        prompt: 'Do you pay for music streaming?',
        signals: [
            'spotify',
            'apple music',
            'youtube music',
            'tidal',
            'deezer',
            'amazon music',
            'pandora',
        ],
        examples: ['Spotify', 'Apple Music', 'YouTube Music'],
    },
    {
        id: 'cloud',
        label: 'Cloud storage',
        prompt: 'Any cloud storage plans?',
        signals: ['icloud', 'google one', 'dropbox', 'onedrive', 'backblaze', 'mega', 'box'],
        examples: ['iCloud+', 'Google One', 'Dropbox'],
    },
    {
        id: 'fitness',
        label: 'Fitness',
        prompt: 'Gym or fitness membership?',
        signals: ['gym', 'fitness', 'peloton', 'strava', 'classpass', 'whoop'],
        examples: ['Your gym', 'Strava', 'ClassPass'],
    },
    {
        id: 'gaming',
        label: 'Gaming',
        prompt: 'Any gaming subscriptions?',
        signals: ['playstation', 'ps plus', 'xbox', 'game pass', 'nintendo', 'steam', 'ea play'],
        examples: ['PlayStation Plus', 'Xbox Game Pass', 'Nintendo Switch Online'],
    },
    {
        id: 'news',
        label: 'News and reading',
        prompt: 'Any news or magazine subscriptions?',
        signals: [
            'times',
            'post',
            'guardian',
            'economist',
            'medium',
            'substack',
            'kindle',
            'audible',
            'news',
        ],
        examples: ['A newspaper', 'Substack', 'Audible'],
    },
    {
        id: 'security',
        label: 'Security',
        prompt: 'Password manager or VPN?',
        signals: [
            '1password',
            'bitwarden',
            'lastpass',
            'dashlane',
            'nordvpn',
            'expressvpn',
            'vpn',
            'proton',
        ],
        examples: ['1Password', 'NordVPN', 'Proton'],
    },
    {
        id: 'delivery',
        label: 'Delivery and shopping',
        prompt: 'Any delivery or shopping memberships?',
        signals: ['prime', 'deliveroo', 'uber one', 'doordash', 'dashpass', 'instacart', 'walmart'],
        examples: ['Amazon Prime', 'Uber One', 'DashPass'],
    },
    {
        id: 'phone',
        label: 'Phone and internet',
        prompt: 'Phone or broadband plan?',
        signals: [
            'mobile',
            'phone',
            'broadband',
            'internet',
            'vodafone',
            'verizon',
            't-mobile',
            'airtel',
            'jio',
        ],
        examples: ['Your mobile plan', 'Home broadband'],
    },
];

/** Catalog entries not already tracked, so the picker never suggests a duplicate. */
export function availableCatalogEntries(existingNames: string[]): CatalogEntry[] {
    const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()));
    return SUBSCRIPTION_CATALOG.filter((entry) => !taken.has(entry.name.toLowerCase()));
}
