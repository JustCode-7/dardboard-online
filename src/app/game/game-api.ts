import { inject, Injectable, InjectionToken } from '@angular/core';
import { httpsCallableFromURL } from 'firebase/functions';
import { APP_ENVIRONMENT } from '../core/firebase';
import { FUNCTIONS } from '../core/functions';
import { DartInput, GameMode, gameModeInfo, LOBBY_ID_PATTERN, LobbyResult } from './game.models';

export type CallableName = 'createLobby' | 'joinLobby' | 'startLobby' | 'submitThrow' | 'undoTurn';

/**
 * Sends one Firebase-callable request (`{ data }` -> `{ result }`, `Authorization: Bearer <ID token>`)
 * and resolves with `result`. Rejects with a `FunctionsError` (`functions/<code>`).
 */
export type CallableTransport = <Req, Res>(url: string, data: Req) => Promise<Res>;

export const CALLABLE_TRANSPORT = new InjectionToken<CallableTransport>('CALLABLE_TRANSPORT', {
  providedIn: 'root',
  factory: () => {
    const functions = inject(FUNCTIONS);
    return async <Req, Res>(url: string, data: Req): Promise<Res> => {
      // The Firebase Functions emulator cannot host Java, so the backend is addressed by URL.
      const callable = httpsCallableFromURL<Req, Res>(functions, url);
      const { data: result } = await callable(data);
      return result;
    };
  },
});

/** The only write path of the client: every game mutation is a server-validated callable. */
@Injectable({ providedIn: 'root' })
export class GameApi {
  private readonly transport = inject(CALLABLE_TRANSPORT);
  private readonly baseUrl = inject(APP_ENVIRONMENT).callableBaseUrl;

  /** `maxRounds` (3..45) is only sent for round-limited modes; the server validates it again. */
  createLobby(gameMode: GameMode, maxRounds?: number): Promise<LobbyResult> {
    const roundLimited = gameModeInfo(gameMode).roundLimited;
    return this.call('createLobby', roundLimited && maxRounds !== undefined ? { gameMode, maxRounds } : { gameMode });
  }

  joinLobby(lobbyId: string): Promise<LobbyResult> {
    return this.call('joinLobby', { lobbyId: GameApi.normalizeLobbyId(lobbyId) });
  }

  startLobby(lobbyId: string): Promise<LobbyResult> {
    return this.call('startLobby', { lobbyId: GameApi.normalizeLobbyId(lobbyId) });
  }

  submitThrow(lobbyId: string, darts: readonly DartInput[]): Promise<LobbyResult> {
    // Only segment + multiplier are sent; scores are always recomputed by the server.
    const payload = darts.map(({ segment, multiplier }) => ({ segment, multiplier }));
    return this.call('submitThrow', { lobbyId: GameApi.normalizeLobbyId(lobbyId), darts: payload });
  }

  /** Takes back the caller's last turn (server checks thrower + that no later turn exists). */
  undoTurn(lobbyId: string): Promise<LobbyResult> {
    return this.call('undoTurn', { lobbyId: GameApi.normalizeLobbyId(lobbyId) });
  }

  /** Trims and validates a lobby id; throws before any network call if it is malformed. */
  static normalizeLobbyId(raw: string): string {
    const id = raw.trim();
    if (!LOBBY_ID_PATTERN.test(id)) {
      throw new Error('invalid-lobby-id');
    }
    return id;
  }

  private call<Req>(name: CallableName, data: Req): Promise<LobbyResult> {
    return this.transport<Req, LobbyResult>(`${this.baseUrl}/${name}`, data);
  }
}
