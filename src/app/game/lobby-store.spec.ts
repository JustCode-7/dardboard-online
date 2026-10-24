import { createEnvironmentInjector, EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FirebaseError } from 'firebase/app';
import type { Mock } from 'vitest';
import { AuthSession } from '../core/auth-session';
import { GameApi } from './game-api';
import { DartInput, LobbyDoc, LobbyResult, PlayerView } from './game.models';
import { LobbySnapshot, LobbySync } from './lobby-sync';
import { LobbyStore } from './lobby-store';

const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const OK: LobbyResult = { lobbyId: 'lobby1', state: 'IN_PROGRESS', currentPlayerIndex: 1, winnerId: null, winnerIds: [] };
const T20: DartInput = { segment: 20, multiplier: 3 };

function player(playerId: string, remaining = 501): PlayerView {
  return { playerId, displayName: playerId, order: 0, remaining, legsWon: 0, connected: true, cricketMarks: {} };
}

function lobby(overrides: Partial<LobbyDoc> = {}): LobbyDoc {
  return {
    lobbyId: 'lobby1',
    gameMode: 'X01_501',
    state: 'IN_PROGRESS',
    hostId: ALICE,
    currentPlayerIndex: 0,
    round: 1,
    maxRounds: null,
    winnerId: null,
    winnerIds: [],
    randomTargets: [],
    players: [player(ALICE), player(BOB)],
    lastTurn: null,
    undo: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('LobbyStore', () => {
  let emit: (snapshot: LobbySnapshot) => void;
  type ApiCall = (...args: unknown[]) => Promise<LobbyResult>;
  let unsubscribe: Mock<() => void>;
  let api: {
    submitThrow: Mock<ApiCall>;
    joinLobby: Mock<ApiCall>;
    startLobby: Mock<ApiCall>;
    undoTurn: Mock<ApiCall>;
  };
  let refreshToken: Mock<() => Promise<boolean>>;
  let injector: EnvironmentInjector;
  let store: LobbyStore;

  beforeEach(() => {
    unsubscribe = vi.fn<() => void>();
    refreshToken = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    api = {
      submitThrow: vi.fn<ApiCall>().mockResolvedValue(OK),
      joinLobby: vi.fn<ApiCall>().mockResolvedValue(OK),
      startLobby: vi.fn<ApiCall>().mockResolvedValue(OK),
      undoTurn: vi.fn<ApiCall>().mockResolvedValue(OK),
    };
    const sync: Pick<LobbySync, 'watchLobby'> = {
      watchLobby: (_id, next) => {
        emit = next;
        return unsubscribe;
      },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: LobbySync, useValue: sync },
        { provide: GameApi, useValue: api },
        { provide: AuthSession, useValue: { uid: signal<string | null>(ALICE).asReadonly(), refreshToken } },
      ],
    });
    // A child injector mirrors the component-level `providers: [LobbyStore]` lifetime.
    injector = createEnvironmentInjector([LobbyStore], TestBed.inject(EnvironmentInjector));
    store = injector.get(LobbyStore);
    store.watch('lobby1');
  });

  it('starts locked until the server confirms the state', () => {
    emit({ lobby: lobby(), fromCache: true });
    expect(store.isMyTurn()).toBe(true);
    expect(store.canThrow()).toBe(false);

    emit({ lobby: lobby(), fromCache: false });
    expect(store.canThrow()).toBe(true);
  });

  it('locks the input (spectator mode) when it is not my turn', () => {
    emit({ lobby: lobby({ currentPlayerIndex: 1 }), fromCache: false });
    expect(store.isMyTurn()).toBe(false);
    expect(store.canThrow()).toBe(false);
    expect(store.addDart(T20)).toBe(false);
    expect(api.submitThrow).not.toHaveBeenCalled();
  });

  it('treats non-members as spectators', () => {
    emit({ lobby: lobby({ players: [player(BOB), player('carol')] }), fromCache: false });
    expect(store.isSpectator()).toBe(true);
    expect(store.canThrow()).toBe(false);
  });

  it('collects three darts and waits for the explicit confirmation', async () => {
    emit({ lobby: lobby(), fromCache: false });
    store.addDart(T20);
    store.addDart(T20);
    expect(store.canConfirm()).toBe(false);
    store.addDart(T20);

    expect(api.submitThrow).not.toHaveBeenCalled();
    expect(store.canConfirm()).toBe(true);
    expect(store.addDart(T20)).toBe(false);

    await store.confirmTurn();
    expect(api.submitThrow).toHaveBeenCalledWith('lobby1', [T20, T20, T20]);
    expect(store.pendingDarts()).toEqual([]);
  });

  it('lets every dart be taken back before confirming, including the third', async () => {
    emit({ lobby: lobby(), fromCache: false });
    [T20, T20, T20].forEach(dart => store.addDart(dart));

    store.undoDart();
    expect(store.pendingDarts()).toEqual([T20, T20]);
    expect(store.canConfirm()).toBe(false);
    expect(store.addDart({ segment: 19, multiplier: 3 })).toBe(true);

    await store.confirmTurn();
    expect(api.submitThrow).toHaveBeenCalledWith('lobby1', [T20, T20, { segment: 19, multiplier: 3 }]);
  });

  it('ends the turn early on a bust and blocks further darts until confirmed', async () => {
    emit({ lobby: lobby({ players: [player(ALICE, 40), player(BOB)] }), fromCache: false });
    store.addDart(T20); // 60 > 40 -> bust

    expect(api.submitThrow).not.toHaveBeenCalled();
    expect(store.addDart(T20)).toBe(false);
    expect(store.canConfirm()).toBe(true);
    await store.confirmTurn();
    expect(api.submitThrow).toHaveBeenCalledWith('lobby1', [T20]);
  });

  it('offers the server undo only to the last thrower with nothing pending', async () => {
    emit({ lobby: lobby({ currentPlayerIndex: 1, undo: { playerId: ALICE } }), fromCache: false });
    expect(store.canUndoTurn()).toBe(true);
    await store.undoTurn();
    expect(api.undoTurn).toHaveBeenCalledWith('lobby1');

    emit({ lobby: lobby({ currentPlayerIndex: 0, undo: { playerId: BOB } }), fromCache: false });
    expect(store.canUndoTurn()).toBe(false);

    emit({ lobby: lobby({ undo: { playerId: ALICE } }), fromCache: true });
    expect(store.canUndoTurn()).toBe(false);
  });

  it('reports draws and the Random-Hit target', () => {
    emit({
      lobby: lobby({
        gameMode: 'RANDOM_HIT',
        randomTargets: [T20, { segment: 5, multiplier: 1 }, { segment: 25, multiplier: 2 }],
      }),
      fromCache: false,
    });
    expect(store.activeTarget()).toEqual(T20);
    store.addDart(T20);
    expect(store.activeTarget()).toEqual({ segment: 5, multiplier: 1 });

    emit({ lobby: lobby({ state: 'FINISHED', winnerIds: [ALICE, BOB] }), fromCache: false });
    expect(store.isDraw()).toBe(true);
    expect(store.winner()).toBeNull();
  });

  it('rejects impossible darts locally', () => {
    emit({ lobby: lobby(), fromCache: false });
    expect(store.addDart({ segment: 25, multiplier: 3 })).toBe(false);
    expect(store.pendingDarts()).toEqual([]);
  });

  it('shows server rejections and resets the pending turn', async () => {
    api.submitThrow.mockRejectedValueOnce(new FirebaseError('functions/permission-denied', 'It is not your turn'));
    emit({ lobby: lobby(), fromCache: false });
    [T20, T20, T20].forEach(dart => store.addDart(dart));
    await store.confirmTurn();

    await vi.waitFor(() => expect(store.error()).toBe('functions/permission-denied'));
    expect(store.pendingDarts()).toEqual([]);
    expect(store.hasUncertainSubmit()).toBe(false);
  });

  it('does not resubmit blindly after a network failure; the snapshot resolves it', async () => {
    api.submitThrow.mockRejectedValueOnce(new FirebaseError('functions/unavailable', 'offline'));
    emit({ lobby: lobby(), fromCache: false });
    [T20, T20, T20].forEach(dart => store.addDart(dart));
    await store.confirmTurn();

    await vi.waitFor(() => expect(store.hasUncertainSubmit()).toBe(true));
    expect(store.canThrow()).toBe(false);
    expect(api.submitThrow).toHaveBeenCalledTimes(1);

    // The server had applied the turn: lastTurn is ours and the turn moved on.
    emit({
      lobby: lobby({
        currentPlayerIndex: 1,
        lastTurn: { playerId: ALICE, busted: false, points: 180, round: 1, playedAt: null, darts: [] },
      }),
      fromCache: false,
    });
    expect(store.hasUncertainSubmit()).toBe(false);
    expect(store.pendingDarts()).toEqual([]);
    expect(api.submitThrow).toHaveBeenCalledTimes(1);
  });

  it('allows an explicit retry when the turn was not applied', async () => {
    api.submitThrow.mockRejectedValueOnce(new FirebaseError('functions/deadline-exceeded', 'timeout'));
    emit({ lobby: lobby(), fromCache: false });
    [T20, T20, T20].forEach(dart => store.addDart(dart));
    await store.confirmTurn();
    await vi.waitFor(() => expect(store.hasUncertainSubmit()).toBe(true));

    await store.retryUncertain();
    expect(api.submitThrow).toHaveBeenCalledTimes(2);
    expect(store.pendingDarts()).toEqual([]);
  });

  it('refreshes the ID token once on unauthenticated', async () => {
    api.submitThrow.mockRejectedValueOnce(new FirebaseError('functions/unauthenticated', 'expired'));
    emit({ lobby: lobby(), fromCache: false });
    [T20, T20, T20].forEach(dart => store.addDart(dart));
    await store.confirmTurn();

    await vi.waitFor(() => expect(api.submitThrow).toHaveBeenCalledTimes(2));
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(store.error()).toBeNull();
  });

  it('only lets the host start with at least two players', async () => {
    emit({ lobby: lobby({ state: 'WAITING', players: [player(ALICE)] }), fromCache: false });
    expect(store.canStart()).toBe(false);

    emit({ lobby: lobby({ state: 'WAITING' }), fromCache: false });
    expect(store.canStart()).toBe(true);
    await store.start();
    expect(api.startLobby).toHaveBeenCalledWith('lobby1');

    emit({ lobby: lobby({ state: 'WAITING', hostId: BOB }), fromCache: false });
    expect(store.canStart()).toBe(false);
  });

  it('reports a missing lobby only when the server confirms it', () => {
    emit({ lobby: null, fromCache: true });
    expect(store.load()).toBe('loading');
    emit({ lobby: null, fromCache: false });
    expect(store.load()).toBe('not-found');
  });

  it('releases the onSnapshot listener when destroyed', () => {
    injector.destroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
