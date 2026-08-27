import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';

/**
 * Firestore Security Rules Unit Tests
 * Run with: firebase emulators:exec "npx vitest tests/rules.test.ts"
 */
describe('Firestore Security Rules', () => {
    let testEnv: RulesTestEnvironment;
    const PROJECT_ID = 'rules-test-project';

    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            firestore: {
                rules: readFileSync('firestore.rules', 'utf8'),
                host: '127.0.0.1',
                port: 8080,
            },
        });
    });

    afterAll(async () => {
        await testEnv.cleanup();
    });

    beforeEach(async () => {
        await testEnv.clearFirestore();
    });

    // --- Seeding Factory Helpers to prevent direct schema/seeding dependency scattering ---
    const seedUser = async (uid: string, data: Record<string, any> = {}) => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), `users/${uid}`), { nickname: uid, ...data });
        });
    };

    const seedNote = async (uid: string, noteId: string, data: Record<string, any> = {}) => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), `users/${uid}/notes/${noteId}`), data);
        });
    };

    const seedLetter = async (uid: string, letterId: string, data: Record<string, any> = {}) => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), `users/${uid}/letters/${letterId}`), data);
        });
    };

    const seedGroup = async (groupId: string, data: Record<string, any> = {}) => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), `groups/${groupId}`), data);
        });
    };

    const seedMessage = async (groupId: string, messageId: string, data: Record<string, any> = {}) => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), `groups/${groupId}/messages/${messageId}`), data);
        });
    };

    const seedPrivateToken = async (uid: string, data: Record<string, any> = {}) => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), `users/${uid}/private/tokens`), data);
        });
    };

    const seedGroupState = async (uid: string, groupId: string, data: Record<string, any> = {}) => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), `users/${uid}/groupStates/${groupId}`), data);
        });
    };

    const seedCheer = async (cheerId: string, data: Record<string, any> = {}) => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), `cheers/${cheerId}`), data);
        });
    };

    describe('Users Collection', () => {
        it('should allow user to read their own profile', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedUser('alice', { nickname: 'Alice' });
            await assertSucceeds(getDoc(doc(alice.firestore(), 'users/alice')));
        });

        it('should deny user from reading another profile (if not verified)', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: false });
            await seedUser('bob', { nickname: 'Bob' });
            await assertFails(getDoc(doc(alice.firestore(), 'users/bob')));
        });

        it('should allow verified user to read another profile', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedUser('bob', { nickname: 'Bob' });
            await assertSucceeds(getDoc(doc(alice.firestore(), 'users/bob')));
        });

        it('should deny profile updates (all via API)', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await assertFails(setDoc(doc(alice.firestore(), 'users/alice'), { nickname: 'Hacker' }));
        });
    });

    describe('User Notes', () => {
        it('should allow user to read/write their own notes', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            const noteRef = doc(alice.firestore(), 'users/alice/notes/note1');
            await assertSucceeds(setDoc(noteRef, { content: 'My note' }));
            await assertSucceeds(getDoc(noteRef));
        });

        it('should deny reading another users notes', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedNote('bob', 'note1', { content: 'Secret' });
            await assertFails(getDoc(doc(alice.firestore(), 'users/bob/notes/note1')));
        });
    });

    describe('User Letters', () => {
        it('should allow user to read/write their own letters', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            const letterRef = doc(alice.firestore(), 'users/alice/letters/letter1');
            await assertSucceeds(setDoc(letterRef, { content: 'My recap letter', title: 'Week 1' }));
            await assertSucceeds(getDoc(letterRef));
        });

        it('should deny reading another users letters', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedLetter('bob', 'letter1', { content: 'Secret recap' });
            await assertFails(getDoc(doc(alice.firestore(), 'users/bob/letters/letter1')));
        });
    });

    describe('Groups Collection', () => {
        it('should allow verified member to read group', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedGroup('private_grp', { members: ['alice'] });
            await assertSucceeds(getDoc(doc(alice.firestore(), 'groups/private_grp')));
        });

        it('should deny unverified user from reading groups even if member', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: false });
            await seedGroup('private_grp', { members: ['alice'] });
            await assertFails(getDoc(doc(alice.firestore(), 'groups/private_grp')));
        });

        it('should deny non-member from reading group', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedGroup('private_grp', { members: ['bob'] });
            await assertFails(getDoc(doc(alice.firestore(), 'groups/private_grp')));
        });

        it('should deny creating a group directly from the client under any circumstances', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await assertFails(setDoc(doc(alice.firestore(), 'groups/g4'), {
                ownerUserId: 'alice',
                name: 'Group 4'
            }));
        });
    });

    describe('Group Messages', () => {
        it('should allow member to read group messages', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedGroup('grp1', { members: ['alice'] });
            await seedMessage('grp1', 'msg1', { text: 'Hello' });
            await assertSucceeds(getDoc(doc(alice.firestore(), 'groups/grp1/messages/msg1')));
        });

        it('should deny non-member from reading group messages', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedGroup('grp1', { members: ['bob'] });
            await seedMessage('grp1', 'msg1', { text: 'Secret' });
            await assertFails(getDoc(doc(alice.firestore(), 'groups/grp1/messages/msg1')));
        });
    });

    describe('Private & Group States', () => {
        it('should deny reading another users private tokens', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedPrivateToken('bob', { token: 'secret' });
            await assertFails(getDoc(doc(alice.firestore(), 'users/bob/private/tokens')));
        });

        it('should deny reading another users group states', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedGroupState('bob', 'grp1', { some: 'state' });
            await assertFails(getDoc(doc(alice.firestore(), 'users/bob/groupStates/grp1')));
        });
    });

    describe('Cheers & Reports', () => {
        it('should allow sender to read their sent cheers', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedCheer('ch1', { senderUid: 'alice', targetUid: 'bob' });
            await assertSucceeds(getDoc(doc(alice.firestore(), 'cheers/ch1')));
        });

        it('should allow recipient to read their received cheers', async () => {
            const bob = testEnv.authenticatedContext('bob', { email_verified: true });
            await seedCheer('ch1', { senderUid: 'alice', targetUid: 'bob' });
            await assertSucceeds(getDoc(doc(bob.firestore(), 'cheers/ch1')));
        });

        it('should deny third-party from reading cheers', async () => {
            const eve = testEnv.authenticatedContext('eve', { email_verified: true });
            await seedCheer('ch1', { senderUid: 'alice', targetUid: 'bob' });
            await assertFails(getDoc(doc(eve.firestore(), 'cheers/ch1')));
        });

        it('should allow user to create report as themselves', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await assertSucceeds(setDoc(doc(alice.firestore(), 'reports/rep1'), { reporterId: 'alice', reason: 'spam' }));
        });

        it('should deny creating report as someone else', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await assertFails(setDoc(doc(alice.firestore(), 'reports/rep1'), { reporterId: 'bob', reason: 'spam' }));
        });
    });

    describe('Authentication Helpers', () => {
        it('should deny unverified users even with @example.com email', async () => {
            const tester = testEnv.authenticatedContext('tester', {
                email: 'test@example.com',
                email_verified: false
            });
            await seedGroup('private_grp', { members: ['tester'] });
            await assertFails(getDoc(doc(tester.firestore(), 'groups/private_grp')));
        });

        it('should allow verified users to access their groups', async () => {
            const tester = testEnv.authenticatedContext('tester', {
                email: 'test@example.com',
                email_verified: true
            });
            await seedGroup('private_grp', { members: ['tester'] });
            await assertSucceeds(getDoc(doc(tester.firestore(), 'groups/private_grp')));
        });
    });

    describe('List Queries Filtering', () => {
        it('should correctly filter groups by membership in list query', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await seedGroup('grp1', { members: ['alice'] });
            await seedGroup('grp2', { members: ['bob'] });

            // Alice should only be able to query groups she is a member of
            const q = query(collection(alice.firestore(), 'groups'));
            // This query should FAIL because it attempts to list ALL groups including grp2.
            await assertFails(getDocs(q));

            // This query should SUCCEED because it filters for Alice's membership
            const joinedQuery = query(collection(alice.firestore(), 'groups'), where('members', 'array-contains', 'alice'));
            await assertSucceeds(getDocs(joinedQuery));
        });
    });

    describe('updateDoc / deleteDoc Coverage', () => {
        describe('Users Collection', () => {
            it('should allow user to update their own profile', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: true });
                await seedUser('alice', { nickname: 'Alice' });
                // Rule: allow update if request.auth.uid == userId
                await assertSucceeds(updateDoc(doc(alice.firestore(), 'users/alice'), { nickname: 'Alice Updated' }));
            });

            it('should allow user to update their own profile even if email is not verified', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: false });
                await seedUser('alice', { nickname: 'Alice' });
                await assertSucceeds(updateDoc(doc(alice.firestore(), 'users/alice'), { nickname: 'Alice Updated' }));
            });

            it('should allow user to delete their own profile', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: true });
                await seedUser('alice', { nickname: 'Alice' });
                // Rule: allow delete if isAuthenticated() && request.auth.uid == userId
                await assertSucceeds(deleteDoc(doc(alice.firestore(), 'users/alice')));
            });

            it('should deny deleting own profile if email is not verified', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: false });
                await seedUser('alice', { nickname: 'Alice' });
                await assertFails(deleteDoc(doc(alice.firestore(), 'users/alice')));
            });

            it('should deny deleting another user\'s profile', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: true });
                await seedUser('bob', { nickname: 'Bob' });
                await assertFails(deleteDoc(doc(alice.firestore(), 'users/bob')));
            });
        });

        describe('User Notes', () => {
            it('should allow user to update their own note', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: true });
                await seedNote('alice', 'note1', { content: 'Original' });
                // Rule: allow write if isAuthenticated() && request.auth.uid == userId
                await assertSucceeds(updateDoc(doc(alice.firestore(), 'users/alice/notes/note1'), { content: 'Updated' }));
            });

            it('should deny updating another user\'s note', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: true });
                await seedNote('bob', 'note1', { content: 'Bob note' });
                await assertFails(updateDoc(doc(alice.firestore(), 'users/bob/notes/note1'), { content: 'Hacked' }));
            });

            it('should allow user to delete their own note', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: true });
                await seedNote('alice', 'note_to_delete', { content: 'Delete me' });
                await assertSucceeds(deleteDoc(doc(alice.firestore(), 'users/alice/notes/note_to_delete')));
            });

            it('should deny deleting another user\'s note', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: true });
                await seedNote('bob', 'note1', { content: 'Bob note' });
                await assertFails(deleteDoc(doc(alice.firestore(), 'users/bob/notes/note1')));
            });
        });

        describe('User Letters', () => {
            it('should allow user to delete their own letter', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: true });
                await seedLetter('alice', 'letter1', { content: 'Dear Alice' });
                await assertSucceeds(deleteDoc(doc(alice.firestore(), 'users/alice/letters/letter1')));
            });

            it('should deny deleting another user\'s letter', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: true });
                await seedLetter('bob', 'letter1', { content: 'Secret recap' });
                await assertFails(deleteDoc(doc(alice.firestore(), 'users/bob/letters/letter1')));
            });
        });

        describe('Groups Collection', () => {
            it('should deny updateDoc on groups directly from client (all mutations via API)', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: true });
                await seedGroup('grp1', { members: ['alice'] });
                // Rule: allow create, update, delete: if false
                await assertFails(updateDoc(doc(alice.firestore(), 'groups/grp1'), { name: 'Hacked' }));
            });

            it('should deny deleteDoc on groups directly from client', async () => {
                const alice = testEnv.authenticatedContext('alice', { email_verified: true });
                await seedGroup('grp1', { members: ['alice'] });
                await assertFails(deleteDoc(doc(alice.firestore(), 'groups/grp1')));
            });
        });
    });
});
