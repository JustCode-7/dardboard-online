import { DartInput, GameMode, PlayerView, TargetView } from './game.models';
import { isValidDart, previewTurn } from './turn-preview';

const d = (segment: number, multiplier: 1 | 2 | 3 = 1): DartInput => ({ segment, multiplier });

function player(remaining: number, cricketMarks: Record<string, number> = {}): PlayerView {
  return { playerId: `p${remaining}`, displayName: 'P', order: 0, remaining, legsWon: 0, connected: true, cricketMarks };
}

function preview(mode: GameMode, players: PlayerView[], darts: DartInput[], targets: TargetView[] = []) {
  return previewTurn({ mode, players, playerIndex: 0, targets }, darts);
}

describe('previewTurn (UX mirror of the server rules)', () => {
  describe('501 Double-Out', () => {
    it('sums a normal three-dart turn and marks it complete', () => {
      expect(preview('X01_501', [player(501)], [d(20, 3), d(20, 3), d(20, 3)])).toMatchObject({
        points: 180,
        scoreAfter: 321,
        busted: false,
        won: false,
        complete: true,
      });
    });

    it('is incomplete with fewer than three darts and no bust/checkout', () => {
      const result = preview('X01_501', [player(501)], [d(20), d(5)]);
      expect(result.complete).toBe(false);
      expect(result.scoreAfter).toBe(476);
    });

    it('busts on overthrow, on 1 left and on 0 without a double', () => {
      expect(preview('X01_501', [player(40)], [d(20, 3)])).toMatchObject({ busted: true, scoreAfter: 40, complete: true });
      expect(preview('X01_501', [player(21)], [d(20)]).busted).toBe(true);
      expect(preview('X01_501', [player(20)], [d(20)]).busted).toBe(true);
    });

    it('checks out on a double and on bullseye', () => {
      expect(preview('X01_501', [player(40)], [d(20, 2)])).toMatchObject({ won: true, scoreAfter: 0, complete: true });
      expect(preview('X01_501', [player(50)], [d(25, 2)]).won).toBe(true);
    });

    it('stops evaluating after the turn ended', () => {
      expect(preview('X01_501', [player(40)], [d(20, 2), d(20, 3)])).toMatchObject({ won: true, points: 40 });
    });
  });

  describe('501 Straight-Out', () => {
    it('wins with any dart and allows 1 left', () => {
      expect(preview('X01_501_STRAIGHT', [player(20)], [d(20)]).won).toBe(true);
      expect(preview('X01_501_STRAIGHT', [player(21)], [d(20)])).toMatchObject({ busted: false, scoreAfter: 1 });
      expect(preview('X01_501_STRAIGHT', [player(10)], [d(20)]).busted).toBe(true);
    });
  });

  describe('Elimination 301', () => {
    it('counts up, busts above 301 and wins on exactly 301', () => {
      expect(preview('ELIMINATION_301', [player(100)], [d(20, 3), d(0), d(0)])).toMatchObject({ scoreAfter: 160, complete: true });
      expect(preview('ELIMINATION_301', [player(290)], [d(20)])).toMatchObject({ busted: true, scoreAfter: 290, complete: true });
      expect(preview('ELIMINATION_301', [player(281)], [d(20)])).toMatchObject({ won: true, complete: true });
    });
  });

  describe('Highscore', () => {
    it('adds every dart and always needs three darts', () => {
      expect(preview('HIGHSCORE', [player(10)], [d(20, 3), d(25, 2)])).toMatchObject({ scoreAfter: 120, complete: false });
    });
  });

  describe('Random-Hit', () => {
    const targets = [d(20, 3), d(5), d(25, 2)];

    it('counts exact hits and reveals the next target only after a hit', () => {
      expect(preview('RANDOM_HIT', [player(0)], [], targets).activeTarget).toEqual(d(20, 3));
      expect(preview('RANDOM_HIT', [player(0)], [d(20)], targets)).toMatchObject({ points: 0, activeTarget: d(20, 3) });
      expect(preview('RANDOM_HIT', [player(0)], [d(20), d(20, 3)], targets)).toMatchObject({ points: 1, activeTarget: d(5) });
    });
  });

  describe('Cricket', () => {
    it('closes fields and scores extra marks while an opponent is open', () => {
      const result = preview('CRICKET', [player(0), player(0)], [d(20, 2), d(20, 3), d(14, 3)]);
      expect(result).toMatchObject({ points: 40, scoreAfter: 40, complete: true });
      expect(result.marks['20']).toBe(3);
    });

    it('does not score on fields every opponent has closed', () => {
      const result = preview('CRICKET', [player(0, { '20': 3 }), player(0, { '20': 3 })], [d(20, 3)]);
      expect(result.points).toBe(0);
    });

    it('wins once all fields are closed with the highest score', () => {
      const almost = { '15': 3, '16': 3, '17': 3, '18': 3, '19': 3, '20': 3, '25': 1 };
      expect(preview('CRICKET', [player(10, almost), player(5)], [d(25, 2)])).toMatchObject({ won: true, complete: true });
      expect(preview('CRICKET', [player(0, almost), player(50)], [d(25, 2)]).won).toBe(false);
    });
  });
});

describe('isValidDart', () => {
  it('accepts every physically possible dart', () => {
    expect(isValidDart(d(0))).toBe(true);
    expect(isValidDart(d(20, 3))).toBe(true);
    expect(isValidDart(d(25, 1))).toBe(true);
    expect(isValidDart(d(25, 2))).toBe(true);
  });

  it('rejects impossible darts before they are sent', () => {
    expect(isValidDart(d(25, 3))).toBe(false);
    expect(isValidDart(d(21))).toBe(false);
    expect(isValidDart(d(-1))).toBe(false);
    expect(isValidDart(d(0, 3))).toBe(false);
    expect(isValidDart({ segment: 1.5, multiplier: 1 })).toBe(false);
    expect(isValidDart({ segment: 20, multiplier: 4 as 3 })).toBe(false);
  });
});
