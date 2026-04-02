import { URL } from 'url';

/**
 * SSRF Protection: Checks if a URL matches allowed hosts and is not a private IP.
 */
export function isSafeUrl(urlStr: string): boolean {
    try {
        const parsedUrl = new URL(urlStr);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;

        const hostname = parsedUrl.hostname.toLowerCase();

        // Blocklist: Private networks and metadata services
        const blockedPatterns: (string | RegExp)[] = [
            'localhost',
            '::1',
            /^127\./,
            /^169\.254\./,
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
            /^192\.168\./,
            /^fe80:/,
            /^fc00:/,
            /^fd00:/,
            /\.internal$/,
            /\.local$/
        ];

        return !blockedPatterns.some(pattern => {
            if (typeof pattern === 'string') return hostname === pattern;
            return pattern.test(hostname);
        });
    } catch {
        return false;
    }
}
