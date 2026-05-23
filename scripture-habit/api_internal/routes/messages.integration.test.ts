// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { db, admin } from '../lib/firebase-admin.js';
import { TestSetup } from '../test-setup.js';
import { MessageService } from '../services/message-service.js';
import { NoteService } from '../services/note-service.js';

describe('Messages Route Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();

    const OWNER_ID = 'MESSAGES_OWNER_' + Date.now();
    const MEMBER_ID = 'MESSAGES_MEMBER_' + Date.now();
    const OUTSIDER_ID = 'MESSAGES_OUTSIDER_' + Date.now();
    const GROUP_ID = 'MESSAGES_GRP_' + Date.now();
    const inviteCode = 'MSG123';

    beforeAll(async () => {
        await setup.start();
        // Setup initial user data
        await db.collection('users').doc(OWNER_ID).set({
            uid: OWNER_ID,
            nickname: 'Owner User',
            emailVerified: true,
            groupIds: [GROUP_ID]
        });
        await db.collection('users').doc(MEMBER_ID).set({
            uid: MEMBER_ID,
            nickname: 'Member User',
            emailVerified: true,
            groupIds: [GROUP_ID]
        });
        await db.collection('users').doc(OUTSIDER_ID).set({
            uid: OUTSIDER_ID,
            nickname: 'Outsider User',
            emailVerified: true,
            groupIds: []
        });

        // Setup initial group
        const now = admin.firestore.Timestamp.now();
        await db.collection('groups').doc(GROUP_ID).set({
            name: 'Test Messages Group',
            description: 'Group for testing messages',
            createdAt: now,
            groupStreak: 0,
            inviteCode,
            inviteCodeExpiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 86400000),
            isPublic: true,
            ownerUserId: OWNER_ID,
            members: [OWNER_ID, MEMBER_ID],
            membersCount: 2,
            timeZone: 'UTC',
            lastInactivityCheckedAt: now
        });
    });

    afterAll(async () => {
        await db.recursiveDelete(db.collection('groups').doc(GROUP_ID)).catch(() => {});
        await db.collection('users').doc(OWNER_ID).delete().catch(() => {});
        await db.collection('users').doc(MEMBER_ID).delete().catch(() => {});
        await db.collection('users').doc(OUTSIDER_ID).delete().catch(() => {});
        await setup.stop();
    });

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('Auth Verification', () => {
        it('should return 401 for unauthenticated requests on messages endpoints', async () => {
            const endpoints = [
                { path: `/api/groups/bundle/${GROUP_ID}`, method: 'GET', body: null },
                { path: '/api/groups/post-note', method: 'POST', body: { scripture: '1 Ne 1:1', messageText: 'test note' } },
                { path: '/api/groups/post-message', method: 'POST', body: { groupId: GROUP_ID, text: 'hi' } },
                { path: '/api/groups/toggle-reaction', method: 'POST', body: { groupId: GROUP_ID, messageId: 'm1' } },
                { path: '/api/groups/delete-note', method: 'POST', body: { noteId: 'n1' } },
                { path: '/api/groups/edit-message', method: 'POST', body: { groupId: GROUP_ID, messageId: 'm1', text: 'new' } },
                { path: '/api/groups/delete-message', method: 'POST', body: { groupId: GROUP_ID, messageId: 'm1' } },
                { path: '/api/groups/send-cheer', method: 'POST', body: { targetUid: MEMBER_ID, groupId: GROUP_ID } }
            ];

            for (const ep of endpoints) {
                const init: RequestInit = {
                    method: ep.method,
                    headers: { 'Content-Type': 'application/json' }
                };
                if (ep.body) {
                    init.body = JSON.stringify(ep.body);
                }
                const res = await fetch(`${setup.baseUrl}${ep.path}`, init);
                expect(res.status).toBe(401);
            }
        });
    });

    describe('GET /bundle/:groupId', () => {
        it('should return 404 if the group does not exist', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/bundle/non_existent_group`, {
                headers: { 'Authorization': `Bearer token-${OWNER_ID}` }
            });
            expect(res.status).toBe(404);
            const data = await res.json();
            expect(data.error).toBe('Group not found');
        });

        it('should return 403 if the user is not a member of the group', async () => {
            setup.mockAuth(OUTSIDER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/bundle/${GROUP_ID}`, {
                headers: { 'Authorization': `Bearer token-${OUTSIDER_ID}` }
            });
            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.error).toBe('Forbidden');
        });

        it('should return 200 with octet-stream when user has access', async () => {
            setup.mockAuth(MEMBER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/bundle/${GROUP_ID}`, {
                headers: { 'Authorization': `Bearer token-${MEMBER_ID}` }
            });
            expect(res.status).toBe(200);
            expect(res.headers.get('Content-Type')).toContain('application/octet-stream');
            
            // Build buffer and verify we can read it
            const buffer = await res.arrayBuffer();
            expect(buffer.byteLength).toBeGreaterThan(0);
        });

        it('should heal membership for group owner if not in members list', async () => {
            // Set owner but remove from members list
            await db.collection('groups').doc(GROUP_ID).update({
                members: [MEMBER_ID],
                membersCount: 1
            });

            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/bundle/${GROUP_ID}`, {
                headers: { 'Authorization': `Bearer token-${OWNER_ID}` }
            });
            expect(res.status).toBe(200);

            // Verify owner was added back to members
            const snap = await db.collection('groups').doc(GROUP_ID).get();
            expect(snap.data()?.members).toContain(OWNER_ID);

            // Re-setup correctly
            await db.collection('groups').doc(GROUP_ID).update({
                members: [OWNER_ID, MEMBER_ID],
                membersCount: 2
            });
        });
    });

    describe('POST /post-note', () => {
        it('should return 400 for invalid validation schema', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/post-note`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    scripture: '', // Empty scripture fails validation
                    messageText: 'test'
                })
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('Invalid input');
        });

        it('should successfully post a note', async () => {
            setup.mockAuth(OWNER_ID);
            const spyPostNote = vi.spyOn(NoteService, 'postNote').mockResolvedValue({
                personalNoteId: 'test-note-id',
                sharedMessageIds: {},
                newStreak: 1,
                streakUpdated: true,
                nickname: 'Owner User',
                backgroundPromise: Promise.resolve(null)
            });

            const res = await fetch(`${setup.baseUrl}/api/groups/post-note`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    chapter: '1',
                    scripture: '1 Ne 1:1',
                    messageText: 'This is a beautiful scripture test note.',
                    comment: 'My thoughts',
                    shareOption: 'current'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.personalNoteId).toBe('test-note-id');
            expect(spyPostNote).toHaveBeenCalled();
        });
    });

    describe('POST /post-message', () => {
        it('should return 400 for invalid post message schema', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/post-message`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    // Missing groupId and text
                })
            });
            expect(res.status).toBe(400);
        });

        it('should successfully post a chat message', async () => {
            setup.mockAuth(OWNER_ID);
            const spyPostMessage = vi.spyOn(MessageService, 'postMessage').mockResolvedValue({
                nickname: 'Owner User',
                messageId: 'test-msg-id',
                members: null
            });

            const res = await fetch(`${setup.baseUrl}/api/groups/post-message`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: GROUP_ID,
                    text: 'Hello group!',
                    replyTo: {
                        id: 'parent-msg-id',
                        senderNickname: 'Member User',
                        text: 'hi',
                        isNote: false
                    },
                    optimisticId: 'opt-123'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.messageId).toBe('test-msg-id');
            expect(spyPostMessage).toHaveBeenCalled();
        });
    });

    describe('POST /toggle-reaction', () => {
        it('should return 400 for missing params', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/toggle-reaction`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: GROUP_ID
                    // missing messageId
                })
            });
            expect(res.status).toBe(400);
        });

        it('should successfully toggle a reaction', async () => {
            setup.mockAuth(OWNER_ID);
            const spyToggle = vi.spyOn(MessageService, 'toggleReaction').mockResolvedValue({
                hasReacted: true,
                newUids: [OWNER_ID],
                newPreviews: [{ uid: OWNER_ID, nickname: 'Owner User' }]
            });

            const res = await fetch(`${setup.baseUrl}/api/groups/toggle-reaction`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: GROUP_ID,
                    messageId: 'msg-to-react',
                    emoji: '👍'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.hasReacted).toBe(true);
            expect(spyToggle).toHaveBeenCalled();
        });
    });

    describe('POST /delete-note', () => {
        it('should return 400 validation error', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/delete-note`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({})
            });
            expect(res.status).toBe(400);
        });

        it('should successfully delete a note', async () => {
            setup.mockAuth(OWNER_ID);
            const spyDeleteNote = vi.spyOn(NoteService, 'deleteNote').mockResolvedValue({ success: true });

            const res = await fetch(`${setup.baseUrl}/api/groups/delete-note`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    noteId: 'note-to-delete'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(spyDeleteNote).toHaveBeenCalledWith(OWNER_ID, 'note-to-delete');
        });

        it('should return 500 when NoteService throws an error', async () => {
            setup.mockAuth(OWNER_ID);
            vi.spyOn(NoteService, 'deleteNote').mockRejectedValue(new Error('DB failure'));

            const res = await fetch(`${setup.baseUrl}/api/groups/delete-note`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    noteId: 'note-to-delete'
                })
            });

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('InternalServerError');
        });
    });

    describe('POST /edit-message', () => {
        it('should return 400 for missing params', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/edit-message`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: GROUP_ID,
                    messageId: 'm1'
                    // missing text
                })
            });
            expect(res.status).toBe(400);
        });

        it('should successfully edit a message', async () => {
            setup.mockAuth(OWNER_ID);
            const spyEdit = vi.spyOn(MessageService, 'editMessage').mockResolvedValue(undefined);

            const res = await fetch(`${setup.baseUrl}/api/groups/edit-message`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: GROUP_ID,
                    messageId: 'msg-to-edit',
                    text: 'Edited text!'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(spyEdit).toHaveBeenCalled();
        });
    });

    describe('POST /delete-message', () => {
        it('should return 400 for invalid body', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/delete-message`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: GROUP_ID
                    // missing messageId
                })
            });
            expect(res.status).toBe(400);
        });

        it('should return 403 if MessageService throws Forbidden', async () => {
            setup.mockAuth(OWNER_ID);
            vi.spyOn(MessageService, 'deleteMessage').mockRejectedValue(new Error('Forbidden'));

            const res = await fetch(`${setup.baseUrl}/api/groups/delete-message`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: GROUP_ID,
                    messageId: 'msg-not-owned'
                })
            });

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.error).toBe('Forbidden');
        });

        it('should return 404 if MessageService throws Group not found', async () => {
            setup.mockAuth(OWNER_ID);
            vi.spyOn(MessageService, 'deleteMessage').mockRejectedValue(new Error('Group not found'));

            const res = await fetch(`${setup.baseUrl}/api/groups/delete-message`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: GROUP_ID,
                    messageId: 'msg-id'
                })
            });

            expect(res.status).toBe(404);
            const data = await res.json();
            expect(data.error).toBe('Group not found');
        });

        it('should successfully delete a message', async () => {
            setup.mockAuth(OWNER_ID);
            const spyDelete = vi.spyOn(MessageService, 'deleteMessage').mockResolvedValue(undefined);

            const res = await fetch(`${setup.baseUrl}/api/groups/delete-message`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: GROUP_ID,
                    messageId: 'msg-to-delete'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(spyDelete).toHaveBeenCalled();
        });

        it('should return 403 when error message contains own messages', async () => {
            setup.mockAuth(OWNER_ID);
            vi.spyOn(MessageService, 'deleteMessage').mockRejectedValue(
                new Error('You can only delete your own messages')
            );

            const res = await fetch(`${setup.baseUrl}/api/groups/delete-message`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: GROUP_ID,
                    messageId: 'msg-not-owned'
                })
            });

            expect(res.status).toBe(403);
        });

        it('should return 500 for unexpected error in delete-message', async () => {
            setup.mockAuth(OWNER_ID);
            vi.spyOn(MessageService, 'deleteMessage').mockRejectedValue(new Error('Unexpected DB failure'));

            const res = await fetch(`${setup.baseUrl}/api/groups/delete-message`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    groupId: GROUP_ID,
                    messageId: 'msg-id'
                })
            });

            expect(res.status).toBe(500);
        });
    });

    describe('POST /send-cheer', () => {
        it('should return 400 for self cheer', async () => {
            setup.mockAuth(OWNER_ID);
            const res = await fetch(`${setup.baseUrl}/api/groups/send-cheer`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    targetUid: OWNER_ID, // self cheer
                    groupId: GROUP_ID,
                    language: 'en'
                })
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('Self cheer');
        });

        it('should return 429 if alreadySent', async () => {
            setup.mockAuth(OWNER_ID);
            vi.spyOn(MessageService, 'sendCheer').mockResolvedValue({
                alreadySent: true,
                targetData: null
            });

            const res = await fetch(`${setup.baseUrl}/api/groups/send-cheer`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    targetUid: MEMBER_ID,
                    groupId: GROUP_ID,
                    language: 'en'
                })
            });

            expect(res.status).toBe(429);
            const data = await res.json();
            expect(data.error).toBe('alreadySent');
        });

        it('should successfully send a cheer', async () => {
            setup.mockAuth(OWNER_ID);
            vi.spyOn(MessageService, 'sendCheer').mockResolvedValue({
                alreadySent: false,
                senderNickname: 'Owner User',
                targetData: { language: 'ja' } as any
            });

            const res = await fetch(`${setup.baseUrl}/api/groups/send-cheer`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    targetUid: MEMBER_ID,
                    groupId: GROUP_ID,
                    language: 'ja'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
        });

        it('should return 500 when MessageService.sendCheer throws', async () => {
            setup.mockAuth(OWNER_ID);
            vi.spyOn(MessageService, 'sendCheer').mockRejectedValue(new Error('DB Error'));

            const res = await fetch(`${setup.baseUrl}/api/groups/send-cheer`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${OWNER_ID}`
                },
                body: JSON.stringify({
                    targetUid: MEMBER_ID,
                    groupId: GROUP_ID,
                    language: 'en'
                })
            });

            expect(res.status).toBe(500);
        });
    });
});
