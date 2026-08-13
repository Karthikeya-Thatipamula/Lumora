import { useUser } from '@clerk/expo';

/**
 * The name to greet the signed-in user by.
 *
 * Clerk populates these fields differently depending on how the account was created —
 * an email/password signup has no first name, a social login usually does — so the
 * fallback chain matters and was duplicated verbatim on Home and Settings.
 */
export function useDisplayName(): string {
    const { user } = useUser();

    return user?.firstName || user?.fullName || user?.emailAddresses[0]?.emailAddress || 'User';
}
