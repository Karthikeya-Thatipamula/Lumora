import '@/global.css';
import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
    const { isSignedIn, isLoaded } = useAuth();

    // Wait for auth to load
    if (!isLoaded) {
        return null;
    }

    // If already signed in, redirect to tabs
    if (isSignedIn) {
        return <Redirect href="/(tabs)" />;
    }

    // Show auth stack
    return <Stack screenOptions={{ headerShown: false }} />;
}