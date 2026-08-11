import {
    View,
    Text,
    Modal,
    Pressable,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import dayjs from 'dayjs';
import { posthog } from '@/src/config/posthog';
import { availableCatalogEntries, CatalogEntry } from '@/constants/catalog';
import { currencySymbol, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/lib/currency';
import {
    CATEGORIES,
    DEFAULT_TRIAL_LENGTH,
    HOUSEHOLD_OPTIONS,
    MAX_NAME_LENGTH,
    MAX_PRICE,
    TRIAL_LENGTH_OPTIONS,
    type Category,
    type Frequency,
    type SubscriptionFormValues,
} from '@/lib/subscriptionTypes';
import { useThemeColors } from '@/lib/useThemeColors';

interface CreateSubscriptionModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (values: SubscriptionFormValues) => void | Promise<void>;
    initialValues?: SubscriptionFormValues;
    mode?: 'create' | 'edit';
    /** Account currency, used as the default for anything created here. */
    defaultCurrency?: string;
    /** Names already tracked, so the quick-add row never offers a duplicate. */
    existingNames?: string[];
    /** Cards/methods already in use, offered as one-tap chips. */
    knownPaymentMethods?: string[];
    /** Seeds the name field when opened from a discovery prompt. */
    prefillName?: string;
    /** Warns before creating a second entry for something already tracked. */
    duplicateWarning?: string | null;
    /** Lets the parent run its own checks (duplicates) against the live name. */
    onNameChange?: (name: string) => void;
}

const CreateSubscriptionModal = ({
    visible,
    onClose,
    onSubmit,
    initialValues,
    mode = 'create',
    defaultCurrency = DEFAULT_CURRENCY,
    existingNames = [],
    knownPaymentMethods = [],
    prefillName,
    duplicateWarning,
    onNameChange,
}: CreateSubscriptionModalProps) => {
    const themeColors = useThemeColors();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState(initialValues?.name ?? '');
    const [price, setPrice] = useState(initialValues ? String(initialValues.price) : '');
    const [frequency, setFrequency] = useState<Frequency>(initialValues?.frequency ?? 'Monthly');
    const [category, setCategory] = useState<Category>(initialValues?.category ?? 'Other');
    const [currency, setCurrency] = useState(initialValues?.currency ?? defaultCurrency);
    const [isTrial, setIsTrial] = useState(initialValues?.isTrial ?? false);
    const [trialDays, setTrialDays] = useState<number>(
        initialValues?.trialDays ?? DEFAULT_TRIAL_LENGTH,
    );
    const [householdSize, setHouseholdSize] = useState<number>(initialValues?.householdSize ?? 1);
    const [paymentMethod, setPaymentMethod] = useState(initialValues?.paymentMethod ?? '');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const quickAdds = useMemo(
        () => (mode === 'create' ? availableCatalogEntries(existingNames).slice(0, 8) : []),
        [mode, existingNames],
    );

    // Reset only on the closed → open transition. Keying off `initialValues` directly
    // would re-run on every parent render (it's rebuilt inline by callers) and wipe
    // whatever the user had already typed.
    const wasVisible = useRef(false);
    useEffect(() => {
        if (visible && !wasVisible.current) {
            setName(initialValues?.name ?? prefillName ?? '');
            setPrice(initialValues ? String(initialValues.price) : '');
            setFrequency(initialValues?.frequency ?? 'Monthly');
            setCategory(initialValues?.category ?? 'Other');
            setCurrency(initialValues?.currency ?? defaultCurrency);
            setIsTrial(initialValues?.isTrial ?? false);
            setTrialDays(initialValues?.trialDays ?? DEFAULT_TRIAL_LENGTH);
            setHouseholdSize(initialValues?.householdSize ?? 1);
            setPaymentMethod(initialValues?.paymentMethod ?? '');
        }
        wasVisible.current = visible;
    }, [visible, initialValues, defaultCurrency, prefillName]);

    const trimmedPrice = price.trim();
    const priceNumber = Number(trimmedPrice);
    const priceLooksNumeric = /^\s*\+?(\d+(\.\d+)?|\.\d+)\s*$/.test(trimmedPrice);

    // Distinguishes the failure modes so the user is told what's actually wrong.
    const priceError =
        trimmedPrice === ''
            ? null
            : !priceLooksNumeric || !Number.isFinite(priceNumber)
              ? 'Enter a number, like 9.99'
              : priceNumber <= 0
                ? 'Price must be greater than zero'
                : priceNumber > MAX_PRICE
                  ? `That looks too high — the maximum is ${MAX_PRICE.toLocaleString()}`
                  : null;

    const isValidPrice = trimmedPrice !== '' && priceError === null;
    const isValidForm = name.trim() !== '' && isValidPrice;

    const handleSubmit = async () => {
        if (!isValidForm || isSubmitting) return;

        const trimmedName = name.trim().slice(0, MAX_NAME_LENGTH);
        const priceValue = Number(price.trim());

        setIsSubmitting(true);
        try {
            await onSubmit({
                name: trimmedName,
                price: priceValue,
                frequency,
                category,
                currency,
                isTrial,
                trialDays,
                householdSize,
                paymentMethod: paymentMethod.trim() || undefined,
            });

            posthog.capture(mode === 'create' ? 'subscription_created' : 'subscription_edited', {
                subscription_name: trimmedName,
                subscription_price: priceValue,
                subscription_frequency: frequency,
                subscription_category: category,
                subscription_currency: currency,
                is_trial: isTrial,
                trial_days: isTrial ? trialDays : null,
                household_size: householdSize,
                has_payment_method: paymentMethod.trim().length > 0,
            });

            if (mode === 'create') resetForm();
            onClose();
        } catch (error) {
            // Callers show a contextual error dialog. Catch here as well so a
            // rejected submit handler never becomes an unhandled promise on device.
            console.warn('Subscription form submission failed:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setName('');
        setPrice('');
        setFrequency('Monthly');
        setCategory('Other');
        setCurrency(defaultCurrency);
        setIsTrial(false);
        setTrialDays(DEFAULT_TRIAL_LENGTH);
        setHouseholdSize(1);
        setPaymentMethod('');
    };

    /** Prefills the form from the catalog. Nothing is saved until the user confirms. */
    const applyQuickAdd = (entry: CatalogEntry) => {
        setName(entry.name);
        setPrice(entry.typicalMonthlyUsd.toFixed(2));
        setFrequency('Monthly');
        setCategory(entry.category);
        if (entry.commonTrialDays) {
            setIsTrial(true);
            setTrialDays(entry.commonTrialDays);
        }
        posthog.capture('quick_add_used', { service_name: entry.name });
    };

    const handleClose = () => {
        if (mode === 'create') resetForm();
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
            {/* `height` behaviour on Android inside a Modal fights the window resize and
                collapses the sheet; Android handles the keyboard itself, so only iOS opts in. */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                <Pressable className="modal-overlay" onPress={handleClose}>
                    <Pressable className="modal-container" onPress={(e) => e.stopPropagation()}>
                        <View className="modal-header">
                            <Text className="modal-title">
                                {mode === 'create' ? 'New Subscription' : 'Edit Subscription'}
                            </Text>
                            <Pressable
                                className="modal-close"
                                onPress={handleClose}
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                            >
                                <Text className="modal-close-text">✕</Text>
                            </Pressable>
                        </View>

                        {/* `flex-1` is what makes this scroll at all. Without it the ScrollView
                            sizes to its content inside a max-height container, gets clipped, and
                            reports a viewport equal to its content — so there is nothing to scroll.
                            Padding lives in contentContainerStyle; on a ScrollView, `style` padding
                            shrinks the viewport instead of insetting the content. */}
                        <ScrollView
                            className="flex-1"
                            showsVerticalScrollIndicator
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            contentContainerStyle={{
                                gap: 20,
                                padding: 20,
                                paddingBottom: 24 + insets.bottom,
                            }}
                        >
                            {quickAdds.length > 0 && (
                                <View className="auth-field">
                                    <Text className="auth-label">Quick add</Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        keyboardShouldPersistTaps="handled"
                                        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                                    >
                                        {quickAdds.map((entry) => (
                                            <Pressable
                                                key={entry.name}
                                                className="category-chip"
                                                onPress={() => applyQuickAdd(entry)}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Prefill ${entry.name}`}
                                            >
                                                <Text className="category-chip-text">
                                                    {entry.name}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </ScrollView>
                                    <Text className="text-xs font-sans-medium text-muted-foreground">
                                        Tap to prefill typical pricing — edit anything before
                                        saving.
                                    </Text>
                                </View>
                            )}

                            <View className="auth-field">
                                <Text className="auth-label">Name</Text>
                                <TextInput
                                    className="auth-input"
                                    placeholder="Subscription name"
                                    placeholderTextColor={themeColors.placeholder}
                                    value={name}
                                    onChangeText={(next) => {
                                        setName(next);
                                        onNameChange?.(next);
                                    }}
                                    maxLength={MAX_NAME_LENGTH}
                                />
                                {duplicateWarning && (
                                    <Text className="text-xs font-sans-semibold text-accent">
                                        {duplicateWarning}
                                    </Text>
                                )}
                            </View>

                            <View className="auth-field">
                                <Text className="auth-label">Currency</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                    contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                                >
                                    {SUPPORTED_CURRENCIES.map((option) => (
                                        <Pressable
                                            key={option.code}
                                            className={clsx(
                                                'category-chip',
                                                currency === option.code && 'category-chip-active',
                                            )}
                                            onPress={() => setCurrency(option.code)}
                                            accessibilityRole="button"
                                            accessibilityLabel={option.name}
                                        >
                                            <Text
                                                className={clsx(
                                                    'category-chip-text',
                                                    currency === option.code &&
                                                        'category-chip-text-active',
                                                )}
                                            >
                                                {option.symbol} {option.code}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>

                            <View className="auth-field">
                                <Text className="auth-label">
                                    Price ({currencySymbol(currency)})
                                </Text>
                                <TextInput
                                    className={clsx('auth-input', priceError && 'auth-input-error')}
                                    placeholder="0.00"
                                    placeholderTextColor={themeColors.placeholder}
                                    value={price}
                                    onChangeText={setPrice}
                                    keyboardType="decimal-pad"
                                    maxLength={12}
                                />
                                {priceError && <Text className="auth-error">{priceError}</Text>}
                            </View>

                            <View className="auth-field">
                                <Text className="auth-label">Frequency</Text>
                                <View className="picker-row">
                                    <Pressable
                                        className={clsx(
                                            'picker-option',
                                            frequency === 'Monthly' && 'picker-option-active',
                                        )}
                                        onPress={() => setFrequency('Monthly')}
                                    >
                                        <Text
                                            className={clsx(
                                                'picker-option-text',
                                                frequency === 'Monthly' &&
                                                    'picker-option-text-active',
                                            )}
                                        >
                                            Monthly
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        className={clsx(
                                            'picker-option',
                                            frequency === 'Yearly' && 'picker-option-active',
                                        )}
                                        onPress={() => setFrequency('Yearly')}
                                    >
                                        <Text
                                            className={clsx(
                                                'picker-option-text',
                                                frequency === 'Yearly' &&
                                                    'picker-option-text-active',
                                            )}
                                        >
                                            Yearly
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View className="auth-field">
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-1 pr-3">
                                        <Text className="auth-label">Starting a free trial?</Text>
                                        <Text className="mt-1 text-xs font-sans-medium text-muted-foreground">
                                            Lumora warns you before it converts to a paid plan.
                                        </Text>
                                    </View>
                                    <Switch
                                        value={isTrial}
                                        onValueChange={setIsTrial}
                                        trackColor={{ false: '#d4d4d4', true: '#ea7a53' }}
                                        accessibilityLabel="Track this as a free trial"
                                    />
                                </View>

                                {isTrial && (
                                    <View className="mt-3 gap-2">
                                        <View className="picker-row">
                                            {TRIAL_LENGTH_OPTIONS.map((days) => (
                                                <Pressable
                                                    key={days}
                                                    className={clsx(
                                                        'picker-option',
                                                        trialDays === days &&
                                                            'picker-option-active',
                                                    )}
                                                    onPress={() => setTrialDays(days)}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`${days} day trial`}
                                                >
                                                    <Text
                                                        className={clsx(
                                                            'picker-option-text',
                                                            trialDays === days &&
                                                                'picker-option-text-active',
                                                        )}
                                                    >
                                                        {days} days
                                                    </Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                        <Text className="text-xs font-sans-medium text-muted-foreground">
                                            First charge on{' '}
                                            {dayjs().add(trialDays, 'day').format('MMM D, YYYY')}.
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View className="auth-field">
                                <Text className="auth-label">Splitting this with anyone?</Text>
                                <Text className="text-xs font-sans-medium text-muted-foreground">
                                    Family and duo plans only cost you your share — Lumora counts it
                                    that way.
                                </Text>
                                <View className="mt-2 flex-row flex-wrap gap-2">
                                    {HOUSEHOLD_OPTIONS.map((size) => (
                                        <Pressable
                                            key={size}
                                            className={clsx(
                                                'category-chip',
                                                householdSize === size && 'category-chip-active',
                                            )}
                                            onPress={() => setHouseholdSize(size)}
                                            accessibilityRole="button"
                                            accessibilityLabel={
                                                size === 1 ? 'Just me' : `Split ${size} ways`
                                            }
                                        >
                                            <Text
                                                className={clsx(
                                                    'category-chip-text',
                                                    householdSize === size &&
                                                        'category-chip-text-active',
                                                )}
                                            >
                                                {size === 1 ? 'Just me' : `${size} people`}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                                {householdSize > 1 && isValidPrice && (
                                    <Text className="mt-1 text-xs font-sans-semibold text-accent">
                                        Your share: {currencySymbol(currency)}
                                        {(priceNumber / householdSize).toFixed(2)} per{' '}
                                        {frequency === 'Monthly' ? 'month' : 'year'}
                                    </Text>
                                )}
                            </View>

                            <View className="auth-field">
                                <Text className="auth-label">Category</Text>
                                <View className="category-scroll">
                                    {CATEGORIES.map((cat) => (
                                        <Pressable
                                            key={cat}
                                            className={clsx(
                                                'category-chip',
                                                category === cat && 'category-chip-active',
                                            )}
                                            onPress={() => setCategory(cat)}
                                        >
                                            <Text
                                                className={clsx(
                                                    'category-chip-text',
                                                    category === cat && 'category-chip-text-active',
                                                )}
                                            >
                                                {cat}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <View className="auth-field">
                                <Text className="auth-label">Paid with (optional)</Text>
                                <TextInput
                                    className="auth-input"
                                    placeholder="e.g. Amex ...1004, PayPal"
                                    placeholderTextColor={themeColors.placeholder}
                                    value={paymentMethod}
                                    onChangeText={setPaymentMethod}
                                    maxLength={40}
                                />
                                {knownPaymentMethods.length > 0 && (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        keyboardShouldPersistTaps="handled"
                                        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                                    >
                                        {knownPaymentMethods.map((method) => (
                                            <Pressable
                                                key={method}
                                                className={clsx(
                                                    'category-chip',
                                                    paymentMethod === method &&
                                                        'category-chip-active',
                                                )}
                                                onPress={() => setPaymentMethod(method)}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Paid with ${method}`}
                                            >
                                                <Text
                                                    className={clsx(
                                                        'category-chip-text',
                                                        paymentMethod === method &&
                                                            'category-chip-text-active',
                                                    )}
                                                >
                                                    {method}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </ScrollView>
                                )}
                                <Text className="text-xs font-sans-medium text-muted-foreground">
                                    Lets you search by card and see what hits each one.
                                </Text>
                            </View>

                            <Pressable
                                className={clsx(
                                    'auth-button',
                                    (!isValidForm || isSubmitting) && 'auth-button-disabled',
                                )}
                                onPress={handleSubmit}
                                disabled={!isValidForm || isSubmitting}
                                accessibilityRole="button"
                                accessibilityLabel={
                                    mode === 'create' ? 'Create subscription' : 'Save changes'
                                }
                            >
                                <Text className="auth-button-text">
                                    {isSubmitting
                                        ? 'Saving...'
                                        : mode === 'create'
                                          ? 'Create Subscription'
                                          : 'Save Changes'}
                                </Text>
                            </Pressable>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default CreateSubscriptionModal;
