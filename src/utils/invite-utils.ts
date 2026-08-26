/**
 * Utility functions for managing group links.
 */


/**
 * Formats a full invite URL for sharing.
 * 
 * @param code The invite code
 * @param language The current language code (optional)
 * @returns A full URL string
 */
export const formatInviteLink = (code: string): string => {
  const base = window.location.origin;
  // We no longer prefix with language to allow auto-detection for the recipient
  return `${base}/join/${code.trim().toUpperCase()}?openExternalBrowser=1`;
};
