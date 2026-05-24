/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable prefer-rest-params */
import { vi } from 'vitest';
import { Server } from 'http';
import { auth, admin } from './lib/firebase-admin.js';

/**
 * Shared setup for backend integration tests.
 * Manages the API server and Firebase Auth mocking.
 */
export class TestSetup {
    private server?: Server;
    public baseUrl: string = '';

    private originalTransactionGet: any = admin.firestore.Transaction.prototype.get;
    private originalTransactionGetAll: any = admin.firestore.Transaction.prototype.getAll;
    private originalDocumentRefGet: any = admin.firestore.DocumentReference.prototype.get;

    private txGets: number = 0;
    private txGetAlls: number = 0;
    private docGets: number = 0;
    private readPaths: string[] = [];

    async start() {
        process.env.SKIP_APP_CHECK = 'true';
        
        // Reset counters
        this.txGets = 0;
        this.txGetAlls = 0;
        this.docGets = 0;
        this.readPaths = [];

        // Wrap methods for global read auditing (immune to vi.restoreAllMocks)
        const self = this;
        (admin.firestore.Transaction.prototype as any).get = function (this: any) {
            self.txGets++;
            const ref = arguments[0];
            if (ref && ref.path) {
                self.readPaths.push(`[Tx GET] ${ref.path}`);
            }
            return (self.originalTransactionGet as any).apply(this, arguments as any);
        } as any;

        (admin.firestore.Transaction.prototype as any).getAll = function (this: any) {
            self.txGetAlls++;
            for (let i = 0; i < arguments.length; i++) {
                const ref = arguments[i];
                if (ref && ref.path) {
                    self.readPaths.push(`[Tx GETALL] ${ref.path}`);
                }
            }
            return (self.originalTransactionGetAll as any).apply(this, arguments as any);
        } as any;

        (admin.firestore.DocumentReference.prototype as any).get = function (this: any) {
            self.docGets++;
            if (this && this.path) {
                self.readPaths.push(`[Doc GET] ${this.path}`);
            }
            return (self.originalDocumentRefGet as any).apply(this, arguments as any);
        } as any;

        const app = (await import('../api/api.js')).default;
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
        // Restore original methods
        (admin.firestore.Transaction.prototype as any).get = this.originalTransactionGet;
        (admin.firestore.Transaction.prototype as any).getAll = this.originalTransactionGetAll;
        (admin.firestore.DocumentReference.prototype as any).get = this.originalDocumentRefGet;

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
