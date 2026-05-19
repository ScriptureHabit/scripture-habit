// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db, admin } from '../lib/firebase-admin.js';
import { TestSetup } from '../test-setup.js';
import { ProfileService } from '../services/profile-service.js';

describe('Auth Route Integration', () => {
    vi.setConfig({ testTimeout: 30000 });
    const setup = new TestSetup();

    const USER_ID = 'AUTH_TEST_USER';
    const TEST_EMAIL = 'auth_test@example.com';
    const TEST_LOCAL_EMAIL = 'auth_test@test.local';

    beforeAll(async () => {
        await setup.start();
    });

    afterAll(async () => {
        await setup.stop();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('POST /update-profile', () => {
        beforeEach(async () => {
            await db.collection('users').doc(USER_ID).set({
                uid: USER_ID,
                nickname: 'Original Nickname',
                email: TEST_EMAIL
            });
        });

        it('should return 401 if unauthenticated', async () => {
            const res = await fetch(`${setup.baseUrl}/api/auth/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname: 'New Nickname' })
            });
            expect(res.status).toBe(401);
        });

        it('should return 400 if no fields to update are provided', async () => {
            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/update-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({})
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('No fields to update');
        });

        it('should successfully update profile fields and sync to chats', async () => {
            const syncSpy = vi.spyOn(ProfileService, 'syncProfileToChats').mockResolvedValue(undefined);

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/update-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    nickname: 'Updated Nickname',
                    photoURL: 'https://example.com/photo.jpg',
                    stake: 'Test Stake',
                    ward: 'Test Ward',
                    bio: 'Hello bio',
                    language: 'pt'
                })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Profile updated and synced.');

            // Verify Firestore update
            const userSnap = await db.collection('users').doc(USER_ID).get();
            const userData = userSnap.data()!;
            expect(userData.nickname).toBe('Updated Nickname');
            expect(userData.photoURL).toBe('https://example.com/photo.jpg');
            expect(userData.stake).toBe('Test Stake');
            expect(userData.ward).toBe('Test Ward');
            expect(userData.bio).toBe('Hello bio');
            expect(userData.language).toBe('pt');

            // Verify background sync was called
            expect(syncSpy).toHaveBeenCalledWith(USER_ID, {
                nickname: 'Updated Nickname',
                photoURL: 'https://example.com/photo.jpg'
            });
        });

        it('should work when only photoURL is updated (covering nickname || photoURL branch)', async () => {
            const syncSpy = vi.spyOn(ProfileService, 'syncProfileToChats').mockResolvedValue(undefined);

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/update-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    photoURL: 'https://example.com/only-photo.jpg'
                })
            });

            expect(res.status).toBe(200);
            expect(syncSpy).toHaveBeenCalledWith(USER_ID, {
                nickname: undefined,
                photoURL: 'https://example.com/only-photo.jpg'
            });
        });

        it('should work when only nickname is updated', async () => {
            const syncSpy = vi.spyOn(ProfileService, 'syncProfileToChats').mockResolvedValue(undefined);

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/update-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    nickname: 'Only Nickname'
                })
            });

            expect(res.status).toBe(200);
            expect(syncSpy).toHaveBeenCalledWith(USER_ID, {
                nickname: 'Only Nickname',
                photoURL: undefined
            });
        });

        it('should log error but succeed when ProfileService sync throws error in background', async () => {
            const syncSpy = vi.spyOn(ProfileService, 'syncProfileToChats').mockRejectedValue(new Error('Sync failed'));
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/update-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    nickname: 'Another Name'
                })
            });

            expect(res.status).toBe(200);
            expect(syncSpy).toHaveBeenCalled();
            // Give event loop time to log background error
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should return 500 when update throws an error (covering catch block)', async () => {
            vi.spyOn(admin.firestore.DocumentReference.prototype, 'update').mockRejectedValue(new Error('Update failed'));

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/update-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ nickname: 'Failing Update' })
            });

            expect(res.status).toBe(500);
        });
    });

    describe('POST /initialize-profile', () => {
        beforeEach(async () => {
            // Clear existing document to be sure
            await db.collection('users').doc(USER_ID).delete();
        });

        it('should return 401 if unauthenticated', async () => {
            const res = await fetch(`${setup.baseUrl}/api/auth/initialize-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname: 'New User' })
            });
            expect(res.status).toBe(401);
        });

        it('should return 200 if profile already exists', async () => {
            await db.collection('users').doc(USER_ID).set({
                uid: USER_ID,
                nickname: 'Already Exists',
                email: TEST_EMAIL
            });

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/initialize-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ nickname: 'Ignoring this' })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Profile already exists.');
            expect(data.userData.nickname).toBe('Already Exists');
        });

        it('should initialize profile with standard email correctly', async () => {
            // Mock auth token payload
            vi.spyOn(admin.auth(), 'verifyIdToken').mockResolvedValue({
                uid: USER_ID,
                email: 'regular_user@gmail.com',
                email_verified: true,
                firebase: { sign_in_provider: 'password' }
            } as any);

            const res = await fetch(`${setup.baseUrl}/api/auth/initialize-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    nickname: 'Reg User',
                    timeZone: 'Europe/London',
                    language: 'es'
                })
            });

            expect(res.status).toBe(201);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Profile initialized successfully.');

            // Verify Firestore doc creation
            const userSnap = await db.collection('users').doc(USER_ID).get();
            const userData = userSnap.data()!;
            expect(userData.uid).toBe(USER_ID);
            expect(userData.email).toBe('regular_user@gmail.com');
            expect(userData.nickname).toBe('Reg User');
            expect(userData.timeZone).toBe('Europe/London');
            expect(userData.language).toBe('es');
            expect(userData.kickThreshold).toBe(3);
            expect(userData.hasSetKickThreshold).toBe(false);
            expect(userData.hasSeenWelcomeStory).toBeUndefined();
        });

        it('should default nickname and email when they are missing (covering nullish coalesce branches)', async () => {
            vi.spyOn(admin.auth(), 'verifyIdToken').mockResolvedValue({
                uid: USER_ID,
                email: undefined,
                email_verified: true,
                firebase: { sign_in_provider: 'password' }
            } as any);

            const res = await fetch(`${setup.baseUrl}/api/auth/initialize-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    nickname: undefined
                })
            });

            expect(res.status).toBe(201);
            const userSnap = await db.collection('users').doc(USER_ID).get();
            const userData = userSnap.data()!;
            expect(userData.email).toBe('');
            expect(userData.nickname).toBe('New User');
        });

        it('should initialize profile with test email domain and welcome story flag correctly', async () => {
            vi.spyOn(admin.auth(), 'verifyIdToken').mockResolvedValue({
                uid: USER_ID,
                email: TEST_EMAIL, // ends with @example.com
                email_verified: true,
                firebase: { sign_in_provider: 'password' }
            } as any);

            const res = await fetch(`${setup.baseUrl}/api/auth/initialize-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    nickname: 'Test User'
                })
            });

            expect(res.status).toBe(201);
            const userSnap = await db.collection('users').doc(USER_ID).get();
            const userData = userSnap.data()!;
            expect(userData.hasSetKickThreshold).toBe(true);
            expect(userData.hasSeenWelcomeStory).toBe(true);
        });

        it('should auto-verify email for test.local domain users', async () => {
            vi.spyOn(admin.auth(), 'verifyIdToken').mockResolvedValue({
                uid: USER_ID,
                email: TEST_LOCAL_EMAIL, // ends with @test.local
                email_verified: false,
                firebase: { sign_in_provider: 'password' }
            } as any);

            const updateUserSpy = vi.spyOn(admin.auth(), 'updateUser').mockResolvedValue({} as any);

            const res = await fetch(`${setup.baseUrl}/api/auth/initialize-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({
                    nickname: 'Local Test'
                })
            });

            expect(res.status).toBe(201);
            expect(updateUserSpy).toHaveBeenCalledWith(USER_ID, { emailVerified: true });
        });

        it('should return 500 when initialization throws an error (covering catch block)', async () => {
            vi.spyOn(admin.firestore.DocumentReference.prototype, 'get').mockRejectedValue(new Error('Get failed'));
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/initialize-profile`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer token-${USER_ID}`
                },
                body: JSON.stringify({ nickname: 'Fail Init' })
            });

            expect(res.status).toBe(500);
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('POST /verify-login', () => {
        it('should return 400 if token validation fails', async () => {
            const res = await fetch(`${setup.baseUrl}/api/auth/verify-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.error).toBe('Invalid input');
        });

        it('should return 403 if email is not verified', async () => {
            vi.spyOn(admin.auth(), 'verifyIdToken').mockResolvedValue({
                uid: USER_ID,
                email: TEST_EMAIL,
                email_verified: false
            } as any);

            vi.spyOn(admin.auth(), 'getUser').mockResolvedValue({
                uid: USER_ID,
                emailVerified: false
            } as any);

            const res = await fetch(`${setup.baseUrl}/api/auth/verify-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: 'dummy-token' })
            });

            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.error).toBe('ForbiddenError');
            expect(data.code).toBe('auth/email-not-verified');
        });

        it('should return 200 on successful login verification', async () => {
            vi.spyOn(admin.auth(), 'verifyIdToken').mockResolvedValue({
                uid: USER_ID,
                email: TEST_EMAIL,
                email_verified: true
            } as any);

            vi.spyOn(admin.auth(), 'getUser').mockResolvedValue({
                uid: USER_ID,
                emailVerified: true
            } as any);

            const res = await fetch(`${setup.baseUrl}/api/auth/verify-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: 'dummy-token' })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('Login verified.');
            expect(data.uid).toBe(USER_ID);
            expect(data.email).toBe(TEST_EMAIL);
        });

        it('should return 401 if id token verification throws an error', async () => {
            vi.spyOn(admin.auth(), 'verifyIdToken').mockRejectedValue(new Error('Invalid token'));

            const res = await fetch(`${setup.baseUrl}/api/auth/verify-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: 'dummy-token' })
            });

            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.error).toBe('AuthenticationError');
        });
    });

    describe('POST /delete-account', () => {
        const GROUP_ID = 'DELETE_TEST_GRP';

        beforeEach(async () => {
            // Setup User Doc
            await db.collection('users').doc(USER_ID).set({
                uid: USER_ID,
                nickname: 'To Be Deleted',
                email: TEST_EMAIL,
                groupIds: [GROUP_ID],
                language: 'ja'
            });

            // Setup Group Doc
            await db.collection('groups').doc(GROUP_ID).set({
                name: 'Delete Test Group',
                members: [USER_ID],
                ownerId: USER_ID
            });

            // Setup Subcollection groupStates
            await db.collection(`users/${USER_ID}/groupStates`).doc(GROUP_ID).set({
                joinedAt: admin.firestore.Timestamp.now()
            });
        });

        it('should return 401 if unauthenticated', async () => {
            const res = await fetch(`${setup.baseUrl}/api/auth/delete-account`, {
                method: 'POST'
            });
            expect(res.status).toBe(401);
        });

        it('should successfully delete account and clear up groups/social data', async () => {
            const purgeSpy = vi.spyOn(ProfileService, 'purgeSocialIdentity').mockResolvedValue(undefined);
            const deleteUserSpy = vi.spyOn(admin.auth(), 'deleteUser').mockResolvedValue(undefined);

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/delete-account`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('Account and all data deleted successfully.');

            // Verify User document is deleted
            const userSnap = await db.collection('users').doc(USER_ID).get();
            expect(userSnap.exists).toBe(false);

            // Verify subcollection doc is deleted
            const stateSnap = await db.collection(`users/${USER_ID}/groupStates`).doc(GROUP_ID).get();
            expect(stateSnap.exists).toBe(false);

            // Verify background purge was called
            expect(purgeSpy).toHaveBeenCalledWith(USER_ID);
            expect(deleteUserSpy).toHaveBeenCalledWith(USER_ID);
        });

        it('should proceed and delete auth user even if user document does not exist in Firestore', async () => {
            await db.collection('users').doc(USER_ID).delete();

            const deleteUserSpy = vi.spyOn(admin.auth(), 'deleteUser').mockResolvedValue(undefined);

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/delete-account`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            expect(deleteUserSpy).toHaveBeenCalledWith(USER_ID);
        });

        it('should cover fallback branches (groupId and missing nickname/language) in exit groups logic', async () => {
            // Setup User Doc with groupId instead of groupIds, and without nickname or language
            await db.collection('users').doc(USER_ID).set({
                uid: USER_ID,
                email: TEST_EMAIL,
                groupId: GROUP_ID
            });

            // Setup Group Doc where user is member
            await db.collection('groups').doc(GROUP_ID).set({
                name: 'Delete Test Group',
                members: [USER_ID],
                ownerId: 'SOME_OTHER_OWNER'
            });

            const purgeSpy = vi.spyOn(ProfileService, 'purgeSocialIdentity').mockResolvedValue(undefined);
            const deleteUserSpy = vi.spyOn(admin.auth(), 'deleteUser').mockResolvedValue(undefined);

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/delete-account`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            expect(purgeSpy).toHaveBeenCalledWith(USER_ID);
            expect(deleteUserSpy).toHaveBeenCalledWith(USER_ID);
        });

        it('should cover fallback branches when user has no groupIds or groupId at all (covering both as undefined)', async () => {
            // Setup User Doc without groupIds or groupId
            await db.collection('users').doc(USER_ID).set({
                uid: USER_ID,
                email: TEST_EMAIL
            });

            const purgeSpy = vi.spyOn(ProfileService, 'purgeSocialIdentity').mockResolvedValue(undefined);
            const deleteUserSpy = vi.spyOn(admin.auth(), 'deleteUser').mockResolvedValue(undefined);

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/delete-account`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            expect(purgeSpy).toHaveBeenCalledWith(USER_ID);
            expect(deleteUserSpy).toHaveBeenCalledWith(USER_ID);
        });

        it('should proceed even if group cleanup transaction throws error', async () => {
            // Mock transaction to throw error
            vi.spyOn(db, 'runTransaction').mockRejectedValue(new Error('Transaction timeout'));
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const deleteUserSpy = vi.spyOn(admin.auth(), 'deleteUser').mockResolvedValue(undefined);

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/delete-account`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(deleteUserSpy).toHaveBeenCalledWith(USER_ID);
        });

        it('should proceed even if social identity purge throws error', async () => {
            vi.spyOn(ProfileService, 'purgeSocialIdentity').mockRejectedValue(new Error('Purge fail'));
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const deleteUserSpy = vi.spyOn(admin.auth(), 'deleteUser').mockResolvedValue(undefined);

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/delete-account`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(200);
            await new Promise(resolve => setTimeout(resolve, 50)); // let background job print log
            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(deleteUserSpy).toHaveBeenCalledWith(USER_ID);
        });

        it('should return 500 if critical deletion fails', async () => {
            vi.spyOn(admin.auth(), 'deleteUser').mockRejectedValue(new Error('Auth service offline'));

            setup.mockAuth(USER_ID);
            const res = await fetch(`${setup.baseUrl}/api/auth/delete-account`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer token-${USER_ID}` }
            });

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('Failed to delete account.');
        });
    });
});
