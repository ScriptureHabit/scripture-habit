import { Redis } from 'ioredis';

let redisClient: Redis | undefined = undefined;

if (process.env.REDIS_URL) {
    try {
        redisClient = new Redis(process.env.REDIS_URL, {
            connectTimeout: 2000,
            maxRetriesPerRequest: 1
        });
        
        redisClient.on('error', (err) => {
            console.error('[Redis] Connection error:', err);
        });
        console.log('[Redis] Distributed Redis client initialized successfully.');
    } catch (e) {
        console.error('[Redis] Failed to initialize Redis client:', e);
    }
} else {
    console.log('[Redis] REDIS_URL not set. In-memory / direct fallback active.');
}

export { redisClient };
