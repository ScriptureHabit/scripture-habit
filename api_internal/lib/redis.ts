import { Redis } from 'ioredis';

let redisClient: Redis | undefined = undefined;
const isProductionDeployment = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === 'production'
    : process.env.NODE_ENV === 'production';

if (process.env.REDIS_URL) {
    try {
        redisClient = new Redis(process.env.REDIS_URL, {
            connectTimeout: 2000,
            commandTimeout: 2000,
            maxRetriesPerRequest: 1,
            reconnectOnError: (err) => {
                const targetError = 'READONLY';
                if (err.message.includes(targetError)) {
                    // Reconnect on READONLY error
                    return true;
                }
                return false;
            }
        });
        
        redisClient.on('error', (err) => {
            console.error('[Redis] Connection error:', err);
        });
        console.log('[Redis] Distributed Redis client initialized successfully.');
    } catch (e) {
        console.error('[Redis] Failed to initialize Redis client:', e);
        if (isProductionDeployment) {
            throw e;
        }
    }
} else {
    if (isProductionDeployment) {
        throw new Error('REDIS_URL is required in production for distributed rate limiting.');
    }
    console.log('[Redis] REDIS_URL not set. In-memory / direct fallback active.');
}

export { redisClient };
