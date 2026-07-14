import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";

export function useUserSettings() {
    const settings = useQuery(api.userSettings.get);
    const updateMutation = useMutation(api.userSettings.update);

    return {
        monthlyBudget: settings?.monthlyBudget,
        reminderDaysBefore: settings?.reminderDaysBefore ?? 3,
        notificationsEnabled: settings?.notificationsEnabled ?? true,
        isLoading: settings === undefined,
        updateSettings: updateMutation,
    };
}
