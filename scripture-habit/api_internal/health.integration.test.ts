// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../api/api.js';
import { Server } from 'http';

describe('API Health Check Integration', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
        return new Promise<void>((resolve) => {
            // Start server on dynamic port
            server = app.listen(0, () => {
                const addr = server.address();
                if (addr && typeof addr !== 'string') {
                    baseUrl = `http://localhost:${addr.port}`;
                }
                resolve();
            });
        });
    });

    afterAll(async () => {
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });

    it('should return 200 OK for /api/health', async () => {
        const response = await fetch(`${baseUrl}/api/health`);
        const data = await response.json() as { status: string; time: string; env: string };

        expect(response.status).toBe(200);
        expect(data.status).toBe('ok');
        expect(data.time).toBeDefined();
        // Check if it's a valid ISO string
        expect(new Date(data.time).toISOString()).toBe(data.time);
    });

    it('should return 404 for non-existent routes', async () => {
        const response = await fetch(`${baseUrl}/api/non-existent-route`);
        const data = await response.json() as { error: string };

        expect(response.status).toBe(404);
        expect(data.error).toBe('NotFound');
    });
});
