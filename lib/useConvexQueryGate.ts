import { useAuth } from '@clerk/expo';
import { useConvexAuth } from 'convex/react';

/**
 * Whether it is safe to run a Convex query yet.
 *
 * Auth resolves in two stages: Clerk loads a session, then Convex exchanges and validates
 * that session's JWT. Convex rejects every query until the second stage completes, so a
 * query fired after `isSignedIn` alone will fail. Both stages have to be clear.
 *
 * Every `useQuery` in the app passes `canQuery ? args : 'skip'`.
 *
 * This lived in useSubscriptions.ts and was copy-pasted verbatim into useUserSettings.ts,
 * which is precisely the kind of duplication that drifts — one copy gets a fix and the
 * other silently keeps firing queries into an unauthenticated client.
 */
export function useConvexQueryGate() {
    const { isLoaded, isSignedIn } = useAuth();
    const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();

    return {
        canQuery: isLoaded && Boolean(isSignedIn) && !isConvexAuthLoading && isAuthenticated,
        // Distinguishes "still establishing the session" from "signed out": only the
        // former should keep a spinner on screen.
        isAuthResolving: !isLoaded || (Boolean(isSignedIn) && isConvexAuthLoading),
    };
}
