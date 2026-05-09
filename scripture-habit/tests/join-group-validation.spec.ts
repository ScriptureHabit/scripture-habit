import { test, expect } from './fixtures/auth.fixture';

test.describe('Group Joining Validation', () => {
  test('should successfully join a group when conditions are met', async ({ authenticatedPage: page }) => {
    const result = await page.evaluate(async () => {
      const auth = window.firebaseAuth;
      const idToken = await auth!.currentUser!.getIdToken();
      
      async function callApi(endpoint: string, body: Record<string, unknown>) {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify(body)
        });
        return await resp.json();
      }

      // 1. Create a group
      const createResp = await callApi('/api/create-group', { 
        name: 'Success Join Test', 
        isPublic: true 
      });
      const gid = createResp.groupId;

      // 2. Leave the group so we can join it
      await callApi('/api/leave-group', { groupId: gid });

      // 3. Join the group
      const joinResp = await callApi('/api/join-group', { groupId: gid });
      
      // Cleanup
      await callApi('/api/leave-group', { groupId: gid });
      
      return joinResp;
    });

    expect(result.message).toBe('Success');
    expect(result.gid).toBeDefined();
  });

  test('should fail to join a group if already a member', async ({ authenticatedPage: page }) => {
    // 1. Create a group first (owner becomes a member automatically)
    const createResp = await page.evaluate(async () => {
      const auth = window.firebaseAuth;
      if (!auth?.currentUser) throw new Error('Not authenticated in browser');
      const idToken = await auth.currentUser.getIdToken();
      
      const resp = await fetch('/api/create-group', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          name: 'Already Member Test Group',
          isPublic: true
        })
      });
      const data = await resp.json();
      return { status: resp.status, ...data };
    });

    const newGroupId = createResp.groupId;
    expect(createResp.status).toBe(200);
    expect(newGroupId).toBeDefined();

    // 2. Try to join the group we just created (should fail because we are the owner/member)
    const joinResp = await page.evaluate(async (gid) => {
      const auth = window.firebaseAuth;
      if (!auth?.currentUser) throw new Error('Not authenticated in browser');
      const idToken = await auth.currentUser.getIdToken();
      
      const resp = await fetch('/api/join-group', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId: gid })
      });
      const data = await resp.json();
      return { status: resp.status, error: data.error };
    }, newGroupId);

    expect(joinResp.status).toBe(400);
    expect(joinResp.error).toMatch(/already a member/i);

    // Cleanup: Leave the group so other tests start fresh
    await page.evaluate(async (gid) => {
      const auth = window.firebaseAuth;
      const idToken = await auth!.currentUser!.getIdToken();
      await fetch('/api/leave-group', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId: gid })
      });
    }, newGroupId);
  });

  test('should fail to join a group if limit reached', async ({ authenticatedPage: page }) => {
    const result = await page.evaluate(async () => {
        const auth = window.firebaseAuth;
        if (!auth?.currentUser) throw new Error('Not authenticated in browser');
        const idToken = await auth.currentUser.getIdToken();

        async function callApi(endpoint: string, body: Record<string, unknown>) {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify(body)
            });
            const data = await resp.json();
            return { status: resp.status, ...data };
        }

        // 1. Create a group to join later
        const firstGroup = await callApi('/api/create-group', { 
            name: 'Join Target', 
            isPublic: true 
        });
        if (firstGroup.status !== 200) throw new Error('Failed to create target group');
        const targetGroupId = firstGroup.groupId;

        // 2. Leave it so we are not a member
        await callApi('/api/leave-group', { groupId: targetGroupId });

        // 3. Create 4 groups to reach the limit (MAX_GROUPS_PER_USER = 4)
        const createdGroupIds = [];
        for (let i = 0; i < 4; i++) {
            const createResp = await callApi('/api/create-group', { 
                name: `FillGroup${i}`, 
                isPublic: true 
            });
            if (createResp.status !== 200) {
                throw new Error(`Failed to create fill group ${i}: ${JSON.stringify(createResp)}`);
            }
            createdGroupIds.push(createResp.groupId);
        }

        // 4. Try to join the target group (should fail)
        const joinResp = await callApi('/api/join-group', { groupId: targetGroupId });
        
        // Cleanup: Leave all created groups
        for (const gid of createdGroupIds) {
            await callApi('/api/leave-group', { groupId: gid });
        }

        return joinResp;
    });

    expect(result.status).toBe(400);
    expect(result.error).toMatch(/up to 4 groups/i);
  });

  test('should fail to join a non-existent group', async ({ authenticatedPage: page }) => {
    const joinResp = await page.evaluate(async () => {
      const auth = window.firebaseAuth;
      if (!auth?.currentUser) throw new Error('Not authenticated in browser');
      const idToken = await auth.currentUser.getIdToken();
      
      const resp = await fetch('/api/join-group', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ groupId: 'non-existent-group-id' })
      });
      const data = await resp.json();
      return { status: resp.status, error: data.error };
    });

    expect(joinResp.status).toBe(400);
    expect(joinResp.error).toMatch(/not found/i);
  });
});
