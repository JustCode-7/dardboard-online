import { DestroyRef, Directive, ElementRef, inject, output, Renderer2 } from '@angular/core';

const PRESS_DURATION_MS = 150;
const VIBRATE_MS = 50;

/**
 * Instant (<100 ms) press feedback for game buttons, ported from the template: press transform +
 * haptic vibration, then emits `shapeMorphClick` with the pressed element (origin of the trajectory
 * animation). Disabled buttons never fire native click events.
 */
@Directive({
  selector: '[appShapeMorph]',
  standalone: true,
  host: {
    '(click)': 'onClick()',
    '(contextmenu)': 'onContextMenu($event)',
  },
})
export class ShapeMorphDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly shapeMorphClick = output<HTMLElement>();

  constructor() {
    this.renderer.setStyle(this.el.nativeElement, 'transition', 'transform 0.1s ease-out');
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) {
        clearTimeout(this.timer);
      }
    });
  }

  protected onClick(): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(VIBRATE_MS);
    }
    this.playPressAnimation();
    this.shapeMorphClick.emit(this.el.nativeElement);
  }

  protected onContextMenu(event: Event): void {
    // Long-press on touch devices must not open the context menu during fast input.
    event.preventDefault();
  }

  private playPressAnimation(): void {
    const element = this.el.nativeElement;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.renderer.setStyle(element, 'transform', 'translate(2px, 2px) scale(0.96)');
    this.timer = setTimeout(() => {
      this.renderer.removeStyle(element, 'transform');
      this.timer = null;
    }, PRESS_DURATION_MS);
  }
}
