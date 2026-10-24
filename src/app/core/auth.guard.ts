import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSession } from './auth-session';

/**
 * UX guard only: unauthenticated visitors are sent to the start page (keeping the target URL so a
 * shared lobby link still works after entering a name). Security is enforced by the backend and
 * `firestore.rules`, never by this guard.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(AuthSession);
  const router = inject(Router);
  const user = await session.whenReady();
  if (user?.displayName) {
    return true;
  }
  return router.createUrlTree(['/'], { queryParams: { returnUrl: state.url } });
};
