// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let adminMock: any = null;
vi.mock('firebase-admin', () => ({
    __esModule: true,
    get default() {
        return adminMock;
    }
}));
vi.mock('./load-env.js', () => ({ __esModule: true }));
vi.mock('fs', () => ({
    __esModule: true,
    default: {
        existsSync: vi.fn(() => false),
        readFileSync: vi.fn(() => '')
    }
}));

const createAdminMock = () => {
    const apps: Array<Record<string, unknown>> = [];
    const initializeApp = vi.fn(() => {
        apps.push({});
        return {};
    });
    const credential = {
        applicationDefault: vi.fn(() => ({ type: 'applicationDefault' })),
        cert: vi.fn((serviceAccount: unknown) => ({ type: 'cert', serviceAccount }))
    };
    const firestore = vi.fn(() => ({ settings: vi.fn() }));
    const messaging = vi.fn(() => ({ mock: true }));
    const auth = vi.fn(() => ({ mock: true }));
    const appCheck = vi.fn(() => ({ mock: true }));

    const adminMock = {
        apps,
        initializeApp,
        credential,
        firestore,
        messaging,
        auth,
        appCheck
    };

    return { adminMock, initializeApp, credential, firestore, messaging, auth, appCheck, apps };
};

const cleanupEnv = () => {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.NODE_ENV;
};

beforeEach(() => {
    cleanupEnv();
    vi.resetModules();
    vi.restoreAllMocks();
});

afterEach(() => {
    cleanupEnv();
    vi.resetModules();
    vi.restoreAllMocks();
});

describe('firebase-admin module initialization', () => {
    it('initializes Firebase Admin in emulator mode and sets Firestore settings', async () => {
        const { adminMock: mock, initializeApp, credential, firestore } = createAdminMock();
        adminMock = mock;

        process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
        process.env.FIREBASE_PROJECT_ID = 'emulator-project';

        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const module = await import('./firebase-admin.js');

        expect(initializeApp).toHaveBeenCalled();
        expect(credential.applicationDefault).toHaveBeenCalled();
        expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toContain('dummy-service-account.json');
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Firebase Admin initialized for Emulator mode (Project: emulator-project)'));
        expect(module.db).not.toBeNull();
        expect(firestore).toHaveBeenCalled();
        expect((module.db as { settings: any }).settings).toHaveBeenCalledWith({
            host: '127.0.0.1:8080',
            ssl: false,
            ignoreUndefinedProperties: true
        });
    });

    it('warns when running in test mode without emulator and without credentials', async () => {
        const { adminMock: mock } = createAdminMock();
        adminMock = mock;

        process.env.NODE_ENV = 'test';

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const module = await import('./firebase-admin.js');

        expect(warnSpy).toHaveBeenCalledWith(
            'Firebase Admin: Running in test mode without FIRESTORE_EMULATOR_HOST. Firestore operations will be skipped.'
        );
        expect(module.db).toBeNull();
    });

    it('logs initialization error when admin.initializeApp throws', async () => {
        const { adminMock: mock, credential } = createAdminMock();
        mock.initializeApp = vi.fn(() => { throw new Error('init failure'); });
        adminMock = mock;

        process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
            projectId: 'p',
            privateKey: 'pk',
            clientEmail: 'service@proj.iam.gserviceaccount.com'
        });

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const module = await import('./firebase-admin.js');

        expect(adminMock.initializeApp).toHaveBeenCalled();
        expect(credential.cert).toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith('Firebase Admin initialization error:', expect.any(Error));
        expect(module.db).toBeNull();
    });

    it('logs Firestore settings errors when db.settings throws', async () => {
        const { adminMock: mock, firestore } = createAdminMock();
        const settingsMock = vi.fn(() => { throw new Error('settings failed'); });
        firestore.mockReturnValue({ settings: settingsMock });
        adminMock = mock;

        process.env.FIREBASE_PROJECT_ID = 'proj';
        process.env.FIREBASE_PRIVATE_KEY = 'pk';
        process.env.FIREBASE_CLIENT_EMAIL = 'service@proj.iam.gserviceaccount.com';

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await import('./firebase-admin.js');

        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[Firebase Admin] Error setting Firestore settings:'),
            expect.any(Error)
        );
    });

    it('logs emulator initialization error when admin.initializeApp throws in emulator mode', async () => {
        const { adminMock: mock } = createAdminMock();
        mock.initializeApp = vi.fn(() => { throw new Error('emulator init failure'); });
        adminMock = mock;

        process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await import('./firebase-admin.js');

        expect(errorSpy).toHaveBeenCalledWith('Firebase Admin Emulator initialization error:', expect.any(Error));
    });

    it('warns when not initialized in production or development mode without credentials', async () => {
        const { adminMock: mock } = createAdminMock();
        adminMock = mock;

        process.env.NODE_ENV = 'production';

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await import('./firebase-admin.js');

        expect(warnSpy).toHaveBeenCalledWith(
            'Firebase Admin NOT initialized: Missing credentials. API routes requiring Auth or Firestore will fail.'
        );
    });
});
