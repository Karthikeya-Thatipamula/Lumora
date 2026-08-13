/**
 * The whole design of lib/monitoring.ts is that it does nothing without a DSN, which is
 * the normal state for local development and for anyone who clones the repo. If that
 * ever stops holding, error reporting becomes a second source of crashes.
 */

const mockInit = jest.fn();
const mockSetUser = jest.fn();
const mockCaptureException = jest.fn();

jest.mock('@sentry/react-native', () => ({
    init: mockInit,
    setUser: mockSetUser,
    captureException: mockCaptureException,
}));

describe('monitoring without a DSN', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    });

    /** Re-imports so the module re-reads the env var at load time. */
    const load = () => require('@/lib/monitoring') as typeof import('@/lib/monitoring');

    it('reports itself as disabled', () => {
        expect(load().isMonitoringEnabled).toBe(false);
    });

    it('does not initialise Sentry', () => {
        load().initMonitoring();
        expect(mockInit).not.toHaveBeenCalled();
    });

    it('does not send a user', () => {
        load().identifyForMonitoring('user_123');
        expect(mockSetUser).not.toHaveBeenCalled();
    });

    it('falls back to console.error rather than swallowing the error', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        const boom = new Error('boom');

        load().reportError(boom, { boundary: 'route' });

        expect(mockCaptureException).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith('[monitoring]', boom, { boundary: 'route' });
        consoleError.mockRestore();
    });
});

describe('monitoring with a DSN', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';
    });

    afterAll(() => {
        delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    });

    const load = () => require('@/lib/monitoring') as typeof import('@/lib/monitoring');

    it('reports itself as enabled', () => {
        expect(load().isMonitoringEnabled).toBe(true);
    });

    it('never opts into personally identifying data', () => {
        load().initMonitoring();

        expect(mockInit).toHaveBeenCalledTimes(1);
        expect(mockInit.mock.calls[0][0]).toMatchObject({ sendDefaultPii: false });
    });

    it('identifies by Clerk id alone, with no email or name', () => {
        load().identifyForMonitoring('user_123');

        expect(mockSetUser).toHaveBeenCalledWith({ id: 'user_123' });
    });

    it('clears the user on sign-out', () => {
        load().identifyForMonitoring(undefined);

        expect(mockSetUser).toHaveBeenCalledWith(null);
    });

    it('captures a reported error with its context', () => {
        const boom = new Error('boom');

        load().reportError(boom, { boundary: 'route' });

        expect(mockCaptureException).toHaveBeenCalledWith(boom, {
            extra: { boundary: 'route' },
        });
    });
});
