import { describe, it, expect } from 'vitest';
import { isSafeUrl } from './ssrf';

describe('ssrf - isSafeUrl', () => {
    it('should return false for invalid URLs or unsupported protocols', () => {
        expect(isSafeUrl('not-a-url')).toBe(false);
        expect(isSafeUrl('ftp://example.com')).toBe(false);
        expect(isSafeUrl('file:///etc/passwd')).toBe(false);
        expect(isSafeUrl('gopher://example.com')).toBe(false);
    });

    it('should return false for local and loopback addresses', () => {
        expect(isSafeUrl('http://localhost')).toBe(false);
        expect(isSafeUrl('http://127.0.0.1')).toBe(false);
        expect(isSafeUrl('http://127.255.255.255')).toBe(false);
        expect(isSafeUrl('http://[::1]')).toBe(false);
    });

    it('should return false for private IP ranges', () => {
        // Class A private network
        expect(isSafeUrl('http://10.0.0.1')).toBe(false);
        expect(isSafeUrl('https://10.255.255.255/path')).toBe(false);

        // Class B private network
        expect(isSafeUrl('http://172.16.0.1')).toBe(false);
        expect(isSafeUrl('http://172.25.12.34')).toBe(false);
        expect(isSafeUrl('http://172.31.255.255')).toBe(false);
        // But 172.32.0.1 should be allowed as it is outside Class B private range
        expect(isSafeUrl('http://172.32.0.1')).toBe(true);

        // Class C private network
        expect(isSafeUrl('http://192.168.0.1')).toBe(false);
        expect(isSafeUrl('https://192.168.100.150/test')).toBe(false);
    });

    it('should return false for cloud metadata services', () => {
        expect(isSafeUrl('http://169.254.169.254')).toBe(false);
        expect(isSafeUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    });

    it('should return false for local domains', () => {
        expect(isSafeUrl('http://myhost.local')).toBe(false);
        expect(isSafeUrl('http://database.internal')).toBe(false);
    });

    it('should return true for valid public web URLs', () => {
        expect(isSafeUrl('http://example.com')).toBe(true);
        expect(isSafeUrl('https://example.com/some/path?query=1')).toBe(true);
        expect(isSafeUrl('https://scripturehabit.app')).toBe(true);
        expect(isSafeUrl('https://github.com')).toBe(true);
    });
});
