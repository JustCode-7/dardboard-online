import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslationKey, TranslationService } from '../../core/i18n/translation';
import { PlayerView, TargetView } from '../game.models';
import { TurnPreview } from '../turn-preview';
import { RandomTarget } from './random-target';
import { RoundInfo } from './round-info';

/**
 * Current-turn banner (template's `CurrentPlayerProgressComponent`): whose turn, the server score (or
 * the provisional score while typing), the round counter and the Random-Hit target.
 */
@Component({
  selector: 'app-turn-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RandomTarget, RoundInfo],
  templateUrl: './turn-status.html',
  styleUrl: './turn-status.scss',
})
export class TurnStatus {
  protected readonly i18n = inject(TranslationService);

  readonly currentPlayer = input<PlayerView | null>(null);
  readonly isMyTurn = input(false);
  readonly preview = input<TurnPreview | null>(null);
  readonly round = input(1);
  readonly maxRounds = input<number | null>(null);
  readonly target = input<TargetView | null>(null);
  /** i18n key of the score label (`game.remaining` for x01, `game.points` otherwise). */
  readonly scoreLabelKey = input<TranslationKey>('game.remaining');

  /** Server score; while typing, the provisional (UX-only) score. */
  protected readonly displayScore = computed(() => {
    const preview = this.preview();
    if (this.isMyTurn() && preview) {
      return preview.scoreAfter;
    }
    return this.currentPlayer()?.remaining ?? null;
  });
}
