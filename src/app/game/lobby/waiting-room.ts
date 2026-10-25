import { ChangeDetectionStrategy, Component, computed, DOCUMENT, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslationService } from '../../core/i18n/translation';
import { QrCode } from '../../shared/qr-code';
import { ShapeMorphDirective } from '../../shared/shape-morph.directive';
import { PlayerOverview } from '../board/player-overview';
import { LobbyStore } from '../lobby-store';

/** `WAITING` state: share link, seated players, join (guests) and manual start (host). */
@Component({
  selector: 'app-waiting-room',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, PlayerOverview, QrCode, ShapeMorphDirective],
  templateUrl: './waiting-room.html',
  styleUrl: './waiting-room.scss',
})
export class WaitingRoom {
  protected readonly store = inject(LobbyStore);
  protected readonly i18n = inject(TranslationService);
  private readonly document = inject(DOCUMENT);

  protected readonly copied = signal(false);
  /** Resolved against <base href>, so links also work under the GitHub Pages sub-path. */
  protected readonly shareUrl = computed(() => {
    const id = this.store.lobbyId() ?? '';
    return new URL(`game/${encodeURIComponent(id)}`, this.document.baseURI).href;
  });

  protected async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }
}
