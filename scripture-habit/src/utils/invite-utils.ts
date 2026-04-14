/**
 * Utility functions for generating invitation codes and managing group links.
 */

/**
 * Generates a cryptographically secure random invitation code.
 * Uses a base32-like alphabet for readability (avoiding lookalikes like 1/I or 0/O).
 * 
 * @param length The length of the code (default 10)
 * @returns A random string of the specified length
 */
export const generateInviteCode = (length = 10): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  
  // Use modulo for uniform distribution across 32 characters
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
};

/**
 * Formats a full invite URL for sharing.
 * 
 * @param code The invite code
 * @param language The current language code (optional)
 * @returns A full URL string
 */
export const formatInviteLink = (code: string, language?: string): string => {
  const base = window.location.origin;
  const prefix = language ? `/${language}` : '';
  return `${base}${prefix}/invite/${code}`;
};
