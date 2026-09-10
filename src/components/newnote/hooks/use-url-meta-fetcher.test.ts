import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUrlMetaFetcher } from './use-url-meta-fetcher';
import apiClient from '../../../utils/api-client';

vi.mock('../../../firebase', () => ({
    auth: {
        currentUser: { uid: 'test-uid' }
    }
}));

vi.mock('../../../utils/api-client', () => ({
    default: {
        get: vi.fn()
    }
}));

describe('useUrlMetaFetcher', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches church metadata for Church URLs in "Other" category', async () => {
        const mockResponse = {
            data: {
                title: '心にとどめておくべきこと：幕屋と犠牲',
                speaker: ''
            }
        };
        (apiClient.get as any).mockResolvedValueOnce(mockResponse);

        const { result } = renderHook(() =>
            useUrlMetaFetcher(
                'https://www.churchofjesuschrist.org/study/manual/cfm-2026/17-thoughts?lang=jpn',
                'Other',
                'ja'
            )
        );

        await waitFor(() => {
            expect(result.current.urlMeta).toEqual({
                title: '心にとどめておくべきこと：幕屋と犠牲',
                speaker: undefined
            });
        }, { timeout: 2000 });

        expect(apiClient.get).toHaveBeenCalledWith('/api/preview/fetch-church-metadata', {
            params: {
                url: 'https://www.churchofjesuschrist.org/study/manual/cfm-2026/17-thoughts?lang=jpn',
                lang: 'jpn'
            }
        });
    });

    it('fetches standard url preview for external URLs in "Other" category', async () => {
        const mockResponse = {
            data: {
                title: 'External Christian Article',
                speaker: 'John Doe'
            }
        };
        (apiClient.get as any).mockResolvedValueOnce(mockResponse);

        const { result } = renderHook(() =>
            useUrlMetaFetcher(
                'https://example.com/study/article',
                'Other',
                'en'
            )
        );

        await waitFor(() => {
            expect(result.current.urlMeta).toEqual({
                title: 'External Christian Article',
                speaker: 'John Doe'
            });
        }, { timeout: 2000 });

        expect(apiClient.get).toHaveBeenCalledWith('/api/preview/url-preview', {
            params: {
                url: 'https://example.com/study/article',
                lang: 'eng'
            }
        });
    });

    it('returns null urlMeta and does not call API for plain scripture text', async () => {
        const { result } = renderHook(() =>
            useUrlMetaFetcher('1 Nephi 3:7', 'Book of Mormon', 'en')
        );

        expect(result.current.urlMeta).toBeNull();
        expect(apiClient.get).not.toHaveBeenCalled();
    });
});
