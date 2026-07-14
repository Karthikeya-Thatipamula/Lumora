import '@/global.css';
import { getHasOnboarded } from '@/lib/onboarding';
import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from 'react';

export default function AuthLayout() {
    const { isSignedIn, isLoaded } = useAuth();
    const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

    useEffect(() => {
        getHasOnboarded().then(setHasOnboarded);
    }, []);

    // Wait for auth to load
    if (!isLoaded) {
        return null;
    }

    // If already signed in, redirect to tabs
    if (isSignedIn) {
        return <Redirect href="/(tabs)" />;
    }

    // Wait for the onboarding flag to load
    if (hasOnboarded === null) {
        return null;
    }

    // First-ever launch: show onboarding before the auth stack
    if (!hasOnboarded) {
        return <Redirect href="/onboarding" />;
    }

    // Show auth stack
    return <Stack screenOptions={{ headerShown: false }} />;
}