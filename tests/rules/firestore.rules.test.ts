import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

describe('Firestore Security Rules Unit Tests', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'scripture-habit-rules-test',
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  describe('1. Users Collection (/users/{userId})', () => {
    it('allows unauthenticated user to read public system doc but NOT user docs', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      
      // System document is publicly readable
      await assertSucceeds(getDoc(doc(unauthedDb, 'system/status')));

      // User document cannot be read by unauthenticated caller
      await assertFails(getDoc(doc(unauthedDb, 'users/user_alice')));
    });

    it('allows verified user to read their own user profile', async () => {
      const aliceDb = testEnv.authenticatedContext('user_alice', {
        email_verified: true,
      }).firestore();

      // Seed Alice's profile via admin context
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await setDoc(doc(adminContext.firestore(), 'users/user_alice'), {
          nickname: 'Alice',
          createdAt: new Date().toISOString(),
        });
      });

      await assertSucceeds(getDoc(doc(aliceDb, 'users/user_alice')));
    });

    it('allows user to update their own allowed fields (e.g. nickname) but forbids unauthorized fields (e.g. role)', async () => {
      const aliceDb = testEnv.authenticatedContext('user_alice', {
        email_verified: true,
      }).firestore();

      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await setDoc(doc(adminContext.firestore(), 'users/user_alice'), {
          nickname: 'Alice',
          bio: 'Initial Bio',
        });
      });

      // Updating allowed field 'nickname' & 'bio'
      await assertSucceeds(
        updateDoc(doc(aliceDb, 'users/user_alice'), {
          nickname: 'Alice New',
          bio: 'Updated Bio',
        })
      );

      // Attempting to update disallowed field 'isAdmin' or malicious keys
      await assertFails(
        updateDoc(doc(aliceDb, 'users/user_alice'), {
          isAdmin: true,
        })
      );
    });

    it('forbids other users from updating Alice’s profile', async () => {
      const bobDb = testEnv.authenticatedContext('user_bob', {
        email_verified: true,
      }).firestore();

      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await setDoc(doc(adminContext.firestore(), 'users/user_alice'), {
          nickname: 'Alice',
        });
      });

      await assertFails(
        updateDoc(doc(bobDb, 'users/user_alice'), {
          nickname: 'Hacked by Bob',
        })
      );
    });
  });

  describe('2. User Notes (/users/{userId}/notes/{noteId})', () => {
    it('allows user to manage their own notes', async () => {
      const aliceDb = testEnv.authenticatedContext('user_alice', {
        email_verified: true,
      }).firestore();

      // Create note
      await assertSucceeds(
        setDoc(doc(aliceDb, 'users/user_alice/notes/note_1'), {
          content: 'My daily scripture insights',
          createdAt: new Date().toISOString(),
        })
      );

      // Read note
      await assertSucceeds(getDoc(doc(aliceDb, 'users/user_alice/notes/note_1')));

      // Delete note
      await assertSucceeds(deleteDoc(doc(aliceDb, 'users/user_alice/notes/note_1')));
    });

    it('strictly forbids other users from reading or writing Alice’s private notes', async () => {
      const bobDb = testEnv.authenticatedContext('user_bob', {
        email_verified: true,
      }).firestore();

      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await setDoc(doc(adminContext.firestore(), 'users/user_alice/notes/secret_note'), {
          content: 'Alice private journal',
        });
      });

      // Bob cannot read Alice's note
      await assertFails(getDoc(doc(bobDb, 'users/user_alice/notes/secret_note')));

      // Bob cannot write to Alice's notes
      await assertFails(
        setDoc(doc(bobDb, 'users/user_alice/notes/bobs_note'), {
          content: 'Injected by Bob',
        })
      );
    });
  });

  describe('3. Group Chat & Membership Isolation (/groups/{groupId}/messages/{msgId})', () => {
    beforeEach(async () => {
      // Seed a private group with Alice and Charlie as members
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        await setDoc(doc(adminContext.firestore(), 'groups/team_study'), {
          name: 'Book of Mormon Squad',
          isPublic: false,
          ownerUserId: 'user_alice',
          members: ['user_alice', 'user_charlie'],
        });

        await setDoc(doc(adminContext.firestore(), 'groups/team_study/messages/msg_1'), {
          text: 'Welcome team!',
          userId: 'user_alice',
        });
      });
    });

    it('allows verified group member (Charlie) to read group messages', async () => {
      const charlieDb = testEnv.authenticatedContext('user_charlie', {
        email_verified: true,
      }).firestore();

      await assertSucceeds(getDoc(doc(charlieDb, 'groups/team_study/messages/msg_1')));
    });

    it('forbids non-member (Bob) from reading private group messages', async () => {
      const bobDb = testEnv.authenticatedContext('user_bob', {
        email_verified: true,
      }).firestore();

      // Bob is NOT in members array
      await assertFails(getDoc(doc(bobDb, 'groups/team_study/messages/msg_1')));
    });

    it('forbids unverified email user from accessing group messages', async () => {
      const unverifiedCharlieDb = testEnv.authenticatedContext('user_charlie', {
        email_verified: false,
      }).firestore();

      await assertFails(getDoc(doc(unverifiedCharlieDb, 'groups/team_study/messages/msg_1')));
    });
  });
});
