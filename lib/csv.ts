import dayjs from 'dayjs';

const COLUMNS = [
    'Name',
    'Category',
    'Price',
    'Currency',
    'Billing',
    'Status',
    'Free trial',
    'Trial ends',
    'Start date',
    'Renewal date',
    'Payment method',
] as const;

/**
 * Quotes a CSV cell and defuses formula injection: a subscription literally named
 * `=HYPERLINK(...)` would otherwise execute when the export is opened in Excel or Sheets.
 */
export function escapeCsv(value: string | number | undefined | null): string {
    const raw = value === undefined || value === null ? '' : String(value);
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
}

function formatDate(value?: string): string {
    if (!value) return '';
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

export function buildSubscriptionsCsv(subscriptions: Subscription[]): string {
    const rows = subscriptions.map((sub) => [
        sub.name,
        sub.category ?? sub.plan ?? '',
        sub.price.toFixed(2),
        sub.currency ?? 'USD',
        sub.billing,
        sub.status ?? '',
        sub.isTrial ? 'Yes' : 'No',
        formatDate(sub.trialEndsAt),
        formatDate(sub.startDate),
        formatDate(sub.renewalDate),
        sub.paymentMethod ?? '',
    ]);

    return [COLUMNS, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

export function exportFileName(): string {
    return `lumora-subscriptions-${dayjs().format('YYYY-MM-DD')}.csv`;
}
