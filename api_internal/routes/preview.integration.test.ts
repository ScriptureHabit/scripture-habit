import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { TestSetup } from '../test-setup.js';
import axios from 'axios';

describe('Preview Route Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();
    const USER_ID = 'PREVIEW_USER';

    beforeAll(async () => {
        await setup.start();
    });

    afterAll(async () => {
        await setup.stop();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.spyOn(axios, 'create').mockReturnValue({
            get: vi.fn().mockImplementation((url, config) => axios.get(url, config))
        } as any);
    });

    describe('GET /fetch-church-metadata', () => {
        it('should return 401 if unauthenticated', async () => {
            const res = await fetch(`${setup.baseUrl}/api/preview/fetch-church-metadata?url=https://churchofjesuschrist.org`);
            expect(res.status).toBe(401);
        });

        it('should return 400 if url is missing', async () => {
            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/fetch-church-metadata`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('URL is required');
        });

        it('should return 400 if domain is blocked', async () => {
            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/fetch-church-metadata?url=https://google.com`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('Invalid request');
        });

        it('should return 400 if protocol is not HTTPS', async () => {
            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/fetch-church-metadata?url=http://churchofjesuschrist.org`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('HTTPS only');
        });

        it('should fetch and parse church metadata successfully', async () => {
            const mockHtml = `
                <html>
                    <head>
                        <meta property="og:title" content="Faith in Jesus Christ | Ensign" />
                    </head>
                    <body>
                        <div class="byline">
                            <p class="author-name">By Elder Dieter F. Uchtdorf</p>
                        </div>
                    </body>
                </html>
            `;
            const axiosSpy = vi.spyOn(axios, 'get').mockResolvedValue({ data: mockHtml });

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/fetch-church-metadata?url=https://churchofjesuschrist.org/study/ensign/2020/04/faith-success`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.title).toBe('Faith in Jesus Christ');
            expect(data.speaker).toBe('Elder Dieter F. Uchtdorf');
            expect(axiosSpy).toHaveBeenCalled();
        });

        it('should fall back to fetch without lang query parameter if initial fetch with lang fails', async () => {
            const mockHtml = `
                <html>
                    <head>
                        <title>Some Title | Liahona</title>
                    </head>
                    <body>
                        <p class="author-name">Elder Jeffrey R. Holland</p>
                    </body>
                </html>
            `;
            let callCount = 0;
            vi.spyOn(axios, 'get').mockImplementation(async (url, config) => {
                callCount++;
                if ((config as any)?.params?.lang === 'ja' || (typeof url === 'string' && url.includes('lang=ja'))) {
                    throw new Error('Language not supported');
                }
                return { data: mockHtml };
            });

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/fetch-church-metadata?url=https://churchofjesuschrist.org/study/ensign/2020/04/faith-fallback&language=ja`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.title).toBe('Some Title');
            expect(data.speaker).toBe('Elder Jeffrey R. Holland');
            expect(callCount).toBe(2);
        });

        it('should return empty title and speaker on general fetch error', async () => {
            vi.spyOn(axios, 'get').mockRejectedValue(new Error('Network offline'));

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/fetch-church-metadata?url=https://churchofjesuschrist.org/study/ensign/2020/04/faith-error`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.title).toBe('');
            expect(data.speaker).toBe('');
        });

        it('should return empty title and speaker on empty response', async () => {
            vi.spyOn(axios, 'get').mockResolvedValue({});

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/fetch-church-metadata?url=https://churchofjesuschrist.org/study/ensign/2020/04/faith-empty`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.title).toBe('');
            expect(data.speaker).toBe('');
        });
    });

    describe('GET /url-preview', () => {
        it('should return 401 if unauthenticated', async () => {
            const res = await fetch(`${setup.baseUrl}/api/preview/url-preview?url=https://example.com`);
            expect(res.status).toBe(401);
        });

        it('should return 400 if url is missing', async () => {
            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/url-preview`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('URL required');
        });

        it('should return 400 if URL is unsafe', async () => {
            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/url-preview?url=http://127.0.0.1`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('Invalid URL');
        });

        it('should successfully get URL preview with standard HTML', async () => {
            const mockHtml = `
                <html>
                    <head>
                        <meta property="og:title" content="My Cool Website | Awesome" />
                        <meta name="description" content="A description of my cool website" />
                        <meta name="twitter:image" content="/images/logo.png" />
                        <meta property="og:site_name" content="CoolSite" />
                    </head>
                    <body>
                    </body>
                </html>
            `;
            vi.spyOn(axios, 'get').mockResolvedValue({ data: mockHtml });

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/url-preview?url=https://coolwebsite.com/blog/123`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.title).toBe('My Cool Website');
            expect(data.siteName).toBe('CoolSite');
            expect(data.favicon).toBe('https://www.google.com/s2/favicons?domain=coolwebsite.com&sz=64');
            expect(data.description).toBe('A description of my cool website');
            expect(data.image).toBe('https://coolwebsite.com/images/logo.png');
        });

        it('should include speaker in title for church website URL preview', async () => {
            const mockHtml = `
                <html>
                    <head>
                        <meta property="og:title" content="Becoming Like Him" />
                        <meta name="description" content="LDS General Conference Talk" />
                        <meta property="og:image" content="https://churchofjesuschrist.org/hero.jpg" />
                    </head>
                    <body>
                        <p class="author-name">Elder Gerrit W. Gong</p>
                    </body>
                </html>
            `;
            vi.spyOn(axios, 'get').mockResolvedValue({ data: mockHtml });

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/url-preview?url=https://churchofjesuschrist.org/study/general-conference/2020/04/gong`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.title).toBe('Becoming Like Him (Elder Gerrit W. Gong)');
            expect(data.image).toBe('https://churchofjesuschrist.org/hero.jpg');
        });

        it('should return 500 on fetch failure', async () => {
            vi.spyOn(axios, 'get').mockRejectedValue(new Error('DNS resolution failed'));

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/preview/url-preview?url=https://example.com`, {
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('DNS resolution failed');
        });
    });
});
