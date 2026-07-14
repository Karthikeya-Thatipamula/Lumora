import { api } from "@/convex/_generated/api";
import { logConvexQueryError } from "@/lib/convexErrors";
import { useConvex, useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";

type UserSettingsPatch = {
    monthlyBudget?: number;
    reminderDaysBefore?: number;
    notificationsEnabled?: boolean;
};

export function useUserSettings() {
    const convex = useConvex();
    const updateMutation = useMutation(api.userSettings.update);
    const [settings, setSettings] = useState<UserSettingsPatch | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshToken, setRefreshToken] = useState(0);

    const refreshSettings = useCallback(() => {
        setRefreshToken((token) => token + 1);
    }, []);

    useEffect(() => {
        let isMounted = true;

        setIsLoading(true);
        convex
            .query(api.userSettings.get, {})
            .then((doc) => {
                if (!isMounted) return;
                setSettings(doc ?? null);
            })
            .catch((error) => {
                if (!isMounted) return;
                logConvexQueryError('Load user settings', error);
                setSettings(null);
            })
            .finally(() => isMounted && setIsLoading(false));

        return () => {
            isMounted = false;
        };
    }, [convex, refreshToken]);

    const updateSettings = async (patch: UserSettingsPatch) => {
        setSettings((current) => ({ ...(current ?? {}), ...patch }));
        const result = await updateMutation(patch);
        refreshSettings();
        return result;
    };

    return {
        monthlyBudget: settings?.monthlyBudget,
        reminderDaysBefore: settings?.reminderDaysBefore ?? 3,
        notificationsEnabled: settings?.notificationsEnabled ?? true,
        isLoading,
        updateSettings,
    };
}
