/* eslint-disable no-restricted-properties */
import type { Firestore, Transaction } from 'firebase-admin/firestore';

export type ReadOnlyTransaction = Pick<Transaction, 'get' | 'getAll'>;

export interface PhasedTransactionContext<TRead, TWrite = unknown> {
    /**
     * Read phase: Execute all reads (get, getAll) here.
     * Do NOT execute set, update, or delete in this block.
     */
    read: (transaction: ReadOnlyTransaction) => Promise<TRead>;

    /**
     * Write phase: Execute all mutations (set, update, delete) here.
     * The result of the read phase is passed as the second argument.
     * Do NOT execute reads (get, getAll) in this block.
     */
    write: (transaction: Transaction, readResult: TRead) => Promise<TWrite> | TWrite;
}

/**
 * Runs a Firestore transaction ensuring strict separation between Read and Write operations.
 * Enforces the "Read before Write" pattern programmatically.
 */
export async function runPhasedTransaction<TRead, TWrite = unknown>(
    db: Firestore,
    phases: PhasedTransactionContext<TRead, TWrite>
): Promise<TWrite> {
    return db.runTransaction(async (transaction) => {
        // 1. Read Phase
        const readResult = await phases.read(transaction);
        // 2. Write Phase
        return await phases.write(transaction, readResult);
    });
}
