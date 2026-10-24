import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * Detects swipe-down gesture from the top edge of the screen on small displays.
 * When a game is in progress, the toolbar and game-actions are hidden until the user
 * swipes down from the top to reveal them. They auto-hide after a short delay.
 */
@Injectable({ providedIn: 'root' })
export class SwipeOverlay {
  private readonly state = signal(false);
  private readonly touchStart = { y: 0, time: 0 };
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  readonly visible = this.state.asReadonly();

  constructor() {
    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      this.touchStart.y = touch.clientY;
      this.touchStart.time = Date.now();
    };

    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const dy = touch.clientY - this.touchStart.y;
      const dt = Date.now() - this.touchStart.time;

      // Swipe down: started near top (< 40px), moved down (> 60px), within 500ms
      if (this.touchStart.y < 40 && dy > 60 && dt < 500) {
        this.show();
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    });
  }

  /** Show the overlay and auto-hide after 3 seconds. */
  show(): void {
    this.clearHideTimer();
    this.state.set(true);
    this.scheduleHide();
  }

  /** Hide the overlay immediately. */
  hide(): void {
    this.clearHideTimer();
    this.state.set(false);
  }

  /** Toggle visibility. */
  toggle(): void {
    this.state.update(v => !v);
    if (this.state()) {
      this.scheduleHide();
    } else {
      this.clearHideTimer();
    }
  }

  private scheduleHide(): void {
    this.hideTimer = setTimeout(() => this.state.set(false), 3000);
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
