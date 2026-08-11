import SubscriptionCard from '@/components/SubscriptionCard';
import { fireEvent, render, screen } from '@testing-library/react-native';
import dayjs from 'dayjs';

/**
 * SubscriptionCard is pure presentation, but it carries three pieces of arithmetic that
 * are easy to break and invisible when they are wrong: the trial countdown, the
 * split-plan share, and the accessibility label that screen readers read the price from.
 */

const baseProps = {
    name: 'Netflix',
    price: 15.49,
    currency: 'USD',
    billing: 'Monthly',
    status: 'active',
    expanded: false,
    onPress: () => {},
} as const;

const inDays = (days: number) => dayjs().add(days, 'day').toISOString();

describe('SubscriptionCard', () => {
    it('shows the name, price and billing cycle', async () => {
        await render(<SubscriptionCard {...baseProps} />);

        expect(screen.getByText('Netflix')).toBeTruthy();
        expect(screen.getByText('$15.49')).toBeTruthy();
        expect(screen.getByText('Monthly')).toBeTruthy();
    });

    it('divides the displayed price by the household size and shows the full total', async () => {
        await render(<SubscriptionCard {...baseProps} price={20} householdSize={4} />);

        expect(screen.getByText('$5.00')).toBeTruthy();
        expect(screen.getByText('Monthly · share')).toBeTruthy();
        expect(screen.getByText('Split 4 ways · $20.00 total')).toBeTruthy();
    });

    it('treats a household size of one as no split at all', async () => {
        await render(<SubscriptionCard {...baseProps} price={20} householdSize={1} />);

        expect(screen.getByText('$20.00')).toBeTruthy();
        expect(screen.queryByText(/Split/)).toBeNull();
    });

    it('counts whole days left on a trial', async () => {
        await render(<SubscriptionCard {...baseProps} isTrial trialEndsAt={inDays(5)} />);

        expect(screen.getByText('Trial · 5d left')).toBeTruthy();
    });

    it('says the trial ends today rather than showing zero days', async () => {
        await render(<SubscriptionCard {...baseProps} isTrial trialEndsAt={inDays(0)} />);

        expect(screen.getByText('Trial ends today')).toBeTruthy();
    });

    it('never shows a negative countdown for a trial that already lapsed', async () => {
        await render(<SubscriptionCard {...baseProps} isTrial trialEndsAt={inDays(-9)} />);

        expect(screen.getByText('Trial ends today')).toBeTruthy();
    });

    it('hides the trial badge once the subscription is cancelled', async () => {
        await render(
            <SubscriptionCard {...baseProps} status="cancelled" isTrial trialEndsAt={inDays(5)} />,
        );

        expect(screen.queryByText(/Trial/)).toBeNull();
        expect(screen.getByText('Cancelled')).toBeTruthy();
    });

    it('reads the per-person price to screen readers on a split plan', async () => {
        await render(<SubscriptionCard {...baseProps} price={20} householdSize={4} />);

        expect(screen.getByLabelText('Netflix, $5.00 per Monthly')).toBeTruthy();
    });

    it('falls back to the plan name for the subtitle when there is no category', async () => {
        await render(<SubscriptionCard {...baseProps} plan="Premium" />);

        expect(screen.getByText('Premium')).toBeTruthy();
    });

    it('prefers the category over the plan for the subtitle', async () => {
        await render(<SubscriptionCard {...baseProps} category="Streaming" plan="Premium" />);

        expect(screen.getByText('Streaming')).toBeTruthy();
    });

    it('reports its expanded state and reveals detail rows when expanded', async () => {
        await render(<SubscriptionCard {...baseProps} expanded paymentMethod="Visa ending 4242" />);

        expect(screen.getByText('Visa ending 4242')).toBeTruthy();
        expect(screen.getByRole('button').props.accessibilityState.expanded).toBe(true);
    });

    it('calls onPress when tapped', async () => {
        const onPress = jest.fn();
        await render(<SubscriptionCard {...baseProps} onPress={onPress} />);

        await fireEvent.press(screen.getByRole('button'));

        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
