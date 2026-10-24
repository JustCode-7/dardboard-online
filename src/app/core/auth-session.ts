import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { onAuthStateChanged, signInAnonymously, updateProfile, User } from 'firebase/auth';
import { AUTH } from './firebase';

export const MAX_DISPLAY_NAME_LENGTH = 32;

export interface SessionUser {
  readonly uid: string;
  readonly displayName: string;
}

/**
 * Signal-based Firebase Anonymous Auth session.
 *
 * Identity is only ever proven to the backend through the ID token; the display name travels as the
 * token's `name` claim (the backend sanitizes it). Firebase persists the anonymous user locally, so a
 * reload or reconnect keeps the same uid and therefore the same seat in a lobby.
 */
@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly auth = inject(AUTH);
  private readonly current = signal<SessionUser | null>(null);
  private readonly resolved = signal(false);

  readonly user = this.current.asReadonly();
  /** `true` once Firebase restored (or ruled out) a persisted session. */
  readonly ready = this.resolved.asReadonly();
  readonly uid = computed(() => this.current()?.uid ?? null);
  readonly isSignedIn = computed(() => this.current() !== null);

  constructor() {
    const unsubscribe = onAuthStateChanged(this.auth, user => {
      this.current.set(AuthSession.toSessionUser(user));
      this.resolved.set(true);
    });
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  /** Resolves once the persisted auth state is known (used by the route guard). */
  async whenReady(): Promise<SessionUser | null> {
    await this.auth.authStateReady();
    return AuthSession.toSessionUser(this.auth.currentUser);
  }

  /** Signs in anonymously (or reuses the persisted user) and sets the display name. */
  async signIn(displayName: string): Promise<SessionUser> {
    const name = AuthSession.sanitizeDisplayName(displayName);
    if (!name) {
      throw new Error('invalid-display-name');
    }
    const user = this.auth.currentUser ?? (await signInAnonymously(this.auth)).user;
    if (user.displayName !== name) {
      await updateProfile(user, { displayName: name });
      // Force a fresh ID token so the backend receives the new `name` claim.
      await user.getIdToken(true);
    }
    const session: SessionUser = { uid: user.uid, displayName: name };
    this.current.set(session);
    return session;
  }

  /** Forces a new ID token, e.g. after a `functions/unauthenticated` error. */
  async refreshToken(): Promise<boolean> {
    const user = this.auth.currentUser;
    if (!user) {
      return false;
    }
    await user.getIdToken(true);
    return true;
  }

  static sanitizeDisplayName(raw: string): string {
    // Strip control characters (same rule as the backend) and clamp the length.
    const cleaned = Array.from(raw)
      .filter(ch => {
        const code = ch.codePointAt(0) ?? 0;
        return code >= 0x20 && code !== 0x7f;
      })
      .join('')
      .trim();
    return cleaned.slice(0, MAX_DISPLAY_NAME_LENGTH);
  }

  private static toSessionUser(user: User | null): SessionUser | null {
    return user ? { uid: user.uid, displayName: user.displayName ?? '' } : null;
  }
}
