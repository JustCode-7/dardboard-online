import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslationService } from '../../core/i18n/translation';
import { GameMode, PlayerView } from '../game.models';
import { CricketMarks } from './cricket-marks';

interface PlayerRow {
  readonly player: PlayerView;
  readonly active: boolean;
  readonly me: boolean;
  readonly host: boolean;
  readonly winner: boolean;
  /** Template `getDiffToCurrentPlayer` (Elimination / Highscore); `null` when not shown. */
  readonly diff: number | null;
}

/** Scoreboard of all seats (server values only); highlights the active player and the local player. */
@Component({
  selector: 'app-player-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CricketMarks, MatIconModule],
  templateUrl: './player-overview.html',
  styleUrl: './player-overview.scss',
})
export class PlayerOverview {
  protected readonly i18n = inject(TranslationService);

  readonly players = input.required<readonly PlayerView[]>();
  readonly currentIndex = input(0);
  readonly myUid = input<string | null>(null);
  readonly hostId = input<string | null>(null);
  readonly winnerIds = input<readonly string[]>([]);
  readonly gameMode = input<GameMode | null>(null);
  readonly showTurn = input(true);
  readonly showScores = input(true);

  protected readonly rows = computed<readonly PlayerRow[]>(() => {
    const players = this.players();
    const mode = this.gameMode();
    const current = players[this.currentIndex()];
    const showDiff = this.showTurn() && (mode === 'ELIMINATION_301' || mode === 'HIGHSCORE');
    return players.map((player, i) => ({
      player,
      active: this.showTurn() && i === this.currentIndex(),
      me: player.playerId === this.myUid(),
      host: player.playerId === this.hostId(),
      winner: this.winnerIds().includes(player.playerId),
      diff: showDiff && current ? Math.abs(current.remaining - player.remaining) : null,
    }));
  });
  protected readonly isCricket = computed(() => this.gameMode() === 'CRICKET');
}
