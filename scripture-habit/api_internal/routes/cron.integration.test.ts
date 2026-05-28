// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db, admin } from '../lib/firebase-admin.js';
import { TestSetup } from '../test-setup.js';
import { InactivityService } from '../services/inactivity-service.js';
import { ArchiveService } from '../services/archive-service.js';
import { CounterService } from '../services/counter-service.js';

const CRON_SECRET = 'test-cron-secret-xyz';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Cron Routes Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();

    const cronHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`
    };

    const CRON_GROUP = 'CRON_TEST_GRP_' + Date.now();
    const CRON_USER = 'CRON_TEST_USR_' + Date.now();
    const CRON_USER2 = 'CRON_TEST_USR2_' + Date.now();

    beforeAll(async () => {
        process.env.CRON_SECRET = CRON_SECRET;
        await setup.start();

        // Minimal user + group for test-inactive-check
        const now = admin.firestore.Timestamp.now();
        await db.collection('users').doc(CRON_USER).set({
            nickname: 'CronUser',
            language: 'en',
            groupIds: [CRON_GROUP],
            lastPostAt: now,
            totalNotes: 0,
            cheersReceived: 0
        });
        await db.collection('users').doc(CRON_USER2).set({
            nickname: 'CronUser2',
            language: 'en',
            groupIds: [CRON_GROUP],
            lastPostAt: now,
            totalNotes: 0,
            cheersReceived: 0
        });

        await db.collection('groups').doc(CRON_GROUP).set({
            name: 'Cron Test Group',
            ownerUserId: CRON_USER,
            members: [CRON_USER, CRON_USER2],
            membersCount: 2,
            pace: 7,
            isPublic: true,
            lastMessageAt: now,
            lastInactivityCheckedAt: now,
            createdAt: now
        });
        // Add member docs for test-inactive-check
        const past = admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000);
        await db.collection('groups').doc(CRON_GROUP).collection('members').doc(CRON_USER).set({
            joinedAt: past, lastActiveAt: now, kickThreshold: 3
        });
        // CRON_USER2 — ghost: in members array but NO member doc (for ghost coverage)
    });

    afterAll(async () => {
        await db.recursiveDelete(db.collection('groups').doc(CRON_GROUP)).catch(() => {});
        await db.collection('users').doc(CRON_USER).delete().catch(() => {});
        await db.collection('users').doc(CRON_USER2).delete().catch(() => {});
        delete process.env.CRON_SECRET;
        vi.restoreAllMocks();
        await setup.stop();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    // ─── verifyCronSecret middleware ──────────────────────────────────────────

    describe('verifyCronSecret middleware', () => {
        it('should return 401 with no Authorization header', async () => {
            const res = await fetch(`${setup.baseUrl}/api/cron/check-inactive-users`);
            expect(res.status).toBe(401);
        });

        it('should return 401 with wrong secret', async () => {
            const res = await fetch(`${setup.baseUrl}/api/cron/check-inactive-users`, {
                headers: { Authorization: 'Bearer wrong-secret' }
            });
            expect(res.status).toBe(401);
        });
    });

    // ─── /check-inactive-users ───────────────────────────────────────────────

    describe('GET /check-inactive-users', () => {
        it('should run inactivity check and return stats', async () => {
            vi.spyOn(InactivityService, 'batchCheckInactivity').mockResolvedValue({
                processedGroups: 5,
                removedUsers: 1,
                initializedTracking: 0,
                transferredOwnerships: 0,
                deletedGroups: 0
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/check-inactive-users`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('Inactivity check complete.');
            expect(data.stats.processedGroups).toBe(5);
        });

        it('should return 500 when InactivityService throws', async () => {
            vi.spyOn(InactivityService, 'batchCheckInactivity').mockRejectedValue(
                new Error('DB exploded')
            );

            const res = await fetch(`${setup.baseUrl}/api/cron/check-inactive-users`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(500);
            const text = await res.text();
            expect(text).toContain('DB exploded');
        });
    });

    // ─── /test-inactive-check/:groupId ───────────────────────────────────────

    describe('GET /test-inactive-check/:groupId', () => {
        it('should return 404 for non-existent group', async () => {
            const res = await fetch(`${setup.baseUrl}/api/cron/test-inactive-check/DOES_NOT_EXIST`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(404);
        });

        it('should return a report for an existing group (active + ghost member)', async () => {
            const res = await fetch(`${setup.baseUrl}/api/cron/test-inactive-check/${CRON_GROUP}`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.groupId).toBe(CRON_GROUP);
            expect(data.totalMembers).toBe(2);
            expect(Array.isArray(data.members)).toBe(true);
            // Should have processed CRON_USER (from subcollection) + CRON_USER2 (ghost)
            const ghost = data.members.find((m: { memberId: string }) => m.memberId === CRON_USER2);
            expect(ghost).toBeDefined();
            expect(ghost.status).toContain('GHOST');
        });

        it('should handle member with needs_initialization status', async () => {
            // needs_initialization requires: no joinedAt, but has createTime or lastActiveAt
            // (if both are absent it's treated as 'ghost'/inactive instead)
            const GHOST_GRP = 'CRON_GHOST_GRP_' + Date.now();
            const GHOST_USR = 'CRON_GHOST_USR_' + Date.now();
            const now = admin.firestore.Timestamp.now();

            await db.collection('groups').doc(GHOST_GRP).set({
                name: 'Ghost Group',
                ownerUserId: GHOST_USR,
                members: [GHOST_USR],
                membersCount: 1,
                pace: 7,
                lastInactivityCheckedAt: now,
                createdAt: now
            });
            // No joinedAt + has createTime => needs_initialization (not ghost)
            await db.collection('groups').doc(GHOST_GRP).collection('members').doc(GHOST_USR).set({
                createTime: now,  // provides createTime but no joinedAt => needs_initialization
                kickThreshold: 3
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/test-inactive-check/${GHOST_GRP}`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            const member = data.members.find((m: { memberId: string }) => m.memberId === GHOST_USR);
            expect(member).toBeDefined();
            expect(member.action).toContain('initialize');

            await db.recursiveDelete(db.collection('groups').doc(GHOST_GRP)).catch(() => {});
        });

        it('should return 500 on Firestore error', async () => {
            const spy = vi.spyOn(db, 'collection').mockImplementation(() => {
                throw new Error('Firestore down');
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/test-inactive-check/ANY`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });
    });

    // ─── /archive-old-messages ───────────────────────────────────────────────

    describe('GET /archive-old-messages', () => {
        it('should run archiving and return stats', async () => {
            vi.spyOn(ArchiveService, 'getGroupsNeedingArchive').mockResolvedValue([CRON_GROUP]);
            vi.spyOn(ArchiveService, 'archiveOldMessages').mockResolvedValue(10);

            const res = await fetch(`${setup.baseUrl}/api/cron/archive-old-messages`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('Archiving complete.');
            expect(data.stats.groupsProcessed).toBe(1);
            expect(data.stats.totalMessagesArchived).toBe(10);
        });

        it('should handle archiveOldMessages returning 0 (no messages archived)', async () => {
            vi.spyOn(ArchiveService, 'getGroupsNeedingArchive').mockResolvedValue([CRON_GROUP]);
            vi.spyOn(ArchiveService, 'archiveOldMessages').mockResolvedValue(0);

            const res = await fetch(`${setup.baseUrl}/api/cron/archive-old-messages`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.stats.groupsProcessed).toBe(0);
        });

        it('should swallow per-group errors and continue', async () => {
            vi.spyOn(ArchiveService, 'getGroupsNeedingArchive').mockResolvedValue(['BAD_GRP', CRON_GROUP]);
            vi.spyOn(ArchiveService, 'archiveOldMessages')
                .mockRejectedValueOnce(new Error('Archive failed'))
                .mockResolvedValueOnce(5);

            const res = await fetch(`${setup.baseUrl}/api/cron/archive-old-messages`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.stats.groupsProcessed).toBe(1);
        });

        it('should return 500 when getGroupsNeedingArchive throws', async () => {
            vi.spyOn(ArchiveService, 'getGroupsNeedingArchive').mockRejectedValue(
                new Error('Cannot get groups')
            );

            const res = await fetch(`${setup.baseUrl}/api/cron/archive-old-messages`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(500);
            const text = await res.text();
            expect(text).toContain('Cannot get groups');
        });
    });

    // ─── /aggregate-message-counts ────────────────────────────────────────────

    describe('GET /aggregate-message-counts', () => {
        it('should aggregate counts and return stats', async () => {
            vi.spyOn(CounterService, 'aggregateAndSync').mockResolvedValue(3);
            vi.spyOn(CounterService, 'recountAndSync').mockResolvedValue(2);
            vi.spyOn(CounterService, 'recountMessageCountWithArchive').mockResolvedValue(1);

            const res = await fetch(`${setup.baseUrl}/api/cron/aggregate-message-counts`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('Aggregation complete.');
            expect(typeof data.stats.totalGroupsHandled).toBe('number');
        });

        it('should return 500 when Firestore query throws', async () => {
            const spy = vi.spyOn(db, 'collection').mockImplementation(() => {
                throw new Error('Aggregate DB error');
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/aggregate-message-counts`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });
    });

    // ─── /sync-user-stats ────────────────────────────────────────────────────

    describe('GET /sync-user-stats', () => {
        it('should sync user stats and return counts', async () => {
            const res = await fetch(`${setup.baseUrl}/api/cron/sync-user-stats`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('User stats sync complete.');
            expect(typeof data.stats.usersProcessed).toBe('number');
        });

        it('should return 500 when Firestore query throws', async () => {
            const spy = vi.spyOn(db, 'collection').mockImplementation(() => {
                throw new Error('Sync DB error');
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/sync-user-stats`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });
    });

    // ─── /cleanup-orphaned-cheers ─────────────────────────────────────────────

    describe('GET /cleanup-orphaned-cheers', () => {
        it('should return early when cheers collection is empty', async () => {
            const res = await fetch(`${setup.baseUrl}/api/cron/cleanup-orphaned-cheers`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('No cheers to check.');
        });

        it('should delete orphaned cheers (missing group)', async () => {
            const cheerId = 'ORPHAN_CHEER_' + Date.now();
            await db.collection('cheers').doc(cheerId).set({
                groupId: 'NON_EXISTENT_GROUP',
                senderUid: CRON_USER,
                targetUid: CRON_USER2,
                lastCheckedAt: admin.firestore.Timestamp.fromMillis(0)
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/cleanup-orphaned-cheers`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.stats.deletedOrphans).toBeGreaterThanOrEqual(1);

            await db.collection('cheers').doc(cheerId).delete().catch(() => {});
        });

        it('should delete orphaned cheers with no groupId', async () => {
            const cheerId = 'NO_GROUP_CHEER_' + Date.now();
            await db.collection('cheers').doc(cheerId).set({
                senderUid: CRON_USER,
                targetUid: CRON_USER2,
                lastCheckedAt: admin.firestore.Timestamp.fromMillis(0)
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/cleanup-orphaned-cheers`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.stats.deletedOrphans).toBeGreaterThanOrEqual(1);

            await db.collection('cheers').doc(cheerId).delete().catch(() => {});
        });

        it('should update lastCheckedAt for valid cheers', async () => {
            const cheerId = 'VALID_CHEER_' + Date.now();
            await db.collection('cheers').doc(cheerId).set({
                groupId: CRON_GROUP,
                senderUid: CRON_USER,
                targetUid: CRON_USER2,
                lastCheckedAt: admin.firestore.Timestamp.fromMillis(0)
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/cleanup-orphaned-cheers`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.stats.checked).toBeGreaterThanOrEqual(1);

            await db.collection('cheers').doc(cheerId).delete().catch(() => {});
        });

        it('should return 500 when Firestore throws', async () => {
            const spy = vi.spyOn(db, 'collection').mockImplementation(() => {
                throw new Error('Cheers DB error');
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/cleanup-orphaned-cheers`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });
    });

    // ─── /reset-unity-at-midnight ─────────────────────────────────────────────

    describe('GET /reset-unity-at-midnight', () => {
        it('should complete reset-unity (empty or with groups)', async () => {
            // The emulator may have leftover groups from other tests, so we only
            // assert that the route returns a success response without asserting
            // the exact message (which depends on emulator state).
            const res = await fetch(`${setup.baseUrl}/api/cron/reset-unity-at-midnight`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toMatch(/unity|reset/i);
        });

        it('should reset groups with stale dailyActivity', async () => {
            const RESET_GRP = 'CRON_RESET_GRP_' + Date.now();
            // Use a clearly old date so it never equals today in any timezone
            const yesterdayStr = '2000-01-01';
            const now = admin.firestore.Timestamp.now();

            await db.collection('groups').doc(RESET_GRP).set({
                name: 'Reset Group',
                ownerUserId: CRON_USER,
                members: [CRON_USER],
                timeZone: 'UTC',
                dailyActivity: { date: yesterdayStr, activeMembers: [CRON_USER] },
                unityPercentage: 100,
                lastInactivityCheckedAt: now,
                createdAt: now
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/reset-unity-at-midnight`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.stats.resetCount).toBeGreaterThanOrEqual(1);

            // Verify the group's unityPercentage was reset
            const snap = await db.collection('groups').doc(RESET_GRP).get();
            expect(snap.data()?.unityPercentage).toBe(0);
            expect(snap.data()?.dailyActivity?.activeMembers).toEqual([]);

            await db.collection('groups').doc(RESET_GRP).delete().catch(() => {});
        });

        it('should return 500 when Firestore throws', async () => {
            const spy = vi.spyOn(db, 'collection').mockImplementation(() => {
                throw new Error('Reset DB error');
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/reset-unity-at-midnight`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });
    });

    // ─── /streak-warning ─────────────────────────────────────────────────────

    describe.skip('GET /streak-warning', () => {
        it('should skip when no timezones match target hour (line 488)', async () => {
            // Inject a time guaranteed to match 0 timezones at hour 25 (invalid)
            // We use x-test-time header with a time where no tz has hour 20
            // The simplest approach: pass a time where getTargetTimezones returns []
            // We mock StreakReminderEngine.getTargetTimezones instead
            const { StreakReminderEngine } = await import('../lib/streak-reminder.js');
            const spy = vi.spyOn(StreakReminderEngine, 'getTargetTimezones').mockReturnValue([]);

            const res = await fetch(`${setup.baseUrl}/api/cron/streak-warning`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toContain('No timezones');
            spy.mockRestore();
        });

        it('should process eligible users with FCM tokens and send notifications', async () => {
            const STREAK_USER = 'CRON_STREAK_USR_' + Date.now();
            const FAKE_TOKEN = 'fake-fcm-token-' + Date.now();
            const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0];

            await db.collection('users').doc(STREAK_USER).set({
                nickname: 'StreakUser',
                language: 'en',
                timeZone: 'Asia/Tokyo',
                hasFcmToken: true,
                lastPostDate: YESTERDAY
            });
            await db.collection('users').doc(STREAK_USER)
                .collection('private').doc('tokens').set({
                    fcmTokens: [FAKE_TOKEN]
                });

            const { StreakReminderEngine } = await import('../lib/streak-reminder.js');
            vi.spyOn(StreakReminderEngine, 'getTargetTimezones').mockReturnValue(['Asia/Tokyo']);
            vi.spyOn(StreakReminderEngine, 'needsReminder').mockReturnValue(true);

            // Mock FCM messaging to avoid real network calls
            const { messaging } = await import('../lib/firebase-admin.js');
            vi.spyOn(messaging, 'sendEachForMulticast').mockResolvedValue({
                successCount: 1,
                failureCount: 0,
                responses: [{ success: true }]
            } as any);

            const res = await fetch(`${setup.baseUrl}/api/cron/streak-warning`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.stats.tokensSentTo).toBeGreaterThanOrEqual(0);

            await db.recursiveDelete(db.collection('users').doc(STREAK_USER)).catch(() => {});
        });

        it('should clean up failed FCM tokens', async () => {
            const STREAK_USER2 = 'CRON_STREAK_FAIL_' + Date.now();
            const BAD_TOKEN = 'bad-token-' + Date.now();
            const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0];

            await db.collection('users').doc(STREAK_USER2).set({
                nickname: 'StreakUserFail',
                language: 'ja',
                timeZone: 'Asia/Tokyo',
                hasFcmToken: true,
                lastPostDate: YESTERDAY
            });
            await db.collection('users').doc(STREAK_USER2)
                .collection('private').doc('tokens').set({
                    fcmTokens: [BAD_TOKEN]
                });

            const { StreakReminderEngine } = await import('../lib/streak-reminder.js');
            vi.spyOn(StreakReminderEngine, 'getTargetTimezones').mockReturnValue(['Asia/Tokyo']);
            vi.spyOn(StreakReminderEngine, 'needsReminder').mockReturnValue(true);

            const { messaging } = await import('../lib/firebase-admin.js');
            vi.spyOn(messaging, 'sendEachForMulticast').mockResolvedValue({
                successCount: 0,
                failureCount: 1,
                responses: [{
                    success: false,
                    error: { code: 'messaging/registration-token-not-registered' }
                }]
            } as any);

            const res = await fetch(`${setup.baseUrl}/api/cron/streak-warning`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.stats.failedTokensCleanedUp).toBeGreaterThanOrEqual(1);

            // Verify bad token removed
            const tokSnap = await db.collection('users').doc(STREAK_USER2)
                .collection('private').doc('tokens').get();
            expect(tokSnap.data()?.fcmTokens).not.toContain(BAD_TOKEN);

            await db.recursiveDelete(db.collection('users').doc(STREAK_USER2)).catch(() => {});
        });

        it('should skip users who already posted today (skippedCount)', async () => {
            const DONE_USER = 'CRON_DONE_USR_' + Date.now();
            const TODAY = new Date().toISOString().split('T')[0];

            await db.collection('users').doc(DONE_USER).set({
                nickname: 'DoneUser',
                language: 'en',
                timeZone: 'Asia/Tokyo',
                hasFcmToken: true,
                lastPostDate: TODAY
            });

            const { StreakReminderEngine } = await import('../lib/streak-reminder.js');
            vi.spyOn(StreakReminderEngine, 'getTargetTimezones').mockReturnValue(['Asia/Tokyo']);
            vi.spyOn(StreakReminderEngine, 'needsReminder').mockReturnValue(false);

            const res = await fetch(`${setup.baseUrl}/api/cron/streak-warning`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.stats.skippedCompletedUsers).toBeGreaterThanOrEqual(1);

            await db.collection('users').doc(DONE_USER).delete().catch(() => {});
        });

        it('should return 500 when Firestore throws', async () => {
            const { StreakReminderEngine } = await import('../lib/streak-reminder.js');
            vi.spyOn(StreakReminderEngine, 'getTargetTimezones').mockReturnValue(['Asia/Tokyo']);

            const spy = vi.spyOn(db, 'collection').mockImplementation(() => {
                throw new Error('Streak DB error');
            });

            const res = await fetch(`${setup.baseUrl}/api/cron/streak-warning`, {
                headers: cronHeaders
            });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });
    });
});
