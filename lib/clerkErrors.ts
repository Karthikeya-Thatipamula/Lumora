type ClerkErrorLike = {
    errors?: Array<{
        message?: string;
        longMessage?: string;
        code?: string;
    }>;
    message?: string;
};

export function getClerkErrorMessage(error: unknown, fallback: string): string {
    const clerkError = error as ClerkErrorLike | undefined;
    const firstError = clerkError?.errors?.[0];

    return firstError?.longMessage ?? firstError?.message ?? clerkError?.message ?? fallback;
}
