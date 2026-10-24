import { inject, Injectable } from '@angular/core';
import {
  collection,
  doc,
  DocumentData,
  FirestoreDataConverter,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Unsubscribe,
} from 'firebase/firestore';
import { FIRESTORE } from '../core/firestore';
import { DartInput, DartView, GameMode, LobbyDoc, LobbyState, Multiplier, PlayerView, TargetView, TurnView } from './game.models';

export interface LobbySnapshot {
  /** `null` if the lobby does not exist. */
  readonly lobby: LobbyDoc | null;
  /** `true` while the data comes from the local cache (offline / not yet confirmed by the server). */
  readonly fromCache: boolean;
}

export interface TurnEntry extends TurnView {
  readonly turnId: string;
}

export const LOBBIES = 'lobbies';
export const TURNS = 'turns';
export const MAX_HISTORY_TURNS = 200;

const lobbyConverter: FirestoreDataConverter<LobbyDoc> = {
  toFirestore: () => {
    throw new Error('Clients never write lobbies');
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) =>
    toLobby(snapshot.id, snapshot.data(options)),
};

const turnConverter: FirestoreDataConverter<TurnEntry> = {
  toFirestore: () => {
    throw new Error('Clients never write turns');
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions) => ({
    turnId: snapshot.id,
    ...toTurn(snapshot.data(options)),
  }),
};

/**
 * Read-only real-time access to Firestore (`onSnapshot`). Every `watch*` call returns the SDK's
 * unsubscribe function; callers must release it via `DestroyRef`.
 */
@Injectable({ providedIn: 'root' })
export class LobbySync {
  private readonly db = inject(FIRESTORE);

  watchLobby(lobbyId: string, next: (snapshot: LobbySnapshot) => void, error: (code: string) => void): Unsubscribe {
    const ref = doc(this.db, LOBBIES, lobbyId).withConverter(lobbyConverter);
    return onSnapshot(
      ref,
      { includeMetadataChanges: true },
      snapshot => next({ lobby: snapshot.exists() ? snapshot.data() : null, fromCache: snapshot.metadata.fromCache }),
      err => error(err.code),
    );
  }

  watchTurns(lobbyId: string, next: (turns: readonly TurnEntry[]) => void, error: (code: string) => void): Unsubscribe {
    const turns = query(
      collection(this.db, LOBBIES, lobbyId, TURNS).withConverter(turnConverter),
      orderBy('playedAt', 'desc'),
      limit(MAX_HISTORY_TURNS),
    );
    return onSnapshot(
      turns,
      snapshot => next(snapshot.docs.map(d => d.data())),
      err => error(err.code),
    );
  }
}

// --- defensive mapping of server documents (unknown fields are ignored) ---

function toLobby(id: string, data: DocumentData): LobbyDoc {
  const undo = data['undo'] as DocumentData | null | undefined;
  return {
    lobbyId: id,
    gameMode: data['gameMode'] as GameMode,
    state: data['state'] as LobbyState,
    hostId: String(data['hostId'] ?? ''),
    currentPlayerIndex: Number(data['currentPlayerIndex'] ?? 0),
    round: Number(data['round'] ?? 1),
    maxRounds: typeof data['maxRounds'] === 'number' ? data['maxRounds'] : null,
    winnerId: (data['winnerId'] as string | undefined) ?? null,
    winnerIds: arrayOf(data['winnerIds']).map(String),
    randomTargets: arrayOf(data['randomTargets']).map(t => toDart(t as DocumentData)),
    players: arrayOf(data['players']).map(p => toPlayer(p as DocumentData)),
    lastTurn: data['lastTurn'] ? toTurn(data['lastTurn'] as DocumentData) : null,
    undo: undo && typeof undo['playerId'] === 'string' ? { playerId: undo['playerId'] } : null,
    createdAt: data['createdAt'] ?? null,
    updatedAt: data['updatedAt'] ?? null,
  };
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toDart(data: DocumentData): TargetView {
  return { segment: Number(data['segment'] ?? 0), multiplier: Number(data['multiplier'] ?? 1) as Multiplier };
}

function toMarks(value: unknown): Readonly<Record<string, number>> {
  const marks: Record<string, number> = {};
  if (value && typeof value === 'object') {
    for (const [field, count] of Object.entries(value as Record<string, unknown>)) {
      marks[field] = Number(count ?? 0);
    }
  }
  return marks;
}

function toPlayer(data: DocumentData): PlayerView {
  return {
    playerId: String(data['playerId'] ?? ''),
    displayName: String(data['displayName'] ?? ''),
    order: Number(data['order'] ?? 0),
    remaining: Number(data['remaining'] ?? 0),
    legsWon: Number(data['legsWon'] ?? 0),
    connected: data['connected'] !== false,
    cricketMarks: toMarks(data['cricketMarks']),
  };
}

function toTurn(data: DocumentData): TurnView {
  const darts: DartView[] = arrayOf(data['darts']).map(d => {
    const dart = d as DocumentData;
    const input: DartInput = toDart(dart);
    return { ...input, score: Number(dart['score'] ?? 0) };
  });
  return {
    playerId: String(data['playerId'] ?? ''),
    busted: data['busted'] === true,
    // Older entries without `points` fall back to the dart sum.
    points: typeof data['points'] === 'number' ? data['points'] : darts.reduce((sum, d) => sum + d.score, 0),
    round: Number(data['round'] ?? 0),
    playedAt: data['playedAt'] ?? null,
    darts,
  };
}
