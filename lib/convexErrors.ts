export function getConvexErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * True when the deployed Convex backend doesn't have the function the client called —
 * almost always a fresh clone that hasn't run `npx convex dev` yet, which deserves a
 * setup hint rather than a generic error.
 */
export function isMissingConvexFunctionError(error: unknown): boolean {
    return getConvexErrorMessage(error).includes('Could not find public function');
}
