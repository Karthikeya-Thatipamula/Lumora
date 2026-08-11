import PressableScale from '@/components/motion/PressableScale';
import { CalendarDay, isInMonth } from '@/lib/insights';
import { useThemeColors } from '@/lib/useThemeColors';
import { formatCurrency } from '@/lib/utils';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { FadeIn, LinearTransition } from 'react-native-reanimated';
import { AnimatedView } from '@/components/motion/Animated';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface RenewalCalendarProps {
    days: CalendarDay[];
    monthAnchor: dayjs.Dayjs;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    currency?: string;
}

/**
 * Month grid of what renews when. A list answers "what's next"; a calendar answers
 * "is my money clustered in one week" — which is the question people actually have
 * when a month feels expensive.
 */
const RenewalCalendar = ({
    days,
    monthAnchor,
    onPrevMonth,
    onNextMonth,
    currency,
}: RenewalCalendarProps) => {
    const themeColors = useThemeColors();
    const [selected, setSelected] = useState<CalendarDay | null>(null);

    const monthTotal = days
        .filter((day) => isInMonth(day, monthAnchor))
        .reduce((sum, day) => sum + day.total, 0);

    return (
        <View className="auth-card gap-4">
            <View className="flex-row items-center justify-between">
                <PressableScale
                    onPress={onPrevMonth}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    hitSlop={12}
                >
                    <Text className="text-lg text-primary">‹</Text>
                </PressableScale>

                <View className="items-center">
                    <Text className="text-base font-sans-semibold text-primary">
                        {monthAnchor.format('MMMM YYYY')}
                    </Text>
                    <Text className="text-xs font-sans-medium text-muted-foreground">
                        {formatCurrency(monthTotal, currency)} due
                    </Text>
                </View>

                <PressableScale
                    onPress={onNextMonth}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    hitSlop={12}
                >
                    <Text className="text-lg text-primary">›</Text>
                </PressableScale>
            </View>

            <View className="flex-row">
                {WEEKDAY_LABELS.map((label, index) => (
                    <View key={`${label}-${index}`} className="flex-1 items-center">
                        <Text className="text-[10px] font-sans-semibold text-muted-foreground">
                            {label}
                        </Text>
                    </View>
                ))}
            </View>

            <View className="flex-row flex-wrap">
                {days.map((day) => {
                    const inMonth = isInMonth(day, monthAnchor);
                    const hasRenewals = day.renewals.length > 0;
                    const isSelected = selected?.date === day.date;

                    return (
                        <View
                            key={day.date}
                            style={{ width: `${100 / 7}%` }}
                            className="items-center py-1"
                        >
                            <PressableScale
                                scaleTo={0.9}
                                className={clsx(
                                    'size-9 items-center justify-center rounded-full',
                                    day.isToday && 'border border-accent',
                                    isSelected && 'bg-accent',
                                )}
                                disabled={!hasRenewals}
                                onPress={() => setSelected(isSelected ? null : day)}
                                accessibilityRole="button"
                                accessibilityLabel={
                                    hasRenewals
                                        ? `${dayjs(day.date).format('MMMM D')}, ${day.renewals.length} renewals totalling ${formatCurrency(day.total, currency)}`
                                        : dayjs(day.date).format('MMMM D')
                                }
                            >
                                <Text
                                    className="text-xs font-sans-semibold"
                                    style={{
                                        color: isSelected
                                            ? '#FFFFFF'
                                            : inMonth
                                              ? themeColors.primary
                                              : themeColors.mutedForeground,
                                        opacity: inMonth ? 1 : 0.4,
                                    }}
                                >
                                    {day.dayOfMonth}
                                </Text>
                            </PressableScale>

                            {/* Dot marks a billing day at a glance without crowding the cell. */}
                            <View
                                className="mt-0.5 size-1.5 rounded-full"
                                style={{
                                    backgroundColor:
                                        hasRenewals && !isSelected
                                            ? themeColors.accent
                                            : 'transparent',
                                }}
                            />
                        </View>
                    );
                })}
            </View>

            {selected && (
                <AnimatedView
                    layout={LinearTransition.duration(200)}
                    entering={FadeIn.duration(180)}
                    className="gap-2 rounded-2xl bg-background p-3"
                >
                    <Text className="text-sm font-sans-bold text-primary">
                        {dayjs(selected.date).format('MMMM D')} ·{' '}
                        {formatCurrency(selected.total, currency)}
                    </Text>
                    {selected.renewals.map((sub) => (
                        <View key={sub.id} className="flex-row items-center justify-between gap-3">
                            <Text
                                className="flex-1 text-xs font-sans-medium text-muted-foreground"
                                numberOfLines={1}
                            >
                                {sub.name}
                            </Text>
                            <Text className="text-xs font-sans-semibold text-primary">
                                {formatCurrency(sub.price, sub.currency)}
                            </Text>
                        </View>
                    ))}
                </AnimatedView>
            )}
        </View>
    );
};

export default RenewalCalendar;
