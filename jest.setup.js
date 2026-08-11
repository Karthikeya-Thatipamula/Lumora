/* eslint-env jest */

// expo-localization reads the device locale through a native module that does not exist
// under Jest. lib/currency.ts calls getLocales() at module load, so this has to be a mock
// rather than something a test opts into.
jest.mock('expo-localization', () => ({
    getLocales: () => [
        { languageTag: 'en-US', languageCode: 'en', regionCode: 'US', currencyCode: 'USD' },
    ],
    getCalendars: () => [{ timeZone: 'UTC' }],
}));
