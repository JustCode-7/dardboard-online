import { AppEnvironment } from './app-environment';

/**
 * Local development against the Firebase Emulator Suite (`firebase emulators:start` in the backend repo)
 * and the Java backend (`gradlew quarkusDev`, port 5001). `demo-*` project ids never reach real cloud
 * resources, so no credentials are required.
 */
export const environment: AppEnvironment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyDemoKeyForEmulatorOnly0000000000000',
    authDomain: 'demo-dard-board.firebaseapp.com',
    projectId: 'demo-dard-board',
    appId: 'demo-app',
    databaseId: '(default)',
  },
  emulators: {
    // Direct connection to the Auth Emulator. The emulator supports CORS natively,
    // so no proxy is needed. connectAuthEmulator routes all Auth requests (including
    // securetoken) to this URL.
    authUrl: 'http://127.0.0.1:9099',
    firestoreHost: '127.0.0.1',
    firestorePort: 8080,
  },
  callableBaseUrl: 'http://127.0.0.1:5001/api',
};
