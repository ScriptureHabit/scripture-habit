import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Setup mock for redisClient
const mockGet = vi.fn();
const mockSetex = vi.fn();
let mockStatus: string = 'ready';

vi.mock('./redis.js', () => {
    return {
        get redisClient() {
            return {
                status: mockStatus,
                get: (...args: any[]) => mockGet(...args),
                setex: (...args: any[]) => mockSetex(...args),
            };
        }
    };
});

import { redisCache } from './cache.js';

describe('redisCache middleware', () => {
    let req: any;
    let res: any;
    let next: NextFunction;

    beforeEach(() => {
        vi.restoreAllMocks();
        mockGet.mockReset();
        mockSetex.mockReset();
        mockStatus = 'ready';

        req = {
            method: 'GET',
            originalUrl: '/test-route?param=1',
            url: '/test-route?param=1',
        };

        res = {
            statusCode: 200,
            setHeader: vi.fn(),
            send: vi.fn(),
            json: vi.fn((data: any) => data),
        };

        next = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should skip caching if request method is not GET', async () => {
        req.method = 'POST';
        const middleware = redisCache(60);
        await middleware(req as Request, res as Response, next);

        expect(mockGet).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it('should skip caching if redis client is not in ready status', async () => {
        mockStatus = 'connecting';
        const middleware = redisCache(60);
        await middleware(req as Request, res as Response, next);

        expect(mockGet).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it('should return cached response on cache HIT', async () => {
        const cachedPayload = JSON.stringify({ title: 'Cached Data' });
        mockGet.mockResolvedValue(cachedPayload);

        const middleware = redisCache(60);
        await middleware(req as Request, res as Response, next);

        expect(mockGet).toHaveBeenCalledWith('api:cache:/test-route?param=1');
        expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
        expect(res.send).toHaveBeenCalledWith(cachedPayload);
        expect(next).not.toHaveBeenCalled();
    });

    it('should proceed to next() and intercept res.json on cache MISS', async () => {
        mockGet.mockResolvedValue(null);
        mockSetex.mockResolvedValue('OK');

        const middleware = redisCache(300, 'custom:prefix:');
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();

        // Simulate handler returning res.json
        const responseData = { success: true, count: 5 };
        res.json(responseData);

        expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
        expect(mockSetex).toHaveBeenCalledWith(
            'custom:prefix:/test-route?param=1',
            300,
            JSON.stringify(responseData)
        );
    });

    it('should gracefully handle cache read error without blocking request', async () => {
        mockGet.mockRejectedValue(new Error('Connection lost'));

        const middleware = redisCache(60);
        await middleware(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
    });

    it('should gracefully handle cache write error without failing response', async () => {
        mockGet.mockResolvedValue(null);
        mockSetex.mockRejectedValue(new Error('Write failed'));

        const middleware = redisCache(60);
        await middleware(req as Request, res as Response, next);

        // Should return json even if write fails
        const returned = res.json({ id: 123 });
        expect(returned).toEqual({ id: 123 });
        expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
    });
});
