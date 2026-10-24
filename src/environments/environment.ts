import { AppEnvironment } from './app-environment';

/**
 * Production environment. Replace the placeholders with the web app config from the Firebase console
 * (Project settings -> Your apps). The web config is public by design; access is enforced by
 * Firebase Auth, `firestore.rules` and the authoritative backend.
 */
export const environment: AppEnvironment = {
  production: true,
  firebase: {
    apiKey: '<firebase-web-api-key>',
    authDomain: '<project-id>.firebaseapp.com',
    projectId: '<project-id>',
    appId: '<firebase-web-app-id>',
  },
  emulators: null,
  callableBaseUrl: 'https://<region>-<project-id>.cloudfunctions.net/dartboard-api/api',
};
