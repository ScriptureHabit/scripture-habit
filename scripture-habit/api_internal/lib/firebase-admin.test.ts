// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { resolveServiceAccount } from './firebase-admin.js';

/**
 * Unit tests for resolveServiceAccount() — the extracted, pure credential
 * resolution logic from firebase-admin.ts. These cover the 4 branches that
 * cannot be hit in integration tests (where the emulator path always runs first).
 */
describe('resolveServiceAccount', () => {
    // Stubs so tests don't touch the real filesystem
    const noFile = (_p: string) => false;
    const noRead = (_p: string, _enc: BufferEncoding) => '';

    it('parses FIREBASE_SERVICE_ACCOUNT JSON when provided', () => {
        const account = { projectId: 'proj', privateKey: 'pk', clientEmail: 'ce@proj.iam.gserviceaccount.com' };
        const env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify(account) } as NodeJS.ProcessEnv;

        const result = resolveServiceAccount(env, noFile, noRead, '/fake/dir');

        expect(result).toEqual(account);
    });

    it('returns undefined and logs error when FIREBASE_SERVICE_ACCOUNT is invalid JSON', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const env = { FIREBASE_SERVICE_ACCOUNT: 'not-valid-json{{{' } as NodeJS.ProcessEnv;

        const result = resolveServiceAccount(env, noFile, noRead, '/fake/dir');

        expect(result).toBeUndefined();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT:'),
            expect.any(String)
        );
        consoleSpy.mockRestore();
    });

    it('builds service account from individual env vars (FIREBASE_PROJECT_ID + FIREBASE_PRIVATE_KEY)', () => {
        const env = {
            FIREBASE_PROJECT_ID: 'my-project',
            FIREBASE_PRIVATE_KEY: 'my-private-key\\nmore-key',
            FIREBASE_CLIENT_EMAIL: 'sa@my-project.iam.gserviceaccount.com',
        } as NodeJS.ProcessEnv;

        const result = resolveServiceAccount(env, noFile, noRead, '/fake/dir');

        expect(result).toEqual({
            projectId: 'my-project',
            privateKey: 'my-private-key\nmore-key', // \\n must be expanded
            clientEmail: 'sa@my-project.iam.gserviceaccount.com',
        });
    });

    it('reads the service account JSON from the local file path as fallback', () => {
        const fakeAccount = { projectId: 'file-proj', privateKey: 'file-pk', clientEmail: 'file@proj.iam.gserviceaccount.com' };
        const fileExists = (_p: string) => true;
        const readFile = (_p: string, _enc: BufferEncoding) => JSON.stringify(fakeAccount);

        const result = resolveServiceAccount({} as NodeJS.ProcessEnv, fileExists, readFile, '/fake/dir');

        expect(result).toEqual(fakeAccount);
    });

    it('returns undefined when no credentials are available and service account file does not exist', () => {
        const result = resolveServiceAccount({} as NodeJS.ProcessEnv, noFile, noRead, '/fake/dir');
        expect(result).toBeUndefined();
    });

    it('prefers FIREBASE_SERVICE_ACCOUNT over individual env vars when both are set', () => {
        const account = { projectId: 'from-json', privateKey: 'json-pk', clientEmail: 'json@proj.iam.gserviceaccount.com' };
        const env = {
            FIREBASE_SERVICE_ACCOUNT: JSON.stringify(account),
            FIREBASE_PROJECT_ID: 'should-be-ignored',
            FIREBASE_PRIVATE_KEY: 'should-be-ignored',
        } as NodeJS.ProcessEnv;

        const result = resolveServiceAccount(env, noFile, noRead, '/fake/dir');
        expect(result?.projectId).toBe('from-json');
    });
});
