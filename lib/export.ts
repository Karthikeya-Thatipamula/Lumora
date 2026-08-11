import { buildSubscriptionsCsv, exportFileName } from '@/lib/csv';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type ExportResult = { ok: true } | { ok: false; reason: 'empty' | 'unavailable' | 'failed' };

async function exportOnWeb(csv: string, fileName: string): Promise<ExportResult> {
    if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') {
        return { ok: false, reason: 'unavailable' };
    }

    // The BOM keeps Excel from mangling non-ASCII subscription names.
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    try {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        return { ok: true };
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Writes the export to a shareable file and opens the system share sheet. */
export async function exportSubscriptionsCsv(subscriptions: Subscription[]): Promise<ExportResult> {
    if (subscriptions.length === 0) return { ok: false, reason: 'empty' };

    const csv = buildSubscriptionsCsv(subscriptions);
    const fileName = exportFileName();

    try {
        if (Platform.OS === 'web') return await exportOnWeb(csv, fileName);

        // Imported lazily so web bundles never touch the native filesystem module.
        const { File, Paths } = await import('expo-file-system');

        const file = new File(Paths.cache, fileName);
        file.create({ overwrite: true });
        file.write(csv);

        if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'unavailable' };

        await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            UTI: 'public.comma-separated-values-text',
            dialogTitle: 'Export Lumora subscriptions',
        });

        return { ok: true };
    } catch (error) {
        console.error('CSV export failed:', error);
        return { ok: false, reason: 'failed' };
    }
}
