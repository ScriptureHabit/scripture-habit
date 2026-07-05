// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestSetup } from './test-setup.js';

describe('API Health Check Integration', () => {
    const setup = new TestSetup();

    beforeAll(async () => {
        await setup.start();
    });

    afterAll(async () => {
        await setup.stop();
    });

    it('should return 200 OK for /api/health', async () => {
        const response = await fetch(`${setup.baseUrl}/api/health`);
        const data = await response.json() as { status: string; time: string; env: string };

        expect(response.status).toBe(200);
        expect(data.status).toBe('ok');
        expect(data.time).toBeDefined();
        // Check if it's a valid ISO-8601 string safely using regex to prevent exceptions
        expect(data.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    });

    it('should return 404 for non-existent routes', async () => {
        const response = await fetch(`${setup.baseUrl}/api/non-existent-route`);
        const data = await response.json() as { error: string };

        expect(response.status).toBe(404);
        expect(data.error).toBe('NotFound');
    });
});
