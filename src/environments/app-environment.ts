export interface FirebaseWebConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly appId: string;
  /** Firestore database id; defaults to '(default)'. Set when using a named database. */
  readonly databaseId?: string;
}

export interface EmulatorConfig {
  /** Auth emulator URL, e.g. `http://127.0.0.1:9099`. */
  readonly authUrl: string;
  readonly firestoreHost: string;
  readonly firestorePort: number;
}

export interface AppEnvironment {
  readonly production: boolean;
  readonly firebase: FirebaseWebConfig;
  /** Local Emulator Suite endpoints; `null` connects to the real Firebase project. */
  readonly emulators: EmulatorConfig | null;
  /** Base URL of the Java callable endpoints (`{base}/createLobby`, ...). */
  readonly callableBaseUrl: string;
}
