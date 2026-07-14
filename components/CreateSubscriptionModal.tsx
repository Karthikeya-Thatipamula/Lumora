import { View, Text, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import {posthog} from "@/src/config/posthog";
import { useThemeColors } from '@/lib/useThemeColors';

export type Frequency = 'Monthly' | 'Yearly';
export type Category = 'Entertainment' | 'AI Tools' | 'Developer Tools' | 'Design' | 'Productivity' | 'Other';
export const CATEGORIES: Category[] = ['Entertainment', 'AI Tools', 'Developer Tools', 'Design', 'Productivity', 'Other'];
export const CATEGORY_COLORS: Record<Category, string> = {
    'Entertainment': '#ff6b6b',
    'AI Tools': '#b8d4e3',
    'Developer Tools': '#e8def8',
    'Design': '#f5c542',
    'Productivity': '#95e1d3',
    'Other': '#d4d4d4',
};

export interface SubscriptionFormValues {
    name: string;
    price: number;
    frequency: Frequency;
    category: Category;
}

interface CreateSubscriptionModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (values: SubscriptionFormValues) => void | Promise<void>;
    initialValues?: SubscriptionFormValues;
    mode?: 'create' | 'edit';
}

const CreateSubscriptionModal = ({ visible, onClose, onSubmit, initialValues, mode = 'create' }: CreateSubscriptionModalProps) => {
    const themeColors = useThemeColors();
    const [name, setName] = useState(initialValues?.name ?? '');
    const [price, setPrice] = useState(initialValues ? String(initialValues.price) : '');
    const [frequency, setFrequency] = useState<Frequency>(initialValues?.frequency ?? 'Monthly');
    const [category, setCategory] = useState<Category>(initialValues?.category ?? 'Other');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset the form to the current initialValues whenever the modal opens
    useEffect(() => {
        if (visible) {
            setName(initialValues?.name ?? '');
            setPrice(initialValues ? String(initialValues.price) : '');
            setFrequency(initialValues?.frequency ?? 'Monthly');
            setCategory(initialValues?.category ?? 'Other');
        }
    }, [visible, initialValues]);

    // Improved price validation
    const isValidPrice = () => {
        const trimmedPrice = price.trim();
        if (!trimmedPrice) return false;
        // Strict numeric pattern check
        if (!/^\s*[+-]?(\d+(\.\d+)?|\.\d+)\s*$/.test(trimmedPrice)) return false;
        const numValue = Number(trimmedPrice);
        return Number.isFinite(numValue) && numValue > 0;
    };

    const isValidForm = name.trim() !== '' && isValidPrice();

    const handleSubmit = async () => {
        if (!isValidForm || isSubmitting) return;

        const trimmedName = name.trim();
        const priceValue = Number(price.trim());

        setIsSubmitting(true);
        try {
            await onSubmit({ name: trimmedName, price: priceValue, frequency, category });

            posthog.capture(mode === 'create' ? 'subscription_created' : 'subscription_edited', {
                subscription_name: trimmedName,
                subscription_price: priceValue,
                subscription_frequency: frequency,
                subscription_category: category,
            });

            if (mode === 'create') resetForm();
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setName('');
        setPrice('');
        setFrequency('Monthly');
        setCategory('Other');
    };

    const handleClose = () => {
        if (mode === 'create') resetForm();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
                keyboardVerticalOffset={0}
            >
                <Pressable className="modal-overlay" onPress={handleClose}>
                    <Pressable className="modal-container" onPress={(e) => e.stopPropagation()}>
                        <View className="modal-header">
                            <Text className="modal-title">{mode === 'create' ? 'New Subscription' : 'Edit Subscription'}</Text>
                            <Pressable className="modal-close" onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close">
                                <Text className="modal-close-text">✕</Text>
                            </Pressable>
                        </View>

                        <ScrollView
                            className="p-5"
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ gap: 20, paddingBottom: 20 }}
                        >
                            <View className="auth-field">
                                <Text className="auth-label">Name</Text>
                                <TextInput
                                    className="auth-input"
                                    placeholder="Subscription name"
                                    placeholderTextColor={themeColors.placeholder}
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>

                            <View className="auth-field">
                                <Text className="auth-label">Price</Text>
                                <TextInput
                                    className="auth-input"
                                    placeholder="0.00"
                                    placeholderTextColor={themeColors.placeholder}
                                    value={price}
                                    onChangeText={setPrice}
                                    keyboardType="decimal-pad"
                                />
                            </View>

                            <View className="auth-field">
                                <Text className="auth-label">Frequency</Text>
                                <View className="picker-row">
                                    <Pressable
                                        className={clsx('picker-option', frequency === 'Monthly' && 'picker-option-active')}
                                        onPress={() => setFrequency('Monthly')}
                                    >
                                        <Text className={clsx('picker-option-text', frequency === 'Monthly' && 'picker-option-text-active')}>
                                            Monthly
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        className={clsx('picker-option', frequency === 'Yearly' && 'picker-option-active')}
                                        onPress={() => setFrequency('Yearly')}
                                    >
                                        <Text className={clsx('picker-option-text', frequency === 'Yearly' && 'picker-option-text-active')}>
                                            Yearly
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View className="auth-field">
                                <Text className="auth-label">Category</Text>
                                <View className="category-scroll">
                                    {CATEGORIES.map((cat) => (
                                        <Pressable
                                            key={cat}
                                            className={clsx('category-chip', category === cat && 'category-chip-active')}
                                            onPress={() => setCategory(cat)}
                                        >
                                            <Text className={clsx('category-chip-text', category === cat && 'category-chip-text-active')}>
                                                {cat}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <Pressable
                                className={clsx('auth-button', (!isValidForm || isSubmitting) && 'auth-button-disabled')}
                                onPress={handleSubmit}
                                disabled={!isValidForm || isSubmitting}
                                accessibilityRole="button"
                                accessibilityLabel={mode === 'create' ? 'Create subscription' : 'Save changes'}
                            >
                                <Text className="auth-button-text">{isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Subscription' : 'Save Changes'}</Text>
                            </Pressable>
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default CreateSubscriptionModal;
