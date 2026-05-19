// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';

const originalEnv = { ...process.env };

afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
});

describe('load-env', () => {
    it('logs success when both .env and .env.local are loaded', async () => {
        vi.doMock('dotenv', () => ({
            __esModule: true,
            default: {
                config: vi.fn()
                    .mockReturnValueOnce({ parsed: { KEY: 'value' } })
                    .mockReturnValueOnce({ parsed: { OVERRIDE: 'value2' } })
            }
        }));

        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await import('./load-env.js');

        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Env] Attempting to load from:'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Env] Successfully loaded .env. Keys: KEY'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Env] Successfully loaded .env.local. Keys: OVERRIDE'));
        expect(logSpy).toHaveBeenCalledWith('[Env] Environment variables loading process complete');
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('logs warning and optional message when .env and .env.local are missing without CI', async () => {
        const errorA = new Error('ENOENT: .env not found');
        const errorB = new Error('ENOENT: .env.local not found');

        vi.doMock('dotenv', () => ({
            __esModule: true,
            default: {
                config: vi.fn()
                    .mockReturnValueOnce({ error: errorA })
                    .mockReturnValueOnce({ error: errorB })
            }
        }));

        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        delete process.env.CI;
        delete process.env.VITE_USE_FIREBASE_EMULATOR;

        await import('./load-env.js');

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[Env] Failed to load .env:'));
        expect(logSpy).toHaveBeenCalledWith('[Env] .env.local not found (optional)');
        expect(logSpy).toHaveBeenCalledWith('[Env] Environment variables loading process complete');
    });

    it('logs fallback info when .env is missing but CI or emulator is set', async () => {
        const errorA = new Error('ENOENT: .env not found');
        const errorB = new Error('ENOENT: .env.local not found');

        vi.doMock('dotenv', () => ({
            __esModule: true,
            default: {
                config: vi.fn()
                    .mockReturnValueOnce({ error: errorA })
                    .mockReturnValueOnce({ error: errorB })
            }
        }));

        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        process.env.CI = 'true';
        process.env.VITE_USE_FIREBASE_EMULATOR = 'true';

        await import('./load-env.js');

        expect(logSpy).toHaveBeenCalledWith('[Env] .env not found, using system environment variables and fallback config.');
        expect(warnSpy).not.toHaveBeenCalled();
    });
});
