import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslationService } from '../../core/i18n/translation';
import { formatDart, PlayerView } from '../game.models';
import { LobbySync, TurnEntry } from '../lobby-sync';

export interface HistoryDialogData {
  readonly lobbyId: string;
  readonly players: readonly PlayerView[];
}

interface HistoryRow {
  readonly id: string;
  readonly round: number;
  readonly player: string;
  readonly darts: string;
  readonly points: number;
  readonly busted: boolean;
}

/** Read-only turn history from `lobbies/{id}/turns` (template's history dialog), live via `onSnapshot`. */
@Component({
  selector: 'app-history-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
  templateUrl: './history-dialog.html',
  styleUrl: './history-dialog.scss',
})
export class HistoryDialog {
  protected readonly i18n = inject(TranslationService);
  private readonly data = inject<HistoryDialogData>(MAT_DIALOG_DATA);

  protected readonly turns = signal<readonly TurnEntry[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = computed<readonly HistoryRow[]>(() => {
    const names = new Map(this.data.players.map(p => [p.playerId, p.displayName]));
    return (this.turns() ?? []).map(turn => ({
      id: turn.turnId,
      round: turn.round,
      player: names.get(turn.playerId) ?? turn.playerId,
      darts: turn.darts.map(formatDart).join(' · '),
      points: turn.points,
      busted: turn.busted,
    }));
  });

  constructor() {
    const unsubscribe = inject(LobbySync).watchTurns(
      this.data.lobbyId,
      turns => this.turns.set(turns),
      code => this.error.set(code),
    );
    inject(DestroyRef).onDestroy(unsubscribe);
  }
}
