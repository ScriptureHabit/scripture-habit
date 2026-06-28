// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from './firebase-admin.js';
import { runPhasedTransaction } from './phased-transaction.js';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Phased Transaction Guardrail', () => {
    it('should execute read phase and pass results to write phase', async () => {
        const docRef = db.collection('groups').doc('TX_PHASE_TEST');
        await docRef.set({ value: 10 });

        const result = await runPhasedTransaction(db, {
            read: async (transaction) => {
                const snap = await transaction.get(docRef);
                return snap.data()?.value || 0;
            },
            write: async (transaction, readValue) => {
                const newValue = readValue + 5;
                transaction.update(docRef, { value: newValue });
                return newValue;
            }
        });

        expect(result).toBe(15);
        const finalSnap = await docRef.get();
        expect(finalSnap.data()?.value).toBe(15);

        // Cleanup
        await docRef.delete();
    });

    it('should abort and rollback if read phase throws an error', async () => {
        const docRef = db.collection('groups').doc('TX_PHASE_FAIL');
        await docRef.set({ value: 10 });

        await expect(
            runPhasedTransaction(db, {
                read: async () => {
                    throw new Error('Read failed');
                },
                write: async (transaction) => {
                    transaction.update(docRef, { value: 20 });
                }
            })
        ).rejects.toThrow('Read failed');

        // Verify rollback (value remains 10)
        const snap = await docRef.get();
        expect(snap.data()?.value).toBe(10);

        // Cleanup
        await docRef.delete();
    });

    it('should abort and rollback if write phase throws an error', async () => {
        const docRef = db.collection('groups').doc('TX_PHASE_FAIL_2');
        await docRef.set({ value: 10 });

        await expect(
            runPhasedTransaction(db, {
                read: async (transaction) => {
                    const snap = await transaction.get(docRef);
                    return snap.data()?.value || 0;
                },
                write: async () => {
                    throw new Error('Write failed');
                }
            })
        ).rejects.toThrow('Write failed');

        // Verify rollback
        const snap = await docRef.get();
        expect(snap.data()?.value).toBe(10);

        // Cleanup
        await docRef.delete();
    });
});
