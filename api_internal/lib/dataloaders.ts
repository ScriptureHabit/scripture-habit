import DataLoader from 'dataloader';
import { db } from './firebase-admin.js';
import { UserDocument, GroupDocument } from '../../types/firestore.js';
import { Request, Response, NextFunction } from 'express';

/**
 * Creates a DataLoader for batching and caching Firestore User document fetches.
 */
export function createUserDataLoader(): DataLoader<string, UserDocument | null> {
  return new DataLoader<string, UserDocument | null>(async (userIds: readonly string[]) => {
    if (!userIds.length) return [];
    if (!db) return userIds.map(() => null);

    const docRefs = userIds.map((id) => db.collection('users').doc(id));
    const snapshots = await db.getAll(...docRefs);

    const userMap = new Map<string, UserDocument>();
    snapshots.forEach((snap) => {
      if (snap.exists) {
        userMap.set(snap.id, snap.data() as UserDocument);
      }
    });

    return userIds.map((id) => userMap.get(id) || null);
  });
}

/**
 * Creates a DataLoader for batching and caching Firestore Group document fetches.
 */
export function createGroupDataLoader(): DataLoader<string, GroupDocument | null> {
  return new DataLoader<string, GroupDocument | null>(async (groupIds: readonly string[]) => {
    if (!groupIds.length) return [];
    if (!db) return groupIds.map(() => null);

    const docRefs = groupIds.map((id) => db.collection('groups').doc(id));
    const snapshots = await db.getAll(...docRefs);

    const groupMap = new Map<string, GroupDocument>();
    snapshots.forEach((snap) => {
      if (snap.exists) {
        groupMap.set(snap.id, snap.data() as GroupDocument);
      }
    });

    return groupIds.map((id) => groupMap.get(id) || null);
  });
}

export interface RequestLoaders {
  userLoader: DataLoader<string, UserDocument | null>;
  groupLoader: DataLoader<string, GroupDocument | null>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      loaders?: RequestLoaders;
    }
  }
}

/**
 * Express middleware to attach request-scoped DataLoaders to each incoming request.
 */
export function dataLoaderMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.loaders = {
    userLoader: createUserDataLoader(),
    groupLoader: createGroupDataLoader(),
  };
  next();
}
