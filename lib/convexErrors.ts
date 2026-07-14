export function getConvexErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function isMissingConvexFunctionError(error: unknown): boolean {
    return getConvexErrorMessage(error).includes('Could not find public function');
}

export function logConvexQueryError(label: string, error: unknown) {
    const message = getConvexErrorMessage(error);

    if (isMissingConvexFunctionError(error)) {
        console.warn(`${label}: Convex backend is missing this function. Run \`npx convex dev\` or deploy the current convex/ functions.`, message);
        return;
    }

    console.warn(`${label}:`, message);
}
