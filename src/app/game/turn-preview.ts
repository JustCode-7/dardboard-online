import {
  BULL_SEGMENT,
  CRICKET_FIELDS,
  CRICKET_MARKS_TO_CLOSE,
  DARTS_PER_TURN,
  dartScore,
  DartInput,
  ELIMINATION_TARGET,
  GameMode,
  marksOn,
  PlayerView,
  TargetView,
} from './game.models';

/** Authoritative inputs the preview is computed from (all taken from the server snapshot). */
export interface TurnContext {
  readonly mode: GameMode;
  readonly players: readonly PlayerView[];
  readonly playerIndex: number;
  /** Random-Hit targets of the current turn. */
  readonly targets: readonly TargetView[];
}

export interface TurnPreview {
  /** Provisional points of the pending darts (0 on bust, hits in Random-Hit). */
  readonly points: number;
  /** Provisional displayed score after the turn (unchanged on bust). */
  readonly scoreAfter: number;
  readonly busted: boolean;
  /** Checkout, exactly 301 or Cricket closed with the highest score. */
  readonly won: boolean;
  /** `true` when the turn has ended (3 darts, bust or win) and must be confirmed. */
  readonly complete: boolean;
  /** Random-Hit: target that is active for the next dart (`null` in other modes). */
  readonly activeTarget: TargetView | null;
  /** Cricket: provisional own marks. */
  readonly marks: Readonly<Record<string, number>>;
}

/**
 * UX-only mirror of the server rules (`GameRuleService`): it decides when the pending turn is complete
 * and shows a provisional score. The server recomputes everything; this result is never sent or trusted.
 */
export function previewTurn(context: TurnContext, darts: readonly DartInput[]): TurnPreview {
  const me = context.players[context.playerIndex];
  if (!me) {
    return emptyPreview(0);
  }
  switch (context.mode) {
    case 'X01_501':
    case 'X01_501_STRAIGHT':
      return previewX01(me.remaining, darts, context.mode === 'X01_501');
    case 'ELIMINATION_301':
      return previewElimination(me.remaining, darts);
    case 'HIGHSCORE':
      return previewHighscore(me.remaining, darts);
    case 'RANDOM_HIT':
      return previewRandomHit(me.remaining, darts, context.targets);
    case 'CRICKET':
      return previewCricket(context, darts);
  }
}

function previewX01(remaining: number, darts: readonly DartInput[], doubleOut: boolean): TurnPreview {
  let running = remaining;
  let busted = false;
  let won = false;
  for (const dart of darts) {
    const after = running - dartScore(dart);
    if (after < 0 || (doubleOut && (after === 1 || (after === 0 && !isDouble(dart))))) {
      busted = true;
      break;
    }
    running = after;
    if (after === 0) {
      won = true;
      break;
    }
  }
  return result({
    points: busted ? 0 : remaining - running,
    scoreAfter: busted ? remaining : running,
    busted,
    won,
    dartCount: darts.length,
  });
}

function previewElimination(start: number, darts: readonly DartInput[]): TurnPreview {
  let running = start;
  let busted = false;
  let won = false;
  for (const dart of darts) {
    running += dartScore(dart);
    if (running > ELIMINATION_TARGET) {
      busted = true;
      break;
    }
    if (running === ELIMINATION_TARGET) {
      won = true;
      break;
    }
  }
  return result({
    points: busted ? 0 : running - start,
    scoreAfter: busted ? start : running,
    busted,
    won,
    dartCount: darts.length,
  });
}

function previewHighscore(start: number, darts: readonly DartInput[]): TurnPreview {
  const points = darts.reduce((sum, dart) => sum + dartScore(dart), 0);
  return result({ points, scoreAfter: start + points, busted: false, won: false, dartCount: darts.length });
}

function previewRandomHit(start: number, darts: readonly DartInput[], targets: readonly TargetView[]): TurnPreview {
  let hits = 0;
  for (const dart of darts) {
    const target = targets[hits];
    if (target && target.segment === dart.segment && target.multiplier === dart.multiplier) {
      hits++;
    }
  }
  return {
    ...result({ points: hits, scoreAfter: start + hits, busted: false, won: false, dartCount: darts.length }),
    activeTarget: targets[Math.min(hits, DARTS_PER_TURN - 1)] ?? null,
  };
}

function previewCricket(context: TurnContext, darts: readonly DartInput[]): TurnPreview {
  const me = context.players[context.playerIndex];
  const marks: Record<string, number> = { ...me.cricketMarks };
  const opponents = context.players.filter((_, i) => i !== context.playerIndex);
  let points = 0;
  let won = false;
  for (const dart of darts) {
    if (CRICKET_FIELDS.includes(dart.segment)) {
      const key = String(dart.segment);
      const before = marks[key] ?? 0;
      const total = before + dart.multiplier;
      marks[key] = Math.min(total, CRICKET_MARKS_TO_CLOSE);
      const extra = total - Math.max(before, CRICKET_MARKS_TO_CLOSE);
      const open = opponents.length === 0 || opponents.some(p => marksOn(p, dart.segment) < CRICKET_MARKS_TO_CLOSE);
      if (extra > 0 && open) {
        points += dart.segment * extra;
      }
    }
    const allClosed = CRICKET_FIELDS.every(field => (marks[String(field)] ?? 0) >= CRICKET_MARKS_TO_CLOSE);
    if (allClosed && opponents.every(p => p.remaining <= me.remaining + points)) {
      won = true;
      break;
    }
  }
  return {
    ...result({ points, scoreAfter: me.remaining + points, busted: false, won, dartCount: darts.length }),
    marks,
  };
}

function result(values: {
  points: number;
  scoreAfter: number;
  busted: boolean;
  won: boolean;
  dartCount: number;
}): TurnPreview {
  return {
    points: values.points,
    scoreAfter: values.scoreAfter,
    busted: values.busted,
    won: values.won,
    complete: values.busted || values.won || values.dartCount >= DARTS_PER_TURN,
    activeTarget: null,
    marks: {},
  };
}

function emptyPreview(score: number): TurnPreview {
  return result({ points: 0, scoreAfter: score, busted: false, won: false, dartCount: 0 });
}

export function isDouble(dart: DartInput): boolean {
  return dart.multiplier === 2;
}

/** Physically possible darts only (treble bull and segments 21..24 do not exist). */
export function isValidDart(dart: DartInput): boolean {
  const { segment, multiplier } = dart;
  if (!Number.isInteger(segment) || ![1, 2, 3].includes(multiplier)) {
    return false;
  }
  if (segment === 0) {
    return multiplier === 1;
  }
  if (segment === BULL_SEGMENT) {
    return multiplier !== 3;
  }
  return segment >= 1 && segment <= 20;
}
