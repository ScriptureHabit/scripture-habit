import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { describe, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';

/**
 * Firestore Security Rules Unit Tests
 * Run with: firebase emulators:exec "npx vitest tests/rules.test.ts"
 */
describe('Firestore Security Rules', () => {
    vi.setConfig({ testTimeout: 30000 });
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

    describe('Users Collection', () => {
        it('should allow user to read their own profile', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'users/alice'), { nickname: 'Alice' });
            });
            await assertSucceeds(getDoc(doc(alice.firestore(), 'users/alice')));
        });

        it('should deny user from reading another profile (if not verified)', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: false });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'users/bob'), { nickname: 'Bob' });
            });
            await assertFails(getDoc(doc(alice.firestore(), 'users/bob')));
        });

        it('should allow verified user to read another profile', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'users/bob'), { nickname: 'Bob' });
            });
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
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'users/bob/notes/note1'), { content: 'Secret' });
            });
            await assertFails(getDoc(doc(alice.firestore(), 'users/bob/notes/note1')));
        });
    });

    describe('Groups Collection', () => {
        it('should allow verified user to read public group', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'groups/public_grp'), { isPublic: true });
            });
            await assertSucceeds(getDoc(doc(alice.firestore(), 'groups/public_grp')));
        });

        it('should deny unverified user from reading groups', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: false });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'groups/public_grp'), { isPublic: true });
            });
            await assertFails(getDoc(doc(alice.firestore(), 'groups/public_grp')));
        });

        it('should allow member to read private group', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'groups/private_grp'), { 
                    isPublic: false, 
                    members: ['alice'] 
                });
            });
            await assertSucceeds(getDoc(doc(alice.firestore(), 'groups/private_grp')));
        });

        it('should deny non-member from reading private group', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'groups/private_grp'), { 
                    isPublic: false, 
                    members: ['bob'] 
                });
            });
            await assertFails(getDoc(doc(alice.firestore(), 'groups/private_grp')));
        });
    });

    describe('Group Messages', () => {
        it('should allow member to read group messages', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'groups/grp1'), { members: ['alice'] });
                await setDoc(doc(context.firestore(), 'groups/grp1/messages/msg1'), { text: 'Hello' });
            });
            await assertSucceeds(getDoc(doc(alice.firestore(), 'groups/grp1/messages/msg1')));
        });

        it('should deny non-member from reading group messages', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'groups/grp1'), { members: ['bob'] });
                await setDoc(doc(context.firestore(), 'groups/grp1/messages/msg1'), { text: 'Secret' });
            });
            await assertFails(getDoc(doc(alice.firestore(), 'groups/grp1/messages/msg1')));
        });
    });

    describe('Private & Group States', () => {
        it('should deny reading another users private tokens', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'users/bob/private/tokens'), { token: 'secret' });
            });
            await assertFails(getDoc(doc(alice.firestore(), 'users/bob/private/tokens')));
        });

        it('should deny reading another users group states', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'users/bob/groupStates/grp1'), { some: 'state' });
            });
            await assertFails(getDoc(doc(alice.firestore(), 'users/bob/groupStates/grp1')));
        });
    });

    describe('Cheers & Reports', () => {
        it('should allow sender to read their sent cheers', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'cheers/ch1'), { senderUid: 'alice', targetUid: 'bob' });
            });
            await assertSucceeds(getDoc(doc(alice.firestore(), 'cheers/ch1')));
        });

        it('should allow recipient to read their received cheers', async () => {
            const bob = testEnv.authenticatedContext('bob', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'cheers/ch1'), { senderUid: 'alice', targetUid: 'bob' });
            });
            await assertSucceeds(getDoc(doc(bob.firestore(), 'cheers/ch1')));
        });

        it('should deny third-party from reading cheers', async () => {
            const eve = testEnv.authenticatedContext('eve', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'cheers/ch1'), { senderUid: 'alice', targetUid: 'bob' });
            });
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
        it('should allow @example.com users to bypass email verification', async () => {
            const tester = testEnv.authenticatedContext('tester', { 
                email: 'test@example.com',
                email_verified: false 
            });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                await setDoc(doc(context.firestore(), 'groups/public_grp'), { isPublic: true });
            });
            await assertSucceeds(getDoc(doc(tester.firestore(), 'groups/public_grp')));
        });
    });

    describe('List Queries Filtering', () => {
        it('should correctly filter groups by membership in list query', async () => {
            const alice = testEnv.authenticatedContext('alice', { email_verified: true });
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await setDoc(doc(db, 'groups/grp1'), { isPublic: false, members: ['alice'] });
                await setDoc(doc(db, 'groups/grp2'), { isPublic: false, members: ['bob'] });
                await setDoc(doc(db, 'groups/grp3'), { isPublic: true, members: [] });
            });

            // Alice should see grp1 (joined) and grp3 (public)
            const q = query(collection(alice.firestore(), 'groups'));
            // Note: In rules-unit-testing, getDocs(q) will fail if ANY document in the collection 
            // would be denied by the list rule, UNLESS the query filters them out.
            // Our rule says: allow list if isPublic == true || uid in members.
            
            // This query should FAIL because it attempts to list ALL groups including grp2.
            await assertFails(getDocs(q));

            // This query should SUCCEED because it filters for Alice's membership
            const joinedQuery = query(collection(alice.firestore(), 'groups'), where('members', 'array-contains', 'alice'));
            await assertSucceeds(getDocs(joinedQuery));
        });
    });
});
