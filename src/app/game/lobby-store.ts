import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Unsubscribe } from 'firebase/firestore';
import { AuthSession } from '../core/auth-session';
import { errorCode } from '../core/error-code';
import { GameApi } from './game-api';
import { DartInput, gameModeInfo, LobbyDoc, TargetView, TurnView } from './game.models';
import { LobbySync } from './lobby-sync';
import { isValidDart, previewTurn, TurnPreview } from './turn-preview';

/** Callable failures after which the turn may or may not have been applied (network level). */
const UNCERTAIN_CODES: ReadonlySet<string> = new Set([
  'functions/unavailable',
  'functions/deadline-exceeded',
  'functions/internal',
  'functions/unknown',
]);

export type LoadState = 'idle' | 'loading' | 'ready' | 'not-found' | 'error';

/**
 * Component-scoped, read-only game state (`providers: [LobbyStore]`).
 *
 * - One `onSnapshot` listener on `lobbies/{id}`; released through `DestroyRef`.
 * - All mutations go through {@link GameApi}; the authoritative result arrives via the snapshot.
 * - The pending turn (up to 3 darts) is local UX state only: every dart can be taken back until the
 *   player confirms the complete turn; afterwards only the server-side `undoTurn` can revert it.
 */
@Injectable()
export class LobbyStore {
  private readonly sync = inject(LobbySync);
  private readonly api = inject(GameApi);
  private readonly session = inject(AuthSession);

  private readonly lobbyIdState = signal<string | null>(null);
  private readonly lobbyState = signal<LobbyDoc | null>(null);
  private readonly loadState = signal<LoadState>('idle');
  private readonly cacheState = signal(true);
  private readonly busyState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly pendingState = signal<readonly DartInput[]>([]);
  /** Turn submission whose outcome is unknown (network error); resolved by the next snapshot. */
  private readonly uncertainSubmit = signal<{ readonly lastTurnKey: string | null } | null>(null);
  private unsubscribeLobby: Unsubscribe | null = null;

  readonly lobbyId = this.lobbyIdState.asReadonly();
  readonly lobby = this.lobbyState.asReadonly();
  readonly load = this.loadState.asReadonly();
  /** `true` while the snapshot is served from cache, i.e. not confirmed by the server (offline). */
  readonly offline = this.cacheState.asReadonly();
  readonly busy = this.busyState.asReadonly();
  /** Last error as code (`functions/permission-denied`, `permission-denied`, ...). */
  readonly error = this.errorState.asReadonly();
  readonly pendingDarts = this.pendingState.asReadonly();
  /** A submission failed at network level; the UI offers an explicit, safe retry. */
  readonly hasUncertainSubmit = computed(() => this.uncertainSubmit() !== null);

  readonly uid = this.session.uid;
  readonly players = computed(() => this.lobbyState()?.players ?? []);
  readonly currentPlayer = computed(() => {
    const lobby = this.lobbyState();
    return lobby?.players[lobby.currentPlayerIndex] ?? null;
  });
  readonly myIndex = computed(() => this.players().findIndex(p => p.playerId === this.uid()));
  readonly me = computed(() => this.players()[this.myIndex()] ?? null);
  readonly modeInfo = computed(() => gameModeInfo(this.lobbyState()?.gameMode ?? 'X01_501'));
  readonly isHost = computed(() => {
    const uid = this.uid();
    return uid !== null && this.lobbyState()?.hostId === uid;
  });
  readonly isMember = computed(() => this.me() !== null);
  readonly isSpectator = computed(() => !this.isMember());
  readonly isCricket = computed(() => this.lobbyState()?.gameMode === 'CRICKET');
  readonly isRandomHit = computed(() => this.lobbyState()?.gameMode === 'RANDOM_HIT');
  readonly isMyTurn = computed(
    () => this.lobbyState()?.state === 'IN_PROGRESS' && this.currentPlayer()?.playerId === this.uid(),
  );
  /** All winners (several on a draw after the round limit). */
  readonly winners = computed(() => {
    const lobby = this.lobbyState();
    const ids = lobby?.winnerIds.length ? lobby.winnerIds : lobby?.winnerId ? [lobby.winnerId] : [];
    return lobby?.players.filter(p => ids.includes(p.playerId)) ?? [];
  });
  readonly winner = computed(() => {
    const winners = this.winners();
    return winners.length === 1 ? winners[0] : null;
  });
  readonly isDraw = computed(() => this.winners().length > 1);
  readonly canJoin = computed(() => this.lobbyState()?.state === 'WAITING' && !this.isMember() && !this.busyState());
  readonly canStart = computed(
    () => this.isHost() && this.lobbyState()?.state === 'WAITING' && this.players().length >= 2 && !this.busyState(),
  );
  /**
   * Input lock: only the current player, only with server-confirmed state, no request in flight and no
   * unresolved submission. The server enforces the same rule (`permission-denied`).
   */
  readonly canThrow = computed(
    () => this.isMyTurn() && !this.cacheState() && !this.busyState() && this.uncertainSubmit() === null,
  );
  /** UX preview of the pending turn for the local player (never sent to the server). */
  readonly preview = computed<TurnPreview | null>(() => {
    const lobby = this.lobbyState();
    const index = this.myIndex();
    if (!lobby || index < 0) {
      return null;
    }
    return previewTurn(
      { mode: lobby.gameMode, players: lobby.players, playerIndex: index, targets: lobby.randomTargets },
      this.pendingState(),
    );
  });
  /** Further darts are accepted until the turn has ended (3 darts, bust or win). */
  readonly canAddDart = computed(() => this.canThrow() && !this.preview()?.complete);
  /** The finished turn waits for the player's explicit confirmation (no auto-submit). */
  readonly canConfirm = computed(
    () => this.canThrow() && this.pendingState().length > 0 && this.preview()?.complete === true,
  );
  readonly canUndoDart = computed(() => this.pendingState().length > 0 && !this.busyState());
  /**
   * Server undo of the own last turn: only the thrower, only until the next turn is submitted (the
   * backend replaces `undo` with every turn), only with confirmed state and nothing pending.
   */
  readonly canUndoTurn = computed(() => {
    const lobby = this.lobbyState();
    return (
      lobby !== null &&
      lobby.state !== 'WAITING' &&
      lobby.undo?.playerId === this.uid() &&
      this.pendingState().length === 0 &&
      !this.cacheState() &&
      !this.busyState() &&
      this.uncertainSubmit() === null
    );
  });
  /** Host can restart the game in the same lobby when the game is finished or in progress. */
  readonly canNewGame = computed(() => {
    const lobby = this.lobbyState();
    return (
      this.isHost() &&
      lobby !== null &&
      (lobby.state === 'FINISHED' || lobby.state === 'IN_PROGRESS') &&
      !this.cacheState() &&
      !this.busyState()
    );
  });
  /** Random-Hit target for the next dart (current player). */
  readonly activeTarget = computed<TargetView | null>(() => {
    const lobby = this.lobbyState();
    if (!lobby || lobby.gameMode !== 'RANDOM_HIT') {
      return null;
    }
    return (this.isMyTurn() ? this.preview()?.activeTarget : null) ?? lobby.randomTargets[0] ?? null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  watch(lobbyId: string): void {
    if (this.lobbyIdState() === lobbyId && this.unsubscribeLobby) {
      return;
    }
    this.stop();
    this.lobbyIdState.set(lobbyId);
    this.lobbyState.set(null);
    this.pendingState.set([]);
    this.errorState.set(null);
    this.loadState.set('loading');
    this.unsubscribeLobby = this.sync.watchLobby(
      lobbyId,
      ({ lobby, fromCache }) => this.onSnapshot(lobby, fromCache),
      code => {
        this.errorState.set(code);
        this.loadState.set('error');
      },
    );
  }

  async join(): Promise<void> {
    const id = this.lobbyIdState();
    if (id && this.canJoin()) {
      await this.run(() => this.api.joinLobby(id));
    }
  }

  async start(): Promise<void> {
    const id = this.lobbyIdState();
    if (id && this.canStart()) {
      await this.run(() => this.api.startLobby(id));
    }
  }

  /**
   * Adds a dart to the local pending turn. Nothing is sent: once the turn has ended (3 darts, bust or
   * win) the player confirms it via {@link confirmTurn}, because the server rejects darts after the end.
   * @returns `true` if the dart was accepted locally.
   */
  addDart(dart: DartInput): boolean {
    if (!this.canAddDart() || !isValidDart(dart)) {
      return false;
    }
    this.errorState.set(null);
    this.pendingState.update(darts => [...darts, dart]);
    return true;
  }

  /** Takes back the last pending (unconfirmed) dart. */
  undoDart(): void {
    if (this.canUndoDart()) {
      this.pendingState.update(darts => darts.slice(0, -1));
    }
  }

  /** Sends the complete pending turn to the server. */
  async confirmTurn(): Promise<void> {
    if (this.canConfirm()) {
      await this.submitTurn();
    }
  }

  /** Asks the server to revert the own last turn (`undoTurn`); the snapshot shows the result. */
  async undoTurn(): Promise<void> {
    const id = this.lobbyIdState();
    if (id && this.canUndoTurn()) {
      await this.run(() => this.api.undoTurn(id));
    }
  }

  /** Host restarts the game in the same lobby (resets scores, turns, state → IN_PROGRESS). */
  async newGame(): Promise<void> {
    const id = this.lobbyIdState();
    if (id && this.canNewGame()) {
      await this.run(() => this.api.newGame(id));
    }
  }

  private async submitTurn(): Promise<void> {
    const id = this.lobbyIdState();
    const darts = this.pendingState();
    if (!id || darts.length === 0 || !this.canThrow()) {
      return;
    }
    const lastTurnKey = LobbyStore.turnKey(this.lobbyState()?.lastTurn ?? null);
    const outcome = await this.run(() => this.api.submitThrow(id, darts));
    if (outcome === 'ok') {
      this.pendingState.set([]);
    } else if (outcome === 'uncertain') {
      // Do not resubmit blindly: the next snapshot shows whether the turn was applied.
      this.uncertainSubmit.set({ lastTurnKey });
    } else {
      // Rejected by the server (e.g. not your turn / invalid): the snapshot is the truth.
      this.pendingState.set([]);
    }
  }

  /** Retries an uncertain submission once the snapshot proves it was not applied. */
  async retryUncertain(): Promise<void> {
    if (this.uncertainSubmit() !== null && this.isMyTurn() && !this.cacheState()) {
      this.uncertainSubmit.set(null);
      await this.submitTurn();
    }
  }

  clearError(): void {
    this.errorState.set(null);
  }

  private onSnapshot(lobby: LobbyDoc | null, fromCache: boolean): void {
    this.cacheState.set(fromCache);
    this.lobbyState.set(lobby);
    if (!lobby) {
      // A cache miss while offline is not proof that the lobby does not exist.
      this.loadState.set(fromCache ? 'loading' : 'not-found');
      return;
    }
    this.loadState.set('ready');
    if (fromCache) {
      return;
    }

    const uncertain = this.uncertainSubmit();
    if (uncertain) {
      const lastTurn = lobby.lastTurn;
      const applied =
        lastTurn !== null && lastTurn.playerId === this.uid() && LobbyStore.turnKey(lastTurn) !== uncertain.lastTurnKey;
      if (applied || !this.isMyTurn()) {
        this.uncertainSubmit.set(null);
        this.pendingState.set([]);
        this.errorState.set(null);
      }
    }
    if (!this.isMyTurn() && !this.busyState()) {
      this.pendingState.set([]);
    }
  }

  private async run(action: () => Promise<unknown>): Promise<'ok' | 'rejected' | 'uncertain'> {
    this.busyState.set(true);
    this.errorState.set(null);
    try {
      await this.withTokenRetry(action);
      return 'ok';
    } catch (e: unknown) {
      const code = errorCode(e);
      this.errorState.set(code);
      return UNCERTAIN_CODES.has(code) ? 'uncertain' : 'rejected';
    } finally {
      this.busyState.set(false);
    }
  }

  private async withTokenRetry(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
    } catch (e: unknown) {
      if (errorCode(e) === 'functions/unauthenticated' && (await this.session.refreshToken())) {
        await action();
        return;
      }
      throw e;
    }
  }

  private stop(): void {
    this.unsubscribeLobby?.();
    this.unsubscribeLobby = null;
  }

  static turnKey(turn: TurnView | null): string | null {
    if (!turn) {
      return null;
    }
    const time = turn.playedAt ? `${turn.playedAt.seconds}.${turn.playedAt.nanoseconds}` : 'n/a';
    return `${turn.playerId}@${time}`;
  }
}
