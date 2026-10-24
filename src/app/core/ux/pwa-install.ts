import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/** Chromium-only `beforeinstallprompt` event (not part of the TS DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Exposes the deferred PWA install prompt as a signal (template's `PwaInstallService`). */
@Injectable({ providedIn: 'root' })
export class PwaInstall {
  private deferred: BeforeInstallPromptEvent | null = null;
  private readonly available = signal(false);

  readonly canInstall = this.available.asReadonly();

  constructor() {
    const onPrompt = (event: Event): void => {
      event.preventDefault();
      this.deferred = event as BeforeInstallPromptEvent;
      this.available.set(true);
    };
    const onInstalled = (): void => {
      this.deferred = null;
      this.available.set(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    });
  }

  async install(): Promise<void> {
    const prompt = this.deferred;
    if (!prompt) {
      return;
    }
    this.deferred = null;
    this.available.set(false);
    await prompt.prompt();
    await prompt.userChoice;
  }
}
