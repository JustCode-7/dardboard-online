import { FirebaseError } from 'firebase/app';

/** Local validation failures thrown before any network call. */
const LOCAL_ERROR_CODES: ReadonlySet<string> = new Set(['invalid-lobby-id', 'invalid-display-name']);

/**
 * Normalizes thrown values to a code: Firebase errors keep their code (`functions/permission-denied`,
 * `permission-denied`, `auth/network-request-failed`, ...); everything else becomes `unknown`.
 */
export function errorCode(e: unknown): string {
  if (e instanceof FirebaseError) {
    return e.code;
  }
  if (e instanceof Error && LOCAL_ERROR_CODES.has(e.message)) {
    return e.message;
  }
  return 'unknown';
}
