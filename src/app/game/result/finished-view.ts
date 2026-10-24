import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslationService } from '../../core/i18n/translation';
import { PlayerOverview } from '../board/player-overview';
import { LobbyStore } from '../lobby-store';
import { winnerText } from './winner-text';

/** `FINISHED` state: winner (or draw), final scoreboard and - for the last thrower - the server undo. */
@Component({
  selector: 'app-finished-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, PlayerOverview, RouterLink],
  templateUrl: './finished-view.html',
  styleUrl: './finished-view.scss',
})
export class FinishedView {
  protected readonly store = inject(LobbyStore);
  protected readonly i18n = inject(TranslationService);

  protected readonly winnerIds = computed(() => this.store.winners().map(p => p.playerId));
  protected readonly winnerText = computed(() => winnerText(this.i18n, this.store.winners(), this.store.uid()));
}
