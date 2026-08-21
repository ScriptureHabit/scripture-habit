import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function test() {
    const url = 'https://www.churchofjesuschrist.org/study/general-conference/2021/04/35oaks?lang=jpn';
    const lang = 'jpn';
    const targetUrl = new URL(url);
    if (lang) targetUrl.searchParams.set('lang', lang);

    console.log('Fetching:', targetUrl.toString());

    try {
        let response;
        try {
            response = await axios.get(targetUrl.toString(), {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 10000,
                maxRedirects: 0,
                maxContentLength: 512 * 1024
            });
        } catch (axiosError) {
             console.log('Initial fetch failed, trying fallback...');
             if (lang) {
                targetUrl.searchParams.delete('lang');
                response = await axios.get(targetUrl.toString(), {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 10000
                });
             } else {
                 throw axiosError;
             }
        }

        const $ = cheerio.load(response.data);
        let title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || $('title').text().trim();
        if (title && title.includes('|')) title = title.split('|')[0].trim();

        let speaker = $('div.byline p.author-name').first().text().trim() || 
                      $('p.author-name').first().text().trim() || 
                      $('a.author-name').first().text().trim() || 
                      $('div.byline p').first().text().trim() || '';
        
        if (speaker) speaker = speaker.replace(/^(By|Par|De|Por)\s+/i, '').trim();

        console.log('Result:', { title, speaker });
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        } else {
            console.error('Error:', error);
        }
    }
}

test();
