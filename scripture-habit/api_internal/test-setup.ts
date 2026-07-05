/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable prefer-rest-params */
import { vi } from 'vitest';
import { Server } from 'http';
import { auth, admin, db, setDbInstance } from './lib/firebase-admin.js';

/**
 * Shared setup for backend integration tests.
 * Manages the API server and Firebase Auth mocking.
 */
export class TestSetup {
    private server?: Server;
    public baseUrl: string = '';

    private originalDb: any = null;

    private txGets: number = 0;
    private txGetAlls: number = 0;
    private docGets: number = 0;
    private readPaths: string[] = [];

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
                            return target.get(ref);
                        };
                    }
                    if (prop === 'getAll') {
                        return function(...refs: any[]) {
                            self.txGetAlls++;
                            for (const ref of refs) {
                                if (ref && ref.path) {
                                    self.readPaths.push(`[Tx GETALL] ${ref.path}`);
                                }
                            }
                            return target.getAll(...refs);
                        };
                    }
                    return Reflect.get(target, prop, receiver);
                }
            });
        }

        function wrapDocRef(ref: any): any {
            return new Proxy(ref, {
                get(target, prop, receiver) {
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

        return new Proxy(db, {
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

    async start() {
        // Reset counters
        this.txGets = 0;
        this.txGetAlls = 0;
        this.docGets = 0;
        this.readPaths = [];

        // Save original DB instance and inject the Proxy wrapper
        this.originalDb = db;
        const proxyDb = this.createProxyDb();
        setDbInstance(proxyDb);

        const app = (await import('../api/api.js')).default;
        app.locals.skipAppCheck = true;

        return new Promise<void>((resolve) => {
            this.server = app.listen(0, () => {
                const addr = this.server?.address();
                if (addr && typeof addr !== 'string') {
                    this.baseUrl = `http://localhost:${addr.port}`;
                }
                resolve();
            });
        });
    }

    async stop() {
        // Restore original DB instance to cleanup state cleanly
        if (this.originalDb) {
            setDbInstance(this.originalDb);
        }

        const totalReads = this.txGets + this.txGetAlls + this.docGets;

        console.log(`\n📊 [Firestore Read Audit] -----------------------------`);
        console.log(`   Transaction GETs:    ${this.txGets}`);
        console.log(`   Transaction GETALLs: ${this.txGetAlls}`);
        console.log(`   Document GETs:       ${this.docGets}`);
        console.log(`   👉 Total Reads:      ${totalReads}`);

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
            this.server?.close(() => resolve());
        });
    }

    mockAuth(uid: string = 'test-user', emailVerified: boolean = true) {
        vi.spyOn(auth, 'verifyIdToken').mockResolvedValue({
            uid,
            email_verified: emailVerified,
            firebase: { sign_in_provider: 'password' }
        } as unknown as admin.auth.DecodedIdToken);
    }

    mockAuthMultiple() {
        vi.spyOn(auth, 'verifyIdToken').mockImplementation(async (token) => {
            const uid = token.replace('token-', '');
            return {
                uid,
                email_verified: true,
                firebase: { sign_in_provider: 'password' }
            } as unknown as admin.auth.DecodedIdToken;
        });
    }
}
