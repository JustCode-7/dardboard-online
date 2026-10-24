import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThrowIndicator } from './throw-indicator';

describe('ThrowIndicator', () => {
  let fixture: ComponentFixture<ThrowIndicator>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const button = (selector: string): HTMLButtonElement | null => root().querySelector<HTMLButtonElement>(selector);

  beforeEach(async () => {
    fixture = TestBed.createComponent(ThrowIndicator);
    await fixture.whenStable();
  });

  it('renders three dart slots as trajectory targets', async () => {
    fixture.componentRef.setInput('pending', [{ segment: 20, multiplier: 3 }]);
    await fixture.whenStable();
    expect(root().querySelector('#dart-slot-0')?.textContent?.trim()).toBe('T20');
    expect(root().querySelector('#dart-slot-2')?.textContent?.trim()).toBe('➶');
  });

  it('enables confirm only for a complete turn and emits it', async () => {
    let confirmed = 0;
    fixture.componentInstance.confirm.subscribe(() => confirmed++);
    expect(button('#confirm-turn-btn')?.disabled).toBe(true);

    fixture.componentRef.setInput('canConfirm', true);
    await fixture.whenStable();
    button('#confirm-turn-btn')?.click();
    expect(confirmed).toBe(1);
  });

  it('switches from dart undo to the server-side turn undo', async () => {
    let undone = 0;
    fixture.componentInstance.undoTurn.subscribe(() => undone++);
    expect(button('#undo-dart-btn')).not.toBeNull();
    expect(button('#undo-turn-btn')).toBeNull();

    fixture.componentRef.setInput('canUndoTurn', true);
    await fixture.whenStable();
    button('#undo-turn-btn')?.click();
    expect(undone).toBe(1);
  });
});
