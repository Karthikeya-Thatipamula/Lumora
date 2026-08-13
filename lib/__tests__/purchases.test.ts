/**
 * The identity handling here had a cross-account entitlement leak: `configure` was called
 * once behind a boolean latch with the first user's id baked in, so signing out and back
 * in as someone else on the same device left RevenueCat identified as the first user —
 * and the second user saw their Pro entitlement.
 *
 * These lock the contract that fixed it: configure once, identify separately, and always
 * detach on sign-out.
 */

const mockConfigure = jest.fn();
const mockLogIn = jest.fn().mockResolvedValue(undefined);
const mockLogOut = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native-purchases', () => ({
    __esModule: true,
    default: {
        configure: mockConfigure,
        logIn: mockLogIn,
        logOut: mockLogOut,
    },
}));

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: { appOwnership: null },
}));

describe('purchase identity', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_test';
        process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = 'goog_test';
    });

    afterAll(() => {
        delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
        delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
    });

    const load = () => require('@/lib/purchases') as typeof import('@/lib/purchases');

    it('configures the SDK without baking in a user id', async () => {
        await load().identifyPurchaseUser('user_a');

        expect(mockConfigure).toHaveBeenCalledTimes(1);
        expect(mockConfigure.mock.calls[0][0]).not.toHaveProperty('appUserID');
    });

    it('identifies the user through logIn, not configure', async () => {
        await load().identifyPurchaseUser('user_a');

        expect(mockLogIn).toHaveBeenCalledWith('user_a');
    });

    it('re-identifies when a different user signs in, without reconfiguring', async () => {
        const purchases = load();

        await purchases.identifyPurchaseUser('user_a');
        await purchases.resetPurchaseUser();
        await purchases.identifyPurchaseUser('user_b');

        // The leak: this used to stop after user_a because of the configure latch.
        expect(mockLogIn).toHaveBeenNthCalledWith(1, 'user_a');
        expect(mockLogIn).toHaveBeenNthCalledWith(2, 'user_b');
        expect(mockLogOut).toHaveBeenCalledTimes(1);
        expect(mockConfigure).toHaveBeenCalledTimes(1);
    });

    it('reports ready only once configured, and notifies subscribers', async () => {
        const purchases = load();
        const listener = jest.fn();
        purchases.subscribeToPurchasesReady(listener);

        expect(purchases.getPurchasesReady()).toBe(false);

        await purchases.identifyPurchaseUser('user_a');

        expect(purchases.getPurchasesReady()).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', async () => {
        const purchases = load();
        const listener = jest.fn();
        const unsubscribe = purchases.subscribeToPurchasesReady(listener);
        unsubscribe();

        await purchases.identifyPurchaseUser('user_a');

        expect(listener).not.toHaveBeenCalled();
    });

    it('does nothing on sign-out when the SDK was never configured', async () => {
        await load().resetPurchaseUser();

        expect(mockLogOut).not.toHaveBeenCalled();
    });

    it('survives a logIn rejection without throwing at the call site', async () => {
        mockLogIn.mockRejectedValueOnce(new Error('network'));
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(load().identifyPurchaseUser('user_a')).resolves.toBeUndefined();

        consoleWarn.mockRestore();
    });
});

describe('purchase identity without an API key', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
        delete process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
        delete process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY;
    });

    const load = () => require('@/lib/purchases') as typeof import('@/lib/purchases');

    it('reports itself unconfigured', () => {
        expect(load().isPurchasesConfigured).toBe(false);
    });

    it('never touches the SDK', async () => {
        const purchases = load();

        await purchases.identifyPurchaseUser('user_a');
        await purchases.resetPurchaseUser();

        expect(mockConfigure).not.toHaveBeenCalled();
        expect(mockLogIn).not.toHaveBeenCalled();
        expect(mockLogOut).not.toHaveBeenCalled();
    });
});
