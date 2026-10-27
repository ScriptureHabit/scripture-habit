import { AsyncLocalStorage } from 'node:async_hooks';

export const testTimeStorage = new AsyncLocalStorage<number>();

export const runOutsideTestTime = <T>(callback: () => T): T =>
    testTimeStorage.exit(callback);
