import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslationService } from '../../core/i18n/translation';
import { formatDart, PlayerView, TurnView } from '../game.models';

/** The last server-confirmed turn: player, darts and the server-credited points. */
@Component({
  selector: 'app-last-turn',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './last-turn.html',
})
export class LastTurn {
  protected readonly i18n = inject(TranslationService);

  readonly turn = input<TurnView | null>(null);
  readonly players = input<readonly PlayerView[]>([]);

  protected readonly playerName = computed(() => {
    const turn = this.turn();
    return this.players().find(p => p.playerId === turn?.playerId)?.displayName ?? '';
  });
  protected readonly darts = computed(() => (this.turn()?.darts ?? []).map(formatDart).join(' · '));
}
