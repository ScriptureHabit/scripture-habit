/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable no-restricted-properties */
import { vi } from 'vitest';
import { Server } from 'http';
import net from 'net';
import { auth, db, dbStorage, rawDb, dbRegistry } from './lib/firebase-admin.js';
import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Shared setup for backend integration tests.
 * Manages the API server and Firebase Auth mocking.
 */
export class TestSetup {
    private server?: Server;
    public baseUrl: string = '';
    private proxyDb?: any;
    private port?: number;

    private txGets: number = 0;
    private txGetAlls: number = 0;
    private docGets: number = 0;
    private readPaths: string[] = [];
    private writePaths: string[] = [];

    // Builds a Firestore Proxy wrapper to audit read count metrics locally.
    // This replaces global prototype pollution hacks and ensures thread-safe parallel test execution.
    private createProxyDb() {
        const self = this;

        function wrapTransaction(tx: any) {
            return new Proxy(tx, {
                get(target, prop, receiver) {
                    if (prop === 'get') {
                        return function(ref: any) {
                            self.txGets++;
                            if (ref && ref.path) {
                                self.readPaths.push(`[Tx GET] ${ref.path}`);
                            }
                            const rawRef = ref && ref._rawRef ? ref._rawRef : ref;
                            return target.get(rawRef);
                        };
                    }
                    if (prop === 'getAll') {
                        return function(...refs: any[]) {
                            self.txGetAlls++;
                            const rawRefs = refs.map(ref => {
                                if (ref && ref.path) {
                                    self.readPaths.push(`[Tx GETALL] ${ref.path}`);
                                }
                                return ref && ref._rawRef ? ref._rawRef : ref;
                            });
                            return target.getAll(...rawRefs);
                        };
                    }
                    if (prop === 'update' || prop === 'set' || prop === 'delete') {
                        return function(ref: any, ...args: any[]) {
                            const rawRef = ref && ref._rawRef ? ref._rawRef : ref;
                            if (ref && ref.path) {
                                self.writePaths.push(`[Tx ${prop.toUpperCase()}] ${ref.path}`);
                            }
                            return target[prop](rawRef, ...args);
                        };
                    }
                    return Reflect.get(target, prop, receiver);
                }
            });
        }

        function wrapDocRef(ref: any): any {
            return new Proxy(ref, {
                get(target, prop, receiver) {
                    if (prop === '_rawRef') {
                        return target;
                    }
                    if (prop === 'get') {
                        return function(options?: any) {
                            self.docGets++;
                            if (target.path) {
                                self.readPaths.push(`[Doc GET] ${target.path}`);
                            }
                            return target.get(options);
                        };
                    }
                    if (prop === 'collection') {
                        return function(...args: any[]) {
                            return wrapCollectionRef((target as any).collection(...args));
                        };
                    }
                    return Reflect.get(target, prop, receiver);
                }
            });
        }

        function wrapQueryRef(queryRef: any): any {
            return new Proxy(queryRef, {
                get(target, prop, receiver) {
                    if (prop === 'get') {
                        return function(options?: any) {
                            self.docGets++;
                            const path = target.path || (target as any)._query?.path?.formattedName || '(complex query)';
                            self.readPaths.push(`[Query GET] ${path}`);
                            return target.get(options);
                        };
                    }
                    const chainMethods = ['where', 'limit', 'orderBy', 'startAfter', 'startAt', 'endBefore', 'endAt'];
                    if (typeof prop === 'string' && chainMethods.includes(prop)) {
                        return function(...args: any[]) {
                            return wrapQueryRef((target as any)[prop](...args));
                        };
                    }
                    return Reflect.get(target, prop, receiver);
                }
            });
        }

        function wrapCollectionRef(colRef: any): any {
            return new Proxy(colRef, {
                get(target, prop, receiver) {
                    if (prop === 'doc') {
                        return function(...args: any[]) {
                            return wrapDocRef((target as any).doc(...args));
                        };
                    }
                    if (prop === 'get') {
                        return function(options?: any) {
                            self.docGets++;
                            if (target.path) {
                                self.readPaths.push(`[Doc GET] ${target.path}`);
                            }
                            return target.get(options);
                        };
                    }
                    const chainMethods = ['where', 'limit', 'orderBy', 'startAfter', 'startAt', 'endBefore', 'endAt'];
                    if (typeof prop === 'string' && chainMethods.includes(prop)) {
                        return function(...args: any[]) {
                            return wrapQueryRef((target as any)[prop](...args));
                        };
                    }
                    return Reflect.get(target, prop, receiver);
                }
            });
        }

        return new Proxy(rawDb || db, {
            get(target, prop, receiver) {
                if (prop === 'doc') {
                    return function(...args: any[]) {
                        return wrapDocRef((target as any).doc(...args));
                    };
                }
                if (prop === 'collection') {
                    return function(...args: any[]) {
                        return wrapCollectionRef((target as any).collection(...args));
                    };
                }
                if (prop === 'batch') {
                    return function() {
                        const rawBatch = target.batch();
                        return new Proxy(rawBatch, {
                            get(bTarget, bProp, bReceiver) {
                                if (bProp === 'update' || bProp === 'set' || bProp === 'delete') {
                                    return function(ref: any, ...args: any[]) {
                                        const rawRef = ref && ref._rawRef ? ref._rawRef : ref;
                                        if (ref && ref.path) {
                                            self.writePaths.push(`[Batch ${bProp.toUpperCase()}] ${ref.path}`);
                                        }
                                        return (bTarget as any)[bProp](rawRef, ...args);
                                    };
                                }
                                return Reflect.get(bTarget, bProp, bReceiver);
                            }
                        });
                    };
                }
                if (prop === 'runTransaction') {
                    return async function(updateFunction: any, transactionOptions: any) {
                        return target.runTransaction(async (transaction: any) => {
                            const wrappedTx = wrapTransaction(transaction);
                            return updateFunction(wrappedTx);
                        }, transactionOptions);
                    };
                }
                return Reflect.get(target, prop, receiver);
            }
        });
    }

    private async checkPort(port: number, host: string): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            const onError = () => {
                socket.destroy();
                resolve(false);
            };
            socket.setTimeout(1000);
            socket.once('error', onError);
            socket.once('timeout', onError);
            socket.connect(port, host, () => {
                socket.end();
                resolve(true);
            });
        });
    }

    async start() {
        // Fail-Fast: Check if Firebase Emulator (Firestore) is running
        const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
        const [host, portStr] = firestoreHost.split(':');
        const port = parseInt(portStr || '8080', 10);
        
        const isRunning = await this.checkPort(port, host);
        if (!isRunning) {
            throw new Error(
                `\n❌ [TestSetup] Fatal: Firestore Emulator is NOT running at ${firestoreHost}.\n` +
                `   Please start the Firebase Emulator Suite first (e.g. via 'firebase emulators:start')\n` +
                `   before running backend integration tests to prevent timeout hanging.\n`
            );
        }

        // Reset counters
        this.txGets = 0;
        this.txGetAlls = 0;
        this.docGets = 0;
        this.readPaths = [];
        this.writePaths = [];

        // Save Proxy DB wrapper to bind to the thread context
        this.proxyDb = this.createProxyDb();
        dbStorage.enterWith(this.proxyDb);

        const app = (await import('../api/api.js')).default;
        app.locals.skipAppCheck = true;

        return new Promise<void>((resolve) => {
            this.server = app.listen(0, () => {
                const addr = this.server?.address();
                if (addr && typeof addr !== 'string') {
                    this.port = addr.port;
                    this.baseUrl = `http://localhost:${addr.port}`;
                    dbRegistry.set(addr.port, this.proxyDb);
                }
                resolve();
            });
        });
    }

    async stop() {
        // Clean up from the dynamic port registry
        if (this.port) {
            dbRegistry.delete(this.port);
        }
        
        // Disable db context storage to avoid state leaks across tests
        dbStorage.disable();

        const totalReads = this.txGets + this.txGetAlls + this.docGets;

        console.log(`\n📊 [Firestore Read Audit] -----------------------------`);
        console.log(`   Transaction GETs:    ${this.txGets}`);
        console.log(`   Transaction GETALLs: ${this.txGetAlls}`);
        console.log(`   Document GETs:       ${this.docGets}`);
        console.log(`   👉 Total Reads:      ${totalReads}`);

        if (this.writePaths.length > 0) {
            console.log(`   👉 Total Writes:     ${this.writePaths.length}`);
            this.writePaths.forEach(entry => {
                console.log(`     - ${entry}`);
            });
        }

        if (totalReads > 0) {
            const collectionCounts: Record<string, number> = {};
            this.readPaths.forEach(entry => {
                const match = entry.match(/^(?:\[.*?\]\s+)?([^/]+)/);
                if (match) {
                    const col = match[1];
                    collectionCounts[col] = (collectionCounts[col] || 0) + 1;
                }
            });
            console.log(`   Collection Breakdown:`);
            Object.entries(collectionCounts).forEach(([col, count]) => {
                console.log(`     - ${col}: ${count} reads`);
            });
        }
        console.log(`-------------------------------------------------------\n`);

        const budget = 300;
        if (totalReads > budget) {
            console.warn(`⚠️  [Firestore Read Audit] WARNING: High read count (${totalReads} > budget ${budget})! Please check for N+1 queries.`);
        }

        // Reset counters and paths to prevent state leaks
        this.txGets = 0;
        this.txGetAlls = 0;
        this.docGets = 0;
        this.readPaths = [];

        return new Promise<void>((resolve) => {
            if (this.server) {
                this.server.close(() => resolve());
            } else {
                resolve();
            }
        });
    }

    mockAuth(uid: string = 'test-user', emailVerified: boolean = true) {
        vi.spyOn(auth, 'verifyIdToken').mockResolvedValue({
            uid,
            email_verified: emailVerified,
            firebase: { sign_in_provider: 'password' }
        } as unknown as DecodedIdToken);
    }

    mockAuthMultiple() {
        vi.spyOn(auth, 'verifyIdToken').mockImplementation(async (token) => {
            const uid = token.replace('token-', '');
            return {
                uid,
                email_verified: true,
                firebase: { sign_in_provider: 'password' }
            } as unknown as DecodedIdToken;
        });
    }

    public getDocGets() {
        return this.docGets;
    }

    public getTxGets() {
        return this.txGets;
    }

    public getTxGetAlls() {
        return this.txGetAlls;
    }

    public getReadPaths() {
        return [...this.readPaths];
    }

    public getWritePaths() {
        return [...this.writePaths];
    }

    public resetCounters() {
        this.txGets = 0;
        this.txGetAlls = 0;
        this.docGets = 0;
        this.readPaths = [];
        this.writePaths = [];
    }
}
