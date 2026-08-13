import { parseAmount } from '@/lib/money';

describe('parseAmount', () => {
    describe('plain numbers', () => {
        it.each([
            ['9.99', 9.99],
            ['15', 15],
            ['0.5', 0.5],
            ['.5', 0.5],
            ['1000', 1000],
        ])('parses %s', (input, expected) => {
            expect(parseAmount(input)).toBe(expected);
        });
    });

    describe('comma decimal separator', () => {
        // The bug this file exists for: a decimal-pad keyboard on a German, French or
        // Brazilian device emits a comma, and the app rejected it outright.
        it.each([
            ['9,99', 9.99],
            ['0,5', 0.5],
            ['12,34', 12.34],
        ])('parses %s', (input, expected) => {
            expect(parseAmount(input)).toBe(expected);
        });
    });

    describe('grouped thousands', () => {
        it.each([
            ['1,234.56', 1234.56], // US
            ['1.234,56', 1234.56], // EU — used to import as 1.23
            ['1,234', 1234], // three trailing digits reads as grouping
            ['1.234', 1234],
            ['1.234.567,89', 1234567.89],
            ['1,234,567.89', 1234567.89],
        ])('parses %s', (input, expected) => {
            expect(parseAmount(input)).toBe(expected);
        });
    });

    describe('surrounding noise', () => {
        it.each([
            ['$9.99', 9.99],
            ['€9,99', 9.99],
            ['  15.00  ', 15],
            ['₹1,499', 1499],
            ['9.99 USD', 9.99],
        ])('strips %s', (input, expected) => {
            expect(parseAmount(input)).toBe(expected);
        });
    });

    describe('rejects', () => {
        it.each([
            ['', 'empty'],
            ['   ', 'whitespace'],
            ['abc', 'letters only'],
            ['-5', 'negative'],
            ['1..2', 'double separator'],
            ['.', 'bare separator'],
        ])('%s (%s)', (input) => {
            expect(parseAmount(input)).toBeNull();
        });

        it('rejects null and undefined', () => {
            expect(parseAmount(null)).toBeNull();
            expect(parseAmount(undefined)).toBeNull();
        });
    });

    it('accepts zero, leaving the greater-than-zero rule to the caller', () => {
        // The callers all reject zero with their own message, which is more specific than
        // "that is not a number".
        expect(parseAmount('0')).toBe(0);
    });
});
