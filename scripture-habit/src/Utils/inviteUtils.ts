export const generateInviteCode = (length = 10): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 characters (uniform distribution for 256 % 32)
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
};
