/**
 * Parsing money that a human typed, or that a spreadsheet exported.
 *
 * The app previously accepted only `.` as a decimal separator. On a German, French or
 * Brazilian device the `decimal-pad` keyboard emits `,`, so those users typed `9,99`, got
 * "Enter a number, like 9.99", and **could not enter a decimal price at all**.
 *
 * CSV import had the mirror-image bug: it stripped everything that was not a digit or a
 * dot, so `"1.234,56"` became `"1.23456"` and parsed as **1.23**. That passed the
 * greater-than-zero check and imported silently.
 *
 * Pure and React-free.
 */

/**
 * Parses a user- or spreadsheet-supplied amount, accepting both decimal conventions.
 * Returns `null` for anything that is not a single, finite, non-negative number.
 *
 * Separator disambiguation follows the usual rule: when both `.` and `,` appear, the
 * rightmost is the decimal separator and the other is grouping. When only one appears and
 * it is followed by exactly three digits, it is treated as grouping (`1,234` and `1.234`
 * are both 1234) — the convention spreadsheets use.
 */
export function parseAmount(raw: string | undefined | null): number | null {
    if (raw === undefined || raw === null) return null;

    // Currency symbols, spaces and non-breaking spaces are all noise around the number.
    const cleaned = raw.replace(/[^\d.,-]/g, '').trim();
    if (cleaned === '') return null;

    // A minus anywhere means this is not a price we accept.
    if (cleaned.includes('-')) return null;

    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');

    let normalized: string;

    if (lastDot !== -1 && lastComma !== -1) {
        // Both present: the rightmost is the decimal point.
        const decimalAt = Math.max(lastDot, lastComma);
        const groupingChar = decimalAt === lastDot ? ',' : '.';
        normalized =
            cleaned.slice(0, decimalAt).split(groupingChar).join('') +
            '.' +
            cleaned.slice(decimalAt + 1);
    } else if (lastDot !== -1 || lastComma !== -1) {
        const separator = lastDot !== -1 ? '.' : ',';
        const parts = cleaned.split(separator);

        // Repeated separator can only be grouping: 1.234.567. Every group after the
        // first must be exactly three digits, or this is malformed rather than grouped —
        // "1..2" is not 12.
        if (parts.length > 2) {
            const groupsAreValid =
                /^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((part) => /^\d{3}$/.test(part));
            if (!groupsAreValid) return null;
            normalized = parts.join('');
        } else {
            const [whole, fraction] = parts;
            // Exactly three trailing digits with something in front reads as grouping.
            normalized =
                fraction.length === 3 && whole.length > 0
                    ? whole + fraction
                    : `${whole}.${fraction}`;
        }
    } else {
        normalized = cleaned;
    }

    if (normalized === '' || normalized === '.') return null;
    // Reject anything left over that is not a plain decimal, e.g. "1..2".
    if (!/^\d*\.?\d*$/.test(normalized)) return null;

    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}

/** True when the text parses to a usable price. Empty input is not an error, just absent. */
export function isValidAmountInput(raw: string): boolean {
    return parseAmount(raw) !== null;
}
