import { SafeAreaView } from '@/components/SafeAreaView';
import { AnimatedView } from '@/components/motion/Animated';
import PressableScale from '@/components/motion/PressableScale';
import { findImportDuplicates, ImportResult, parseSubscriptionsCsv } from '@/lib/csvImport';
import { alertDialog, confirmDialog } from '@/lib/dialogs';
import { safeBack } from '@/lib/navigation';
import { useSubscriptions } from '@/lib/useSubscriptions';
import { useThemeColors } from '@/lib/useThemeColors';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FadeIn } from 'react-native-reanimated';

const SAMPLE = `Name,Price,Billing,Category,Currency
Netflix,15.49,Monthly,Entertainment,USD
Spotify,11.99,Monthly,Entertainment,USD`;

const Import = () => {
    const router = useRouter();
    const posthog = usePostHog();
    const themeColors = useThemeColors();
    const { subscriptions, importSubscriptions } = useSubscriptions();

    const [text, setText] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    const result: ImportResult | null = useMemo(
        () => (text.trim() ? parseSubscriptionsCsv(text) : null),
        [text],
    );

    const duplicates = useMemo(
        () =>
            result
                ? findImportDuplicates(
                      result.rows,
                      subscriptions.map((s) => s.name),
                  )
                : new Set<string>(),
        [result, subscriptions],
    );

    const handleImport = async () => {
        if (!result || result.rows.length === 0) return;

        if (duplicates.size > 0) {
            const proceed = await confirmDialog({
                title: `${duplicates.size} already tracked`,
                message: `${Array.from(duplicates).slice(0, 3).join(', ')}${duplicates.size > 3 ? '…' : ''} already exist. Importing will create a second copy of each.`,
                confirmText: 'Import anyway',
                cancelText: 'Cancel',
            });
            if (!proceed) return;
        }

        setIsImporting(true);
        try {
            const { imported, failed } = await importSubscriptions(
                result.rows.map((row) => row.values),
            );
            posthog.capture('subscriptions_imported', { imported, failed: failed.length });

            if (failed.length > 0) {
                alertDialog(
                    `Imported ${imported} of ${result.rows.length}`,
                    `${failed.length} couldn't be saved: ${failed
                        .slice(0, 3)
                        .map((f) => f.name)
                        .join(', ')}.`,
                );
            } else {
                alertDialog(
                    'Import complete',
                    `${imported} subscription${imported === 1 ? '' : 's'} added.`,
                );
            }

            setText('');
            safeBack(router, '/(tabs)/subscriptions');
        } catch (error) {
            console.error('Import failed:', error);
            alertDialog(
                'Import failed',
                'Nothing was changed. Please check the data and try again.',
            );
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <View className="flex-row items-center justify-between px-5 py-4">
                <Pressable
                    onPress={() => safeBack(router, '/(tabs)/settings')}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    hitSlop={12}
                >
                    <Text className="text-2xl text-primary">‹</Text>
                </Pressable>
                <Text className="text-lg font-sans-bold text-primary">Import</Text>
                <View className="w-6" />
            </View>

            <ScrollView
                className="flex-1 px-5"
                contentContainerStyle={{ gap: 16, paddingBottom: 48 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Text className="text-sm font-sans-medium text-muted-foreground">
                    Moving from another tracker or a spreadsheet? Export it as CSV, then paste it
                    here. Lumora reads the columns it recognises and tells you about anything it
                    can&apos;t.
                </Text>

                <View className="auth-field">
                    <Text className="auth-label">CSV data</Text>
                    <TextInput
                        className="auth-input"
                        style={{ minHeight: 160, textAlignVertical: 'top' }}
                        placeholder={SAMPLE}
                        placeholderTextColor={themeColors.placeholder}
                        value={text}
                        onChangeText={setText}
                        multiline
                        autoCapitalize="none"
                        autoCorrect={false}
                        accessibilityLabel="Paste CSV data"
                    />
                    <Text className="text-xs font-sans-medium text-muted-foreground">
                        Needs at least a Name and Price column. Billing, Category, Currency and
                        Payment method are used when present.
                    </Text>
                </View>

                {result && (
                    <AnimatedView entering={FadeIn.duration(200)} className="auth-card gap-3">
                        <Text className="text-base font-sans-semibold text-primary">
                            {result.rows.length} ready to import
                        </Text>

                        {result.rows.slice(0, 5).map((row, index) => (
                            <View
                                key={`${row.values.name}-${index}`}
                                className="flex-row items-center justify-between gap-3"
                            >
                                <Text
                                    className="flex-1 text-sm font-sans-medium text-primary"
                                    numberOfLines={1}
                                >
                                    {row.values.name}
                                    {duplicates.has(row.values.name) && (
                                        <Text className="text-xs font-sans-semibold text-accent">
                                            {' '}
                                            · already tracked
                                        </Text>
                                    )}
                                </Text>
                                <Text className="text-sm font-sans-semibold text-muted-foreground">
                                    {row.values.price.toFixed(2)} {row.values.frequency}
                                </Text>
                            </View>
                        ))}

                        {result.rows.length > 5 && (
                            <Text className="text-xs font-sans-medium text-muted-foreground">
                                …and {result.rows.length - 5} more
                            </Text>
                        )}

                        {result.errors.length > 0 && (
                            <View className="gap-1 rounded-2xl border border-destructive/30 bg-destructive/10 p-3">
                                <Text className="text-xs font-sans-bold text-destructive">
                                    {result.errors.length} row
                                    {result.errors.length === 1 ? '' : 's'} skipped
                                </Text>
                                {result.errors.slice(0, 4).map((error) => (
                                    <Text
                                        key={error.line}
                                        className="text-xs font-sans-medium text-destructive"
                                    >
                                        Line {error.line}: {error.reason}
                                    </Text>
                                ))}
                            </View>
                        )}

                        <PressableScale
                            className={`auth-button ${(result.rows.length === 0 || isImporting) && 'auth-button-disabled'}`}
                            onPress={handleImport}
                            disabled={result.rows.length === 0 || isImporting}
                            accessibilityRole="button"
                            accessibilityLabel={`Import ${result.rows.length} subscriptions`}
                        >
                            {isImporting ? (
                                <ActivityIndicator color="#081126" />
                            ) : (
                                <Text className="auth-button-text">
                                    Import {result.rows.length}
                                </Text>
                            )}
                        </PressableScale>
                    </AnimatedView>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default Import;
