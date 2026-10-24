import { inject, InjectionToken } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { environment } from '../../environments/environment';
import { AppEnvironment } from '../../environments/app-environment';

/**
 * Firebase SDK instances as lazily created, app-wide DI tokens (one instance per browser tab).
 * Firestore and Functions live in separate files (`firestore.ts`, `functions.ts`) so they are only
 * bundled into the lazily loaded game chunks. Tests override these tokens with fakes.
 */
export const APP_ENVIRONMENT = new InjectionToken<AppEnvironment>('APP_ENVIRONMENT', {
  providedIn: 'root',
  factory: () => environment,
});

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP', {
  providedIn: 'root',
  factory: () => initializeApp(inject(APP_ENVIRONMENT).firebase),
});

export const AUTH = new InjectionToken<Auth>('AUTH', {
  providedIn: 'root',
  factory: () => {
    const auth = getAuth(inject(FIREBASE_APP));
    const emulators = inject(APP_ENVIRONMENT).emulators;
    if (emulators) {
      connectAuthEmulator(auth, emulators.authUrl, { disableWarnings: true });
    }
    return auth;
  },
});
