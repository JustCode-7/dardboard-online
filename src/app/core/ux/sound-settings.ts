import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'dartboard.sound';

/** Global sound toggle (template's `SoundToggleService`, now a persisted signal). */
@Injectable({ providedIn: 'root' })
export class SoundSettings {
  private readonly enabledState = signal(SoundSettings.initial());

  readonly enabled = this.enabledState.asReadonly();

  setEnabled(enabled: boolean): void {
    this.enabledState.set(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Storage unavailable: keep the in-memory value only.
    }
  }

  private static initial(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  }
}
