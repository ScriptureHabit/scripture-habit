/**
 * Global application configuration.
 * Toggle MAINTENANCE_MODE to true to show the maintenance page to all users.
 */
export const MAINTENANCE_MODE: boolean = false;
export const MAX_GROUPS_PER_USER: number = 4;
export const GITHUB_REPO_URL: string = 'https://github.com/ScriptureHabit/scripture-habit';
export const STRIPE_DONATION_URL: string = (import.meta.env.VITE_STRIPE_DONATION_URL as string) || 'https://buy.stripe.com/your_payment_link_id';

/**
 * Returns the Stripe donation URL with an explicit locale parameter
 * matching the user's current app language.
 */
export const getStripeDonationUrl = (lang?: string): string => {
    const baseUrl = STRIPE_DONATION_URL;
    if (!baseUrl) return '';

    const stripeLocaleMap: Record<string, string> = {
        ja: 'ja',
        en: 'en',
        es: 'es',
        pt: 'pt-BR',
        it: 'it',
        ko: 'ko',
        zho: 'zh-TW',
        vi: 'vi',
        th: 'th',
        tl: 'fil',
        sw: 'en',
    };

    const locale = (lang && stripeLocaleMap[lang]) || 'auto';
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}locale=${locale}`;
};

