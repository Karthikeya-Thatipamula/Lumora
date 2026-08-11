// Jest globals come from the test-file block in eslint.config.js; an /* eslint-env */
// comment would be ignored under flat config and errors outright in ESLint 10.

// expo-localization reads the device locale through a native module that does not exist
// under Jest. lib/currency.ts calls getLocales() at module load, so this has to be a mock
// rather than something a test opts into.
jest.mock('expo-localization', () => ({
    getLocales: () => [
        { languageTag: 'en-US', languageCode: 'en', regionCode: 'US', currencyCode: 'USD' },
    ],
    getCalendars: () => [{ timeZone: 'UTC' }],
}));
