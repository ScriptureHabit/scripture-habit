import { renderHook, waitFor } from '@testing-library/react';
import { useUrlMetadata } from '../use-url-metadata';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { safeStorage } from '../../utils/storage';

// Mock Firebase
vi.mock('../../firebase', () => ({
    auth: {
        currentUser: {
            uid: 'test-uid',
            getIdToken: vi.fn().mockResolvedValue('test-token'),
        },
    },
    appCheck: {},
}));

vi.mock('firebase/app-check', () => ({
    getToken: vi.fn().mockResolvedValue({ token: 'app-check-token' }),
}));

// Mock safeStorage
vi.mock('../../utils/storage', () => ({
    safeStorage: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

// Mock fetch
const globalFetch = vi.fn();
global.fetch = globalFetch;

describe('useUrlMetadata', () => {
    const defaultLang = 'en';

    beforeEach(() => {
        globalFetch.mockReset();
        globalFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ title: 'Test Title', speaker: 'Test Speaker' }),
        });
        vi.mocked(safeStorage.get).mockReturnValue(undefined);
        vi.clearAllMocks();
    });

    it('should fetch from API when no cache exists', async () => {
        const url = 'https://www.churchofjesuschrist.org/study/general-conference/2024/04/11nelson';
        const { result } = renderHook(() => useUrlMetadata(url, defaultLang));

        expect(result.current.loading).toBe(true);

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(globalFetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/fetch-church-metadata'),
            expect.any(Object)
        );
        expect(result.current.data).toEqual({ title: 'Test Title', speaker: 'Test Speaker' });
    });

    it('should use localStorage if available', async () => {
        const url = 'https://other.com/cached';
        const cachedData = { title: 'Cached Title', speaker: 'Cached Speaker' };
        vi.mocked(safeStorage.get).mockReturnValue(cachedData);

        const { result } = renderHook(() => useUrlMetadata(url, defaultLang));

        await waitFor(() => expect(result.current.data).toEqual(cachedData));
        expect(globalFetch).not.toHaveBeenCalled();
    });

    it('should handle Church shortcodes', async () => {
        const shortcode = '2024/04/shortcode';
        const { result } = renderHook(() => useUrlMetadata(shortcode, defaultLang));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(globalFetch).toHaveBeenCalledWith(
            expect.stringContaining('url=' + encodeURIComponent('https://www.churchofjesuschrist.org/2024/04/shortcode')),
            expect.any(Object)
        );
    });

    it('should use /api/url-preview for non-church URLs', async () => {
        const otherUrl = 'https://example.com/article';
        const { result } = renderHook(() => useUrlMetadata(otherUrl, defaultLang));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(globalFetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/url-preview'),
            expect.any(Object)
        );
    });

    it('should handle API errors', async () => {
        globalFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            text: async () => 'Not Found',
        });

        const url = 'https://fail.com';
        const { result } = renderHook(() => useUrlMetadata(url, defaultLang));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBeDefined();
        expect(result.current.error?.message).toMatch(/HTTP 404/);
    });

    it('should not fetch if urlOrSlug is missing', async () => {
        renderHook(() => useUrlMetadata(null, defaultLang));
        await new Promise(r => setTimeout(r, 10)); // Tiny wait
        expect(globalFetch).not.toHaveBeenCalled();
    });
});
