import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DartInput, PlayerView } from '../game.models';
import { CricketPad } from './cricket-pad';

function player(playerId: string, cricketMarks: Record<string, number>): PlayerView {
  return { playerId, displayName: playerId, order: 0, remaining: 0, legsWon: 0, connected: true, cricketMarks };
}

describe('CricketPad', () => {
  let fixture: ComponentFixture<CricketPad>;
  let emitted: DartInput[];

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const button = (selector: string): HTMLButtonElement => {
    const element = root().querySelector<HTMLButtonElement>(selector);
    if (!element) {
      throw new Error(`missing ${selector}`);
    }
    return element;
  };

  beforeEach(async () => {
    emitted = [];
    fixture = TestBed.createComponent(CricketPad);
    fixture.componentRef.setInput('players', [player('me', { '20': 3, '19': 2 }), player('other', { '20': 3 })]);
    fixture.componentRef.setInput('myIndex', 0);
    fixture.componentInstance.dart.subscribe(({ dart }) => emitted.push(dart));
    await fixture.whenStable();
  });

  it('renders only the Cricket fields 15-20 plus bull', () => {
    expect(root().querySelectorAll('[id^="cricket-btn-"]').length).toBe(6);
    expect(root().querySelector('#cricket-btn-14')).toBeNull();
    expect(root().querySelector('#dart-btn-bull')).not.toBeNull();
  });

  it('disables a field closed by every player and keeps open fields usable', () => {
    expect(button('#cricket-btn-20').disabled).toBe(true);
    expect(button('#cricket-btn-19').disabled).toBe(false);
    button('#cricket-btn-19').click();
    expect(emitted).toEqual([{ segment: 19, multiplier: 1 }]);
  });

  it('shows the provisional own marks', async () => {
    fixture.componentRef.setInput('previewMarks', { '19': 3 });
    await fixture.whenStable();
    expect(button('#cricket-btn-19').classList).toContain('scoring');
  });
});
