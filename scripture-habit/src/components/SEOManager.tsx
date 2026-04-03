import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage, SUPPORTED_LANGUAGES } from '../context/LanguageContext';

const SEOManager: React.FC = () => {
    const { t, language } = useLanguage();
    const location = useLocation();

    useEffect(() => {
        // Determine route type
        const path = location.pathname;
        const normalizedPath = path.startsWith('/') ? path : '/' + path;
        const pathParts = normalizedPath.split('/').filter((p: string) => p !== '');
        // Check if there's a language prefix
        const hasLangPrefix = (SUPPORTED_LANGUAGES as string[]).includes(pathParts[0]);
        const baseIndex = hasLangPrefix ? 1 : 0;
        const route = pathParts[baseIndex] || '';

        // Route-specific Title and Indexing
        let title = t('seo.title') || "Scripture Habit";

        // Explicit list of routes that SHOULD be indexed
        const publicRoutes = ['', 'privacy', 'terms', 'legal'];
        let shouldIndex = hasLangPrefix || publicRoutes.includes(route);

        if (route === 'dashboard') {
            title = `${t('sidebar.dashboard')} | Scripture Habit`;
            shouldIndex = false;
        } else if (route === 'welcome') {
            title = `Welcome | Scripture Habit`;
            shouldIndex = false;
        } else if (route === 'login') {
            title = `Login | Scripture Habit`;
            shouldIndex = false;
        } else if (route === 'signup') {
            title = `Sign Up | Scripture Habit`;
            shouldIndex = false;
        } else if (route === 'group' || route === 'join' || route === 'profile' || route === 'my-notes' || route === 'settings') {
            shouldIndex = false;
        }

        // Update Document Title
        document.title = title;

        // Manage Robots Meta Tag
        let robotsTag = document.querySelector('meta[name="robots"]');
        if (!robotsTag) {
            robotsTag = document.createElement('meta');
            robotsTag.setAttribute('name', 'robots');
            document.head.appendChild(robotsTag);
        }

        // Add explicit no-index for more app routes
        const noIndexRoutes = [
            'dashboard', 'welcome', 'login', 'signup', 'forgot-password',
            'group-form', 'join-group', 'group-options', 'group', 'join',
            'profile', 'my-notes', 'settings'
        ];
        if (noIndexRoutes.includes(route)) {
            shouldIndex = false;
        }

        // Index if shouldIndex is true (has language prefix and is a public route)
        if (shouldIndex) {
            robotsTag.setAttribute('content', 'index, follow');
        } else {
            robotsTag.setAttribute('content', 'noindex, nofollow');
        }

        // Update Meta Description
        const description = t('seo.description');
        if (description) {
            document.querySelector('meta[name="description"]')?.setAttribute('content', description);
            document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
            document.querySelector('meta[property="twitter:description"]')?.setAttribute('content', description);
        }

        // Update OG/Twitter Titles
        if (title) {
            document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
            document.querySelector('meta[property="twitter:title"]')?.setAttribute('content', title);

            // Explicitly set og:site_name to help with Google's Site Name recognition
            let siteNameTag = document.querySelector('meta[property="og:site_name"]');
            if (!siteNameTag) {
                siteNameTag = document.createElement('meta');
                siteNameTag.setAttribute('property', 'og:site_name');
                document.head.appendChild(siteNameTag);
            }
            siteNameTag.setAttribute('content', 'Scripture Habit');
        }

        // Update Canonical Tag
        // Extract base path (without language prefix if present)
        const baseContentPath = (SUPPORTED_LANGUAGES as string[]).includes(pathParts[0])
            ? '/' + pathParts.slice(1).join('/')
            : path;

        // Canonical URL for the CURRENT language
        const normalizedBaseContentPath = baseContentPath === '' ? '/' : baseContentPath;
        let canonicalPath = `/${language}${normalizedBaseContentPath === '/' ? '/' : normalizedBaseContentPath}`;
        if (!canonicalPath.endsWith('/')) {
            canonicalPath += '/';
        }
        const canonicalUrl = `https://scripturehabit.app${canonicalPath}`;

        let canonicalTag = document.querySelector('link[rel="canonical"]');
        if (canonicalTag) {
            canonicalTag.setAttribute('href', canonicalUrl);
        } else {
            canonicalTag = document.createElement('link');
            canonicalTag.setAttribute('rel', 'canonical');
            canonicalTag.setAttribute('href', canonicalUrl);
            document.head.appendChild(canonicalTag);
        }

        // Update OG URL
        document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonicalUrl);
    }, [location, t, language]);

    return null;
};

export default SEOManager;
