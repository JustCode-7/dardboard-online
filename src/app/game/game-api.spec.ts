import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment.development';
import { APP_ENVIRONMENT } from '../core/firebase';
import { CALLABLE_TRANSPORT, CallableTransport, GameApi } from './game-api';
import { DartView, LobbyResult } from './game.models';

describe('GameApi', () => {
  const result: LobbyResult = { lobbyId: 'abc123', state: 'WAITING', currentPlayerIndex: 0, winnerId: null, winnerIds: [] };
  let calls: { url: string; data: unknown }[];
  let api: GameApi;

  beforeEach(() => {
    calls = [];
    const transport: CallableTransport = async <Req, Res>(url: string, data: Req): Promise<Res> => {
      calls.push({ url, data });
      return result as Res;
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_ENVIRONMENT, useValue: environment },
        { provide: CALLABLE_TRANSPORT, useValue: transport },
      ],
    });
    api = TestBed.inject(GameApi);
  });

  it('calls createLobby at the configured callable URL', async () => {
    await expect(api.createLobby('X01_501')).resolves.toEqual(result);
    expect(calls).toEqual([{ url: 'http://127.0.0.1:5001/api/createLobby', data: { gameMode: 'X01_501' } }]);
  });

  it('sends the round limit only for round-limited modes', async () => {
    await api.createLobby('HIGHSCORE', 9);
    await api.createLobby('X01_501_STRAIGHT', 9);
    expect(calls.map(c => c.data)).toEqual([{ gameMode: 'HIGHSCORE', maxRounds: 9 }, { gameMode: 'X01_501_STRAIGHT' }]);
  });

  it('trims lobby ids for join, start and undo', async () => {
    await api.joinLobby('  abc123 ');
    await api.startLobby('abc123');
    await api.undoTurn(' abc123');
    expect(calls.map(c => c.data)).toEqual([{ lobbyId: 'abc123' }, { lobbyId: 'abc123' }, { lobbyId: 'abc123' }]);
    expect(calls[2].url).toBe('http://127.0.0.1:5001/api/undoTurn');
  });

  it('sends only segment and multiplier, never client scores', async () => {
    const tampered: DartView[] = [{ segment: 20, multiplier: 3, score: 999 }];
    await api.submitThrow('abc123', tampered);
    expect(calls[0]).toEqual({
      url: 'http://127.0.0.1:5001/api/submitThrow',
      data: { lobbyId: 'abc123', darts: [{ segment: 20, multiplier: 3 }] },
    });
  });

  it('rejects path-like lobby ids before any network call', () => {
    expect(() => api.joinLobby('x/turns/y')).toThrowError('invalid-lobby-id');
    expect(() => api.submitThrow('', [])).toThrowError('invalid-lobby-id');
    expect(calls).toHaveLength(0);
  });
});
