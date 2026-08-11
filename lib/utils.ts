import dayjs from 'dayjs';

/**
 * Formats money defensively. Every input here is derived from user-entered numbers and
 * stored currency codes, so it has to survive NaN from a bad division, Infinity, and
 * currency codes Intl doesn't recognise — rendering "NaN" or throwing mid-list is worse
 * than a plain fallback.
 */
export const formatCurrency = (value: number, currency = 'USD'): string => {
    if (!Number.isFinite(value)) return '—';

    const code = /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : 'USD';

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        // Intl is unavailable or rejected the code — keep the amount readable and
        // still say which currency it is.
        return `${value.toFixed(2)} ${code}`;
    }
};

export const formatSubscriptionDateTime = (value?: string): string => {
    if (!value) return 'Not provided';
    const parsedDate = dayjs(value);
    return parsedDate.isValid() ? parsedDate.format('MM/DD/YYYY') : 'Not provided';
};

export const formatStatusLabel = (value?: string): string => {
    if (!value) return 'Unknown';
    return value.charAt(0).toUpperCase() + value.slice(1);
};
