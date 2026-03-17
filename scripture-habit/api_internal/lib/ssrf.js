import { URL } from 'url';

/**
 * SSRF対策: 許可されないホスト名やプライベートIPをチェックします。
 */
export function isSafeUrl(urlStr) {
    try {
        const parsedUrl = new URL(urlStr);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;

        const hostname = parsedUrl.hostname.toLowerCase();

        // ブラックリスト: プライベートネットワークおよびメタデータサービス
        const blockedPatterns = [
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
    } catch (e) {
        return false;
    }
}
