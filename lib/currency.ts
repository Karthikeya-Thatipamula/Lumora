import * as Localization from 'expo-localization';

export interface CurrencyOption {
    code: string;
    symbol: string;
    name: string;
}

/**
 * The currencies Lumora offers explicitly. Deliberately a short list of the majors
 * rather than all ~180 ISO codes — a long picker is worse UX than a short one, and
 * anything stored outside this list still renders correctly via Intl.
 */
export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
];

export const DEFAULT_CURRENCY = 'USD';

const SUPPORTED_CODES = new Set(SUPPORTED_CURRENCIES.map((currency) => currency.code));

export function isSupportedCurrency(code: string | undefined): boolean {
    return Boolean(code && SUPPORTED_CODES.has(code));
}

/**
 * Best guess at the user's currency from device locale, so someone in Mumbai or Berlin
 * isn't silently defaulted into dollars. Falls back to USD when the device reports
 * something we don't offer.
 */
export function getDeviceCurrency(): string {
    try {
        const [locale] = Localization.getLocales();
        const code = locale?.currencyCode;
        return isSupportedCurrency(code ?? undefined) ? code! : DEFAULT_CURRENCY;
    } catch {
        return DEFAULT_CURRENCY;
    }
}

export function currencySymbol(code: string | undefined): string {
    return SUPPORTED_CURRENCIES.find((currency) => currency.code === code)?.symbol ?? '$';
}

/** True when the list spans more than one currency, which makes a single total misleading. */
export function hasMixedCurrencies(subscriptions: Subscription[]): boolean {
    const codes = new Set(subscriptions.map((sub) => sub.currency ?? DEFAULT_CURRENCY));
    return codes.size > 1;
}
