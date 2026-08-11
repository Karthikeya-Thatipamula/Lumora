import ProGate from '@/components/insights/ProGate';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// jest.mock is hoisted above the imports, so the factory may only close over names
// prefixed with `mock`.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

describe('ProGate', () => {
    beforeEach(() => mockPush.mockClear());

    const gated = (isPro: boolean) => (
        <ProGate isPro={isPro} title="Forecast" description="See where your spend is heading.">
            <Text>the paid content</Text>
        </ProGate>
    );

    it('renders its children untouched for a Pro user', async () => {
        await render(gated(true));

        expect(screen.getByText('the paid content')).toBeTruthy();
        expect(screen.queryByText('Unlock with Pro')).toBeNull();
    });

    it('hides the children behind a lock for a free user', async () => {
        await render(gated(false));

        expect(screen.queryByText('the paid content')).toBeNull();
        expect(screen.getByText('Forecast')).toBeTruthy();
        expect(screen.getByText('See where your spend is heading.')).toBeTruthy();
    });

    it('routes to the paywall when the lock is tapped', async () => {
        await render(gated(false));

        await fireEvent.press(screen.getByLabelText('Unlock Forecast with Pro'));

        expect(mockPush).toHaveBeenCalledWith('/paywall');
    });

    it('does not route when the content is unlocked', async () => {
        await render(gated(true));

        expect(screen.queryByLabelText(/Unlock/)).toBeNull();
        expect(mockPush).not.toHaveBeenCalled();
    });
});
