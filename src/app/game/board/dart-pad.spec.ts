import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DartInput } from '../game.models';
import { DartPad } from './dart-pad';

describe('DartPad', () => {
  let fixture: ComponentFixture<DartPad>;
  let emitted: DartInput[];
  let origins: HTMLElement[];

  const button = (selector: string): HTMLButtonElement => {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(selector);
    if (!element) {
      throw new Error(`missing ${selector}`);
    }
    return element;
  };

  beforeEach(async () => {
    emitted = [];
    origins = [];
    fixture = TestBed.createComponent(DartPad);
    fixture.componentInstance.dart.subscribe(({ dart, origin }) => {
      emitted.push(dart);
      origins.push(origin);
    });
    await fixture.whenStable();
  });

  it('renders the 20 segment buttons plus bull, bullseye and miss', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[id^="dart-btn-"]').length).toBe(22);
    expect(root.querySelector('#miss-btn')).not.toBeNull();
  });

  it('emits single darts by default together with the pressed button (trajectory origin)', () => {
    button('#dart-btn-20').click();
    expect(emitted).toEqual([{ segment: 20, multiplier: 1 }]);
    expect(origins[0]).toBe(button('#dart-btn-20'));
  });

  it('applies the selected multiplier once, then resets to single', async () => {
    button('#multiplier-3 button').click();
    await fixture.whenStable();
    button('#dart-btn-20').click();
    button('#dart-btn-19').click();
    expect(emitted).toEqual([
      { segment: 20, multiplier: 3 },
      { segment: 19, multiplier: 1 },
    ]);
  });

  it('emits bull, bullseye and miss', () => {
    button('#dart-btn-bull').click();
    button('#dart-btn-bullseye').click();
    button('#miss-btn').click();
    expect(emitted).toEqual([
      { segment: 25, multiplier: 1 },
      { segment: 25, multiplier: 2 },
      { segment: 0, multiplier: 1 },
    ]);
  });

  it('is locked when disabled (spectator / not my turn / turn complete)', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    expect(button('#dart-btn-20').disabled).toBe(true);
    expect(button('#miss-btn').disabled).toBe(true);
    button('#dart-btn-20').click();
    expect(emitted).toEqual([]);
  });
});
