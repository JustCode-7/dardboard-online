import { inject, InjectionToken } from '@angular/core';
import { Functions, getFunctions } from 'firebase/functions';
import { AUTH, FIREBASE_APP } from './firebase';

/**
 * Callable client. No `connectFunctionsEmulator`: the Functions emulator cannot host the Java backend,
 * so callables are addressed by URL (`httpsCallableFromURL`, see `GameApi`).
 */
export const FUNCTIONS = new InjectionToken<Functions>('FUNCTIONS', {
  providedIn: 'root',
  factory: () => {
    // Resolve AUTH first: the callable SDK then attaches the current user's ID token automatically.
    inject(AUTH);
    return getFunctions(inject(FIREBASE_APP));
  },
});
