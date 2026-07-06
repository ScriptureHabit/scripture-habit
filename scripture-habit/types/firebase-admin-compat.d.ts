declare global {
  namespace admin {
    namespace auth {
      type Auth = import('firebase-admin/auth').Auth;
      type DecodedIdToken = import('firebase-admin/auth').DecodedIdToken;
    }

    namespace firestore {
      type Timestamp = import('firebase-admin/firestore').Timestamp;
      type FieldValue = import('firebase-admin/firestore').FieldValue;
      type FieldPath = import('firebase-admin/firestore').FieldPath;
      type DocumentReference<T = import('firebase-admin/firestore').DocumentData, U = import('firebase-admin/firestore').DocumentData> = import('firebase-admin/firestore').DocumentReference<T, U>;
      type DocumentSnapshot<T = import('firebase-admin/firestore').DocumentData, U = import('firebase-admin/firestore').DocumentData> = import('firebase-admin/firestore').DocumentSnapshot<T, U>;
      type Transaction = import('firebase-admin/firestore').Transaction;
      type WriteBatch = import('firebase-admin/firestore').WriteBatch;
      type Query<T = import('firebase-admin/firestore').DocumentData> = import('firebase-admin/firestore').Query<T>;
      type QuerySnapshot<T = import('firebase-admin/firestore').DocumentData> = import('firebase-admin/firestore').QuerySnapshot<T>;
      type QueryDocumentSnapshot<T = import('firebase-admin/firestore').DocumentData> = import('firebase-admin/firestore').QueryDocumentSnapshot<T>;
      type CollectionReference<T = import('firebase-admin/firestore').DocumentData> = import('firebase-admin/firestore').CollectionReference<T>;
      type CollectionGroup<T = import('firebase-admin/firestore').DocumentData> = import('firebase-admin/firestore').CollectionGroup<T>;
      type AggregateQuery<T = import('firebase-admin/firestore').DocumentData> = import('firebase-admin/firestore').AggregateQuery<T>;
      type AggregateQuerySnapshot = import('firebase-admin/firestore').AggregateQuerySnapshot;
      type DocumentData = import('firebase-admin/firestore').DocumentData;
      type WithFieldValue<T> = import('firebase-admin/firestore').WithFieldValue<T>;
      type UpdateData<T> = import('firebase-admin/firestore').UpdateData<T>;
      type Firestore = import('firebase-admin/firestore').Firestore;
    }
  }
}

export {};
