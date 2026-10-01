import { Request, Response, NextFunction } from 'express';
import { redisClient } from './redis.js';

/**
 * Express middleware to cache GET responses in Redis.
 * Falls through gracefully if Redis is unavailable or on error.
 * 
 * @param ttlSeconds Time-to-live in seconds
 * @param prefix Cache key prefix (default: 'api:cache:')
 */
export const redisCache = (ttlSeconds: number, prefix: string = 'api:cache:') => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Only cache GET requests and when Redis client is connected and ready
        if (req.method !== 'GET' || !redisClient || redisClient.status !== 'ready') {
            return next();
        }

        const cacheKey = `${prefix}${req.originalUrl || req.url}`;

        try {
            const readPromise = redisClient.get(cacheKey);
            const timeoutPromise = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Cache read timed out')), 1500)
            );
            const cachedData = await Promise.race([readPromise, timeoutPromise]);
            if (cachedData) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.send(cachedData);
            }
        } catch (err) {
            console.warn('[RedisCache] Cache read error for key:', cacheKey, err);
            // Fall through to original handler
        }

        // Intercept res.json to capture response body and cache it
        const originalJson = res.json.bind(res);
        res.json = (body: unknown) => {
            // Only cache successful 200 responses if redis is healthy and ready
            if (res.statusCode === 200 && redisClient && redisClient.status === 'ready') {
                try {
                    const serialized = JSON.stringify(body);
                    const writePromise = redisClient.setex(cacheKey, ttlSeconds, serialized);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Cache write timed out')), 2000)
                    );
                    Promise.race([writePromise, timeoutPromise]).catch((err) => {
                        console.warn('[RedisCache] Cache write error for key:', cacheKey, err);
                    });
                } catch (e) {
                    console.warn('[RedisCache] Serialization error for key:', cacheKey, e);
                }
            }
            res.setHeader('X-Cache', 'MISS');
            return originalJson(body);
        };

        next();
    };
};
