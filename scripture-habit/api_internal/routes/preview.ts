import express, { Response } from 'express';
import { isSafeUrl } from '../lib/ssrf.js';
import { verifyAppCheck, authenticate, AuthenticatedRequest } from '../lib/middleware.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

const router = express.Router();

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Fetch Church (GC, Liahona, etc.) Metadata
router.get(['/fetch-church-metadata', '/fetch-church-metadata/'], authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {

    const { url, lang } = req.query as { url?: string, lang?: string };
    if (!url) return res.status(400).send({ error: 'URL is required' });

    try {
        const targetUrl = new URL(url);
        // SSRF Protection: White-list domain
        if (targetUrl.hostname !== 'www.churchofjesuschrist.org' && targetUrl.hostname !== 'churchofjesuschrist.org') {
            console.warn(`Blocked metadata fetch for invalid domain: ${targetUrl.hostname}`);
            return res.status(400).json({ error: 'Invalid request' });
        }
        if (targetUrl.protocol !== 'https:') return res.status(400).json({ error: 'HTTPS only' });

        if (lang) targetUrl.searchParams.set('lang', lang);

        let response;
        try {
            response = await axios.get(targetUrl.toString(), {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 5000,
                maxRedirects: 5,
                maxContentLength: 512 * 1024
            });
        } catch (axiosError) {
             // Fallback: If requested language fails, try without lang param
             if (lang) {
                console.warn(`Initial fetch with lang=${lang} failed, trying fallback...`);
                targetUrl.searchParams.delete('lang');
                response = await axios.get(targetUrl.toString(), {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 5000,
                    maxRedirects: 5,
                    maxContentLength: 512 * 1024
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
router.get(['/url-preview', '/url-preview/'], authenticate, verifyAppCheck, async (req: AuthenticatedRequest, res: Response) => {

    const { url } = req.query as { url?: string };
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL required' });

    if (!isSafeUrl(url)) return res.status(400).json({ error: 'Invalid URL' });

    try {
        const parsedUrl = new URL(url);
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

        const isChurchUrl = parsedUrl.hostname.includes('churchofjesuschrist.org');

        const response = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 4000,
            maxContentLength: 512 * 1024,
            maxRedirects: 0,
            validateStatus: () => true
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
                try { img = new URL(img! as string, url).href; } catch (e) { }
            }
            previewData.image = img || null;
            previewData.siteName = $('meta[property="og:site_name"]').attr('content') || parsedUrl.hostname;
        }

        res.json(previewData);
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error in url-preview:', error.message);
        } else {
            console.error('Error in url-preview:', error);
        }
        res.status(500).json({ error: 'Failed' });
    }

});

export default router;
