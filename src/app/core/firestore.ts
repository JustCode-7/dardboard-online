import { inject, InjectionToken } from '@angular/core';
import { connectFirestoreEmulator, Firestore, getFirestore } from 'firebase/firestore';
import { APP_ENVIRONMENT, FIREBASE_APP } from './firebase';

/** Read-only Firestore access (`onSnapshot`); `firestore.rules` deny every client write. */
export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE', {
  providedIn: 'root',
  factory: () => {
    const app = inject(FIREBASE_APP);
    const databaseId = inject(APP_ENVIRONMENT).firebase.databaseId;
    const db = getFirestore(app, databaseId);
    const emulators = inject(APP_ENVIRONMENT).emulators;
    if (emulators) {
      connectFirestoreEmulator(db, emulators.firestoreHost, emulators.firestorePort);
    }
    return db;
  },
});
