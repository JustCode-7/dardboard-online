import type { Timestamp } from 'firebase/firestore';
import type { TranslationKey } from '../core/i18n/translation';

/**
 * Read-only contract types mirroring the authoritative backend (`dard-board-backend`).
 * All score fields are server-computed; the client only renders them.
 */
export type GameMode = 'X01_501' | 'X01_501_STRAIGHT' | 'CRICKET' | 'ELIMINATION_301' | 'HIGHSCORE' | 'RANDOM_HIT';
export type LobbyState = 'WAITING' | 'IN_PROGRESS' | 'FINISHED';
export type Multiplier = 1 | 2 | 3;

/** Segment 0 (miss), 1..20 or 25 (bull). Treble bull does not exist. */
export interface DartInput {
  readonly segment: number;
  readonly multiplier: Multiplier;
}

export interface DartView extends DartInput {
  readonly score: number;
}

/** Random-Hit target field (server-generated). */
export type TargetView = DartInput;

export interface PlayerView {
  readonly playerId: string;
  readonly displayName: string;
  readonly order: number;
  /** Mode score: x01 countdown, otherwise the accumulated total (Cricket points, Random-Hit hits). */
  readonly remaining: number;
  readonly legsWon: number;
  readonly connected: boolean;
  /** Cricket marks (0..3) per field `"15"`..`"20"`, `"25"`. */
  readonly cricketMarks: Readonly<Record<string, number>>;
}

export interface TurnView {
  readonly playerId: string;
  readonly darts: readonly DartView[];
  readonly busted: boolean;
  /** Points credited by the server (0 on bust, hits in Random-Hit). */
  readonly points: number;
  readonly round: number;
  readonly playedAt: Timestamp | null;
}

/** Only the owner of the server-side undo snapshot is needed by the client. */
export interface UndoView {
  readonly playerId: string;
}

export interface LobbyDoc {
  readonly lobbyId: string;
  readonly gameMode: GameMode;
  readonly state: LobbyState;
  readonly hostId: string;
  readonly currentPlayerIndex: number;
  readonly round: number;
  readonly maxRounds: number | null;
  readonly winnerId: string | null;
  /** All winners; 2+ entries mean a draw after the round limit. */
  readonly winnerIds: readonly string[];
  readonly randomTargets: readonly TargetView[];
  readonly players: readonly PlayerView[];
  readonly lastTurn: TurnView | null;
  readonly undo: UndoView | null;
  readonly createdAt: Timestamp | null;
  readonly updatedAt: Timestamp | null;
}

/** `result` payload of every callable. */
export interface LobbyResult {
  readonly lobbyId: string;
  readonly state: LobbyState;
  readonly currentPlayerIndex: number;
  readonly winnerId: string | null;
  readonly winnerIds: readonly string[];
}

export interface GameModeInfo {
  readonly mode: GameMode;
  /** i18n key of the display name. */
  readonly labelKey: TranslationKey;
  /** i18n key of the rules text. */
  readonly rulesKey: TranslationKey;
  /** Ends after `maxRounds` (host picks 3..45). */
  readonly roundLimited: boolean;
  /** `remaining` counts down (x01) instead of up. */
  readonly countsDown: boolean;
}

/** All template game modes, in the template's selection order. */
export const GAME_MODES: readonly GameModeInfo[] = [
  { mode: 'X01_501_STRAIGHT', labelKey: 'mode.X01_501_STRAIGHT', rulesKey: 'info.x01Straight', roundLimited: false, countsDown: true },
  { mode: 'X01_501', labelKey: 'mode.X01_501', rulesKey: 'info.x01', roundLimited: false, countsDown: true },
  { mode: 'CRICKET', labelKey: 'mode.CRICKET', rulesKey: 'info.cricket', roundLimited: true, countsDown: false },
  { mode: 'ELIMINATION_301', labelKey: 'mode.ELIMINATION_301', rulesKey: 'info.elimination', roundLimited: false, countsDown: false },
  { mode: 'HIGHSCORE', labelKey: 'mode.HIGHSCORE', rulesKey: 'info.highscore', roundLimited: true, countsDown: false },
  { mode: 'RANDOM_HIT', labelKey: 'mode.RANDOM_HIT', rulesKey: 'info.randomHit', roundLimited: true, countsDown: false },
];

export function gameModeInfo(mode: GameMode): GameModeInfo {
  return GAME_MODES.find(info => info.mode === mode) ?? GAME_MODES[1];
}

export const DARTS_PER_TURN = 3;
export const BULL_SEGMENT = 25;
export const MISS_SEGMENT = 0;
export const ELIMINATION_TARGET = 301;
export const CRICKET_FIELDS: readonly number[] = [15, 16, 17, 18, 19, 20, BULL_SEGMENT];
export const CRICKET_MARKS_TO_CLOSE = 3;
export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 45;
export const DEFAULT_ROUNDS = 15;
/** Template round options: 3, 6, ..., 45. */
export const ROUND_OPTIONS: readonly number[] = Array.from({ length: MAX_ROUNDS / 3 }, (_, i) => (i + 1) * 3);

/** Mirrors the backend `LobbyIds.PATTERN`; rejects path-like ids before any request. */
export const LOBBY_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function dartScore(dart: DartInput): number {
  return dart.segment * dart.multiplier;
}

export function marksOn(player: PlayerView, field: number): number {
  return player.cricketMarks[String(field)] ?? 0;
}

export function formatDart(dart: DartInput): string {
  if (dart.segment === MISS_SEGMENT) {
    return 'Miss';
  }
  if (dart.segment === BULL_SEGMENT) {
    return dart.multiplier === 2 ? 'Bullseye' : 'Bull';
  }
  const prefix = dart.multiplier === 3 ? 'T' : dart.multiplier === 2 ? 'D' : 'S';
  return `${prefix}${dart.segment}`;
}

/** Template `formatTarget`: "Triple 20", "Bull", ... */
export function formatTarget(target: TargetView | null | undefined): string {
  if (!target) {
    return '';
  }
  if (target.segment === BULL_SEGMENT) {
    return target.multiplier === 2 ? 'Bullseye' : 'Bull';
  }
  const prefix = target.multiplier === 3 ? 'Triple' : target.multiplier === 2 ? 'Double' : 'Single';
  return `${prefix} ${target.segment}`;
}
