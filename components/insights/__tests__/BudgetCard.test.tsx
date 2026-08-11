import BudgetCard from '@/components/insights/BudgetCard';
import { fireEvent, render, screen } from '@testing-library/react-native';

/**
 * The validation here exists because an invalid entry used to silently do nothing, so
 * tapping Save looked broken. These lock in that every rejected input says why.
 */

describe('BudgetCard', () => {
    it('opens in edit mode when no budget is set yet', async () => {
        await render(<BudgetCard monthlySpend={0} onSave={jest.fn()} />);

        expect(screen.getByPlaceholderText('e.g. 150')).toBeTruthy();
    });

    it('saves a valid budget', async () => {
        const onSave = jest.fn();
        await render(<BudgetCard monthlySpend={0} onSave={onSave} />);

        await fireEvent.changeText(screen.getByPlaceholderText('e.g. 150'), '200');
        await fireEvent.press(screen.getByText('Save'));

        expect(onSave).toHaveBeenCalledWith(200);
    });

    it('accepts a decimal budget', async () => {
        const onSave = jest.fn();
        await render(<BudgetCard monthlySpend={0} onSave={onSave} />);

        await fireEvent.changeText(screen.getByPlaceholderText('e.g. 150'), '99.99');
        await fireEvent.press(screen.getByText('Save'));

        expect(onSave).toHaveBeenCalledWith(99.99);
    });

    it('explains itself rather than silently ignoring an empty entry', async () => {
        const onSave = jest.fn();
        await render(<BudgetCard monthlySpend={0} onSave={onSave} />);

        await fireEvent.press(screen.getByText('Save'));

        expect(screen.getByText('Enter a number, like 150')).toBeTruthy();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('rejects non-numeric text', async () => {
        const onSave = jest.fn();
        await render(<BudgetCard monthlySpend={0} onSave={onSave} />);

        await fireEvent.changeText(screen.getByPlaceholderText('e.g. 150'), 'a lot');
        await fireEvent.press(screen.getByText('Save'));

        expect(screen.getByText('Enter a number, like 150')).toBeTruthy();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('rejects zero and negative budgets', async () => {
        const onSave = jest.fn();
        await render(<BudgetCard monthlySpend={0} onSave={onSave} />);

        await fireEvent.changeText(screen.getByPlaceholderText('e.g. 150'), '0');
        await fireEvent.press(screen.getByText('Save'));

        expect(screen.getByText('Budget must be greater than zero')).toBeTruthy();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('rejects a budget above the ceiling', async () => {
        const onSave = jest.fn();
        await render(<BudgetCard monthlySpend={0} onSave={onSave} />);

        await fireEvent.changeText(screen.getByPlaceholderText('e.g. 150'), '1000001');
        await fireEvent.press(screen.getByText('Save'));

        expect(screen.getByText(/maximum is/)).toBeTruthy();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('shows spend against the budget once one is set', async () => {
        await render(<BudgetCard monthlyBudget={200} monthlySpend={50} onSave={jest.fn()} />);

        expect(screen.getByText(/\$50\.00/)).toBeTruthy();
        expect(screen.getByText(/\$200\.00/)).toBeTruthy();
    });
});
