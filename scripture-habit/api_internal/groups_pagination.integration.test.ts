// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import app from '../api/api.js';
import { Server } from 'http';
import { db, admin } from './lib/firebase-admin.js';

interface GroupResponse {
    id: string;
    name: string;
    lastMessageAt: string;
    description: string;
    membersCount: number;
}

describe('Groups Pagination & Optimization Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    let server: Server;
    let baseUrl: string;
    const testId = Math.random().toString(36).substring(7);
    const testGroupIds: string[] = [];

    beforeAll(async () => {
        process.env.SKIP_APP_CHECK = 'true';
        
        // 0. Ensure a clean slate for this test's unique prefix
        // (Though with unique prefix it's less critical, it's good practice)
        const snapshot = await db.collection('groups').where('name', '>=', `Pagination Group ${testId}`).get();
        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }

        return new Promise<void>((resolve) => {
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
        // Cleanup
        for (const gid of testGroupIds) {
            await db.collection('groups').doc(gid).delete().catch(() => {});
        }
        return new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });

    it('should correctly paginate through public groups with limit and cursor', async () => {
        // 1. Setup: Create 25 groups with deterministic lastMessageAt
        // Group 24: most recent (2024-01-25)
        // Group 0: oldest (2024-01-01)
        const batch = db.batch();
        for (let i = 0; i < 25; i++) {
            const date = new Date(2024, 0, i + 1);
            const ref = db.collection('groups').doc();
            batch.set(ref, {
                name: `Pagination Group ${testId} ${i.toString().padStart(2, '0')}`,
                isPublic: true,
                lastMessageAt: admin.firestore.Timestamp.fromDate(date),
                membersCount: 1,
                description: `Description ${i}`
            });
            testGroupIds.push(ref.id);
        }
        await batch.commit();

        // 2. Fetch Page 1 (limit 10)
        // Should be Group 24, 23, ..., 15
        const res1 = await fetch(`${baseUrl}/api/groups?limit=10`);
        const groups1 = await res1.json() as GroupResponse[];
        expect(res1.ok).toBe(true);
        expect(groups1).toHaveLength(10);
        expect(groups1[0].name).toBe(`Pagination Group ${testId} 24`);
        expect(groups1[9].name).toBe(`Pagination Group ${testId} 15`);

        // 3. Fetch Page 2 using cursor
        const lastGroup = groups1[9];
        const lastId = lastGroup.id;
        const lastValue = lastGroup.lastMessageAt; // Now an ISO string

        const res2 = await fetch(`${baseUrl}/api/groups?limit=10&lastId=${lastId}&lastValue=${lastValue}`);
        expect(res2.ok).toBe(true);
        const groups2 = await res2.json() as GroupResponse[];
        expect(groups2).toHaveLength(10);
        expect(groups2[0].name).toBe(`Pagination Group ${testId} 14`);
        expect(groups2[9].name).toBe(`Pagination Group ${testId} 05`);

        // 4. Fetch Page 3 (remaining 5)
        const lastGroup2 = groups2[9];
        const res3 = await fetch(`${baseUrl}/api/groups?limit=10&lastId=${lastGroup2.id}&lastValue=${lastGroup2.lastMessageAt}`);
        expect(res3.ok).toBe(true);
        const groups3 = await res3.json() as GroupResponse[];
        expect(groups3).toHaveLength(5);
        expect(groups3[0].name).toBe(`Pagination Group ${testId} 04`);
        expect(groups3[4].name).toBe(`Pagination Group ${testId} 00`);
    });

    it('should respect the limit parameter', async () => {
        const res = await fetch(`${baseUrl}/api/groups?limit=3`);
        const groups = await res.json() as GroupResponse[];
        expect(groups).toHaveLength(3);
    });

    it('should fallback to document-based cursor if lastValue is missing', async () => {
        const res1 = await fetch(`${baseUrl}/api/groups?limit=5`);
        const groups1 = await res1.json() as GroupResponse[];
        const lastGroup = groups1[4];

        // Fetch using only lastId (costs 1 extra read on server but should work)
        const res2 = await fetch(`${baseUrl}/api/groups?limit=5&lastId=${lastGroup.id}`);
        const groups2 = await res2.json() as GroupResponse[];
        expect(groups2).toHaveLength(5);
        // Page 1 ends at 20. Page 2 starts at 19.
        expect(groups2[0].name).toBe(`Pagination Group ${testId} 19`);
    });
});
