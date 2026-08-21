import { URL } from 'url';
import dns from 'dns';
import http from 'http';
import https from 'https';
import ipaddr from 'ipaddr.js';

/**
 * SSRF Protection: Checks if a URL matches allowed hosts and is not a private IP.
 */
export function isSafeUrl(urlStr: string): boolean {
    try {
        const parsedUrl = new URL(urlStr);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;

        let hostname = parsedUrl.hostname.toLowerCase();
        if (hostname.startsWith('[') && hostname.endsWith(']')) {
            hostname = hostname.slice(1, -1);
        }

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

/**
 * Checks if an IP address belongs to a private network, loopback, or other unsafe ranges.
 */
export function isPrivateIp(ip: string): boolean {
    try {
        const addr = ipaddr.parse(ip);
        const range = addr.range();

        const blockedRanges = [
            'uniqueLocal', // IPv6 fc00::/7
            'linkLocal',   // IPv6 fe80::/10, IPv4 169.254.0.0/16
            'loopback',    // IPv4 127.0.0.0/8, IPv6 ::1
            'private',     // IPv4 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
            'unspecified', // 0.0.0.0, ::
            'broadcast'    // 255.255.255.255
        ];

        return blockedRanges.includes(range);
    } catch {
        // Safe default: if parsing fails, treat it as unsafe (private)
        return true;
    }
}

/**
 * Custom DNS Lookup Function for SSRF Protection.
 */
export function ssrfSafeLookup(
    hostname: string,
    options: dns.LookupOptions,
    callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => void
): void {
    dns.lookup(hostname, options, (err, address, family) => {
        if (err) {
            return callback(err, address, family);
        }

        const addresses = Array.isArray(address) ? address.map(a => a.address) : [address];
        const hasPrivateIp = addresses.some(ip => isPrivateIp(ip));

        if (hasPrivateIp) {
            const blockError: NodeJS.ErrnoException = new Error('SSRF Prevention: Access to private IP is blocked');
            blockError.code = 'ENOTFOUND';
            const emptyAddress = Array.isArray(address) ? [] : '';
            return callback(blockError, emptyAddress, family);
        }

        callback(null, address, family);
    });
}

export const ssrfSafeHttpAgent = new http.Agent({ lookup: ssrfSafeLookup, keepAlive: false });
export const ssrfSafeHttpsAgent = new https.Agent({ lookup: ssrfSafeLookup, keepAlive: false });

