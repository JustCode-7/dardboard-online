import { DestroyRef, DOCUMENT, inject, Injectable, signal } from '@angular/core';

/**
 * Fullscreen toggle + Screen Wake Lock (template's `ToggleFullscreenService`), signal-based and with
 * the `fullscreenchange` listener released via `DestroyRef`.
 */
@Injectable({ providedIn: 'root' })
export class Fullscreen {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal(false);
  private wakeLock: WakeLockSentinel | null = null;

  readonly active = this.state.asReadonly();
  readonly supported = typeof this.document.documentElement.requestFullscreen === 'function';

  constructor() {
    const onChange = (): void => this.update();
    this.document.addEventListener('fullscreenchange', onChange);
    inject(DestroyRef).onDestroy(() => {
      this.document.removeEventListener('fullscreenchange', onChange);
      void this.releaseWakeLock();
    });
    this.update();
  }

  async toggle(): Promise<void> {
    try {
      if (this.document.fullscreenElement) {
        await this.document.exitFullscreen();
      } else if (this.supported) {
        await this.document.documentElement.requestFullscreen();
        await this.requestWakeLock();
      }
    } catch {
      // Fullscreen can be refused by the browser (no user gesture, iOS Safari): keep the current mode.
    } finally {
      this.update();
    }
  }

  /** Keeps the display on during a game (best effort, e.g. not available on low battery). */
  async requestWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator) || this.wakeLock) {
      return;
    }
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => (this.wakeLock = null));
    } catch {
      this.wakeLock = null;
    }
  }

  async releaseWakeLock(): Promise<void> {
    const lock = this.wakeLock;
    this.wakeLock = null;
    try {
      await lock?.release();
    } catch {
      // already released
    }
  }

  private update(): void {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
    this.state.set(!!this.document.fullscreenElement || standalone);
  }
}
