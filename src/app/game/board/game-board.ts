import { afterNextRender, ChangeDetectionStrategy, Component, computed, DOCUMENT, inject, Injector } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslationKey, TranslationService } from '../../core/i18n/translation';
import { Feedback } from '../../core/ux/feedback';
import { LobbyStore } from '../lobby-store';
import { CricketPad } from './cricket-pad';
import { DartPad } from './dart-pad';
import { PadThrow } from './input/pad-throw';
import { LastTurn } from './last-turn';
import { PlayerOverview } from './player-overview';
import { dartSlotId, ThrowIndicator } from './throw-indicator';
import { TurnStatus } from './turn-status';

/**
 * `IN_PROGRESS` state: turn banner, pending turn with confirm/undo, scoreboard and the mode's pad.
 * Input is locked (spectator mode) unless it is the local player's turn with server-confirmed state.
 */
@Component({
  selector: 'app-game-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CricketPad, DartPad, LastTurn, MatButtonModule, PlayerOverview, ThrowIndicator, TurnStatus],
  templateUrl: './game-board.html',
  styleUrl: './game-board.scss',
})
export class GameBoard {
  protected readonly store = inject(LobbyStore);
  protected readonly i18n = inject(TranslationService);
  private readonly feedback = inject(Feedback);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly scoreLabelKey = computed<TranslationKey>(() =>
    this.store.modeInfo().countsDown ? 'game.remaining' : 'game.points',
  );

  protected onDart({ dart, origin }: PadThrow): void {
    const pointsBefore = this.store.preview()?.points ?? 0;
    // Instant local feedback (<100 ms); the authoritative result follows via the snapshot.
    if (!this.store.addDart(dart)) {
      return;
    }
    const slotIndex = this.store.pendingDarts().length - 1;
    this.feedback.dart(dart, this.store.pendingDarts());
    const preview = this.store.preview();
    if (preview?.busted) {
      this.feedback.bust();
    } else if (this.store.isRandomHit() && (preview?.points ?? 0) > pointsBefore) {
      this.feedback.showExplosion(this.i18n.t('game.hit'), 'green', null);
    }
    // Fly the arrow once the slot shows the new dart (template trajectory effect).
    afterNextRender(
      () => {
        const slot = this.document.getElementById(dartSlotId(slotIndex));
        if (slot) {
          this.feedback.trajectory(origin, slot);
        }
      },
      { injector: this.injector },
    );
  }
}
