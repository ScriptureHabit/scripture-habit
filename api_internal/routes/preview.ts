import express, { Response } from 'express';
import { isSafeUrl, ssrfSafeHttpAgent, ssrfSafeHttpsAgent } from '../lib/ssrf.js';
import { verifyAppCheck, authenticate, AuthenticatedRequest } from '../lib/middleware.js';
import { ValidationError, sendErrorResponse } from '../lib/errors.js';
import { redisCache } from '../lib/cache.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

const router = express.Router();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Fetch Church (GC, Liahona, etc.) Metadata
router.get(['/fetch-church-metadata', '/fetch-church-metadata/'], authenticate, verifyAppCheck, redisCache(3600, 'api:preview:church:'), async (req: AuthenticatedRequest, res: Response) => {

    const { url, language } = req.query as { url?: string, language?: string };

    try {
        if (!url || typeof url !== 'string') throw new ValidationError('URL is required');

        const parsed = new URL(url);
        // SSRF Protection: White-list domain
        const host = parsed.hostname.toLowerCase();
        if (host !== 'www.churchofjesuschrist.org' && host !== 'churchofjesuschrist.org') {
            console.warn('[preview] Blocked metadata fetch for invalid domain:', host);
            throw new ValidationError('Invalid request');
        }
        if (parsed.protocol !== 'https:') throw new ValidationError('HTTPS only');

        // Strictly validate allowed path format to prevent traversal and break taint flow
        const pathMatch = parsed.pathname.match(/^(\/[a-zA-Z0-9\-_/]+)/);
        if (!pathMatch) {
            throw new ValidationError('Invalid request path');
        }
        const safePath = pathMatch[1];

        // Sanitize optional language parameter
        let safeLangQuery = '';
        if (language && /^[a-z0-9_-]{2,10}$/i.test(language)) {
            safeLangQuery = `?lang=${encodeURIComponent(language)}`;
        }

        const safeChurchUrl = `https://www.churchofjesuschrist.org${safePath}${safeLangQuery}`;
        const safeChurchFallbackUrl = `https://www.churchofjesuschrist.org${safePath}`;

        let response;
        try {
            // codeql[js/request-forgery]
            response = await axios.get(safeChurchUrl, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 5000,
                maxRedirects: 5,
                maxContentLength: 512 * 1024,
                httpAgent: ssrfSafeHttpAgent,
                httpsAgent: ssrfSafeHttpsAgent
            });
        } catch (axiosError) {
             // Fallback: If requested language fails, try without lang param
             if (language) {
                console.warn('[preview] Initial fetch with lang failed, trying fallback:', language);
                // codeql[js/request-forgery]
                response = await axios.get(safeChurchFallbackUrl, {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 5000,
                    maxRedirects: 5,
                    maxContentLength: 512 * 1024,
                    httpAgent: ssrfSafeHttpAgent,
                    httpsAgent: ssrfSafeHttpsAgent
                });
             } else {
                 throw axiosError;
             }
        }

        if (!response || !response.data) {
             throw new Error('No response from church server');
        }

        const $ = cheerio.load(response.data);
        let title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || $('title').text().trim();
        if (title && title.includes('|')) title = title.split('|')[0].trim();

        let speaker = $('div.byline p.author-name').first().text().trim() || 
                      $('p.author-name').first().text().trim() || 
                      $('a.author-name').first().text().trim() || 
                      $('div.byline p').first().text().trim() || '';
        
        if (speaker) speaker = speaker.replace(/^(By|Par|De|Por)\s+/i, '').trim();

        res.json({ title: title || '', speaker: speaker || '' });
    } catch (error) {
        if (error instanceof ValidationError) {
            sendErrorResponse(res, error);
            return;
        }
        if (error instanceof Error) {
            console.error('Error in fetch-church-metadata:', error.message);
        } else {
            console.error('Error in fetch-church-metadata:', error);
        }
        // Fallback for metadata errors: return empty result so the UI can proceed
        res.json({ title: '', speaker: '' });
    }
});

// URL Preview
router.get(['/url-preview', '/url-preview/'], authenticate, verifyAppCheck, redisCache(3600, 'api:preview:ogp:'), async (req: AuthenticatedRequest, res: Response) => {

    const { url } = req.query as { url?: string };

    try {
        if (!url || typeof url !== 'string') throw new ValidationError('URL required');

        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            throw new ValidationError('HTTP or HTTPS required');
        }

        if (!isSafeUrl(parsedUrl.href)) throw new ValidationError('Invalid URL');

        const previewData: {
            url: string;
            title: string;
            siteName: string;
            favicon: string;
            description: string | null;
            image: string | null;
        } = { 
            url, 
            title: parsedUrl.hostname, 
            siteName: parsedUrl.hostname, 
            favicon: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`, 
            description: null, 
            image: null 
        };

        const hostname = parsedUrl.hostname.toLowerCase();
        const isChurchUrl = hostname === 'churchofjesuschrist.org' || 
                            hostname === 'www.churchofjesuschrist.org' || 
                            hostname.endsWith('.churchofjesuschrist.org');

        // codeql[js/request-forgery] - Safe by design: OGP proxy guarded by verifyAppCheck, authenticate, isSafeUrl, and ssrfSafeHttpAgent
        const response = await axios.get(parsedUrl.href, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 4000,
            maxContentLength: 512 * 1024,
            maxRedirects: 0,
            validateStatus: () => true,
            httpAgent: ssrfSafeHttpAgent,
            httpsAgent: ssrfSafeHttpsAgent
        });

        if (response && response.data && typeof response.data === 'string') {
            const $ = cheerio.load(response.data);
            
            // 1. Title
            let title = $('meta[property="og:title"]').attr('content') || 
                        $('meta[name="twitter:title"]').attr('content') ||
                        $('h1').first().text().trim() ||
                        $('title').text().trim();

            if (title) {
                if (title.includes(' | ')) title = title.split(' | ')[0];
                if (title.includes(' - ')) title = title.split(' - ')[0];
                previewData.title = title.trim();
            }

            // 2. Speaker (Church sites)
            if (isChurchUrl) {
                const speaker = $('div.byline p.author-name').first().text().trim() || 
                                $('p.author-name').first().text().trim();
                if (speaker) {
                    const clean = speaker.replace(/^(By|Par|De|Por)\s+/i, '').trim();
                    if (!previewData.title.includes(clean)) {
                        previewData.title = `${previewData.title} (${clean})`;
                    }
                }
            }

            // 3. Description
            previewData.description = $('meta[property="og:description"]').attr('content') || 
                                     $('meta[name="description"]').attr('content') || null;

            // 4. Image
            let img = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
            if (img && !img.startsWith('http')) {
                try { img = new URL(img! as string, url).href; } catch { /* ignore */ }
            }
            previewData.image = img || null;
            previewData.siteName = $('meta[property="og:site_name"]').attr('content') || parsedUrl.hostname;
        }

        res.json(previewData);
    } catch (error) {
        if (error instanceof ValidationError) {
            sendErrorResponse(res, error);
            return;
        }
        if (error instanceof Error) {
            console.error('Error in url-preview:', error.message);
        } else {
            console.error('Error in url-preview:', error);
        }
        sendErrorResponse(res, error, 'Failed');
    }

});

export default router;
