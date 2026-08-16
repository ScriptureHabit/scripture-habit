/** Default message TTL: 30 days */
const MESSAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Demo session TTL: 1 hour */
export const DEMO_TTL_MS = 1 * 60 * 60 * 1000;

/**
 * Returns a Date 30 days from now, suitable for Firestore TTL auto-deletion.
 * Add this as `expireAt` on any document that should be auto-cleaned.
 */
export function getMessageExpireAt(now = new Date()): Date {
    return new Date(now.getTime() + MESSAGE_TTL_MS);
}

/**
 * Returns a Date 1 hour from now for ephemeral demo sandbox sessions.
 */
export function getDemoExpireAt(now = new Date()): Date {
    return new Date(now.getTime() + DEMO_TTL_MS);
}
