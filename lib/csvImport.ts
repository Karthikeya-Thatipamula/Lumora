import { parseAmount } from '@/lib/money';
import {
    CATEGORIES,
    type Category,
    type Frequency,
    type SubscriptionFormValues,
} from '@/lib/subscriptionTypes';
import { isSupportedCurrency } from '@/lib/currency';

export interface ImportRow {
    values: SubscriptionFormValues;
    /** Non-fatal notes, e.g. an unrecognised category that fell back to Other. */
    warnings: string[];
}

export interface ImportResult {
    rows: ImportRow[];
    /** One entry per rejected line, with the line number the user can go and fix. */
    errors: { line: number; reason: string }[];
}

/** Splits one CSV line, honouring quoted fields and doubled quotes inside them. */
export function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];

        if (inQuotes) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            cells.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    cells.push(current);
    return cells.map((cell) => cell.trim());
}

/** Matches a header cell to a known field, tolerating the naming other apps use. */
function columnIndex(headers: string[], ...aliases: string[]): number {
    const normalised = headers.map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
    for (const alias of aliases) {
        const index = normalised.indexOf(alias.toLowerCase().replace(/[^a-z]/g, ''));
        if (index !== -1) return index;
    }
    return -1;
}

function normaliseCategory(raw: string | undefined, warnings: string[]): Category {
    if (!raw) return 'Other';
    const match = CATEGORIES.find(
        (category) => category.toLowerCase() === raw.trim().toLowerCase(),
    );
    if (match) return match;

    warnings.push(`Category "${raw}" isn't one of Lumora's — filed under Other`);
    return 'Other';
}

const IMPORTABLE_STATUSES = ['active', 'paused', 'cancelled'] as const;

function normaliseStatus(raw: string | undefined): SubscriptionFormValues['status'] {
    const value = (raw ?? '').trim().toLowerCase();
    return IMPORTABLE_STATUSES.find((status) => status === value);
}

/** Whole people, at least one — the divisor for a split plan must never be zero. */
function normaliseHouseholdSize(raw: string | undefined): number | undefined {
    if (!raw?.trim()) return undefined;
    const size = Math.floor(Number(raw.trim()));
    return Number.isFinite(size) && size >= 1 ? size : undefined;
}

function normaliseFrequency(raw: string | undefined): Frequency {
    const value = (raw ?? '').trim().toLowerCase();
    // Anything annual-ish counts as yearly; everything else bills monthly.
    return ['yearly', 'year', 'annual', 'annually', 'y'].includes(value) ? 'Yearly' : 'Monthly';
}

/**
 * Parses a CSV export from Lumora or a competitor into importable rows.
 *
 * Deliberately forgiving about column naming and order — the point is to let someone
 * leave Bobby, Subby or a spreadsheet without retyping thirty subscriptions, and a rigid
 * parser would defeat that. Bad rows are reported by line number rather than silently
 * dropped, so nothing goes missing without the user being told.
 */
export function parseSubscriptionsCsv(text: string): ImportResult {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length === 0) return { rows: [], errors: [{ line: 0, reason: 'Nothing to import' }] };

    const headers = parseCsvLine(lines[0]);
    const nameIndex = columnIndex(headers, 'name', 'subscription', 'service', 'title');
    const priceIndex = columnIndex(headers, 'price', 'cost', 'amount');

    if (nameIndex === -1 || priceIndex === -1) {
        return {
            rows: [],
            errors: [{ line: 1, reason: 'Needs at least a "Name" and a "Price" column' }],
        };
    }

    const categoryIndex = columnIndex(headers, 'category', 'type', 'plan');
    const currencyIndex = columnIndex(headers, 'currency', 'ccy');
    const billingIndex = columnIndex(
        headers,
        'billing',
        'frequency',
        'cycle',
        'interval',
        'period',
    );
    const paymentIndex = columnIndex(headers, 'paymentmethod', 'payment', 'card', 'paidwith');
    // Lumora's own export writes these. Ignoring them meant re-importing your own file
    // resurrected every cancelled subscription as active and re-billed shared plans at
    // full price — spend jumped, with no indication why.
    const statusIndex = columnIndex(headers, 'status', 'state');
    const householdIndex = columnIndex(
        headers,
        'householdsize',
        'household',
        'shared',
        'splitways',
    );

    const rows: ImportRow[] = [];
    const errors: { line: number; reason: string }[] = [];

    lines.slice(1).forEach((line, offset) => {
        const lineNumber = offset + 2;
        const cells = parseCsvLine(line);
        const warnings: string[] = [];

        const name = (cells[nameIndex] ?? '').trim();
        if (!name) {
            errors.push({ line: lineNumber, reason: 'Missing name' });
            return;
        }

        // Handles both decimal conventions. Stripping everything but digits and dots used
        // to turn a European "1.234,56" into "1.23456", which parsed as 1.23 — under a
        // thousandth of the real price, and it passed the greater-than-zero check.
        const price = parseAmount(cells[priceIndex]);
        if (price === null || price <= 0) {
            errors.push({ line: lineNumber, reason: `"${name}" has no usable price` });
            return;
        }

        const currency =
            currencyIndex === -1 ? undefined : cells[currencyIndex]?.trim().toUpperCase();

        rows.push({
            values: {
                name: name.slice(0, 60),
                price,
                frequency: normaliseFrequency(
                    billingIndex === -1 ? undefined : cells[billingIndex],
                ),
                category: normaliseCategory(
                    categoryIndex === -1 ? undefined : cells[categoryIndex],
                    warnings,
                ),
                currency: isSupportedCurrency(currency) ? currency : undefined,
                paymentMethod:
                    paymentIndex === -1 ? undefined : cells[paymentIndex]?.trim() || undefined,
                status: statusIndex === -1 ? undefined : normaliseStatus(cells[statusIndex]),
                householdSize:
                    householdIndex === -1
                        ? undefined
                        : normaliseHouseholdSize(cells[householdIndex]),
            },
            warnings,
        });
    });

    return { rows, errors };
}

/** Rows whose name already exists, so an import can't quietly double everything up. */
export function findImportDuplicates(rows: ImportRow[], existingNames: string[]): Set<string> {
    const existing = new Set(existingNames.map((name) => name.trim().toLowerCase()));
    return new Set(
        rows
            .filter((row) => existing.has(row.values.name.toLowerCase()))
            .map((row) => row.values.name),
    );
}
