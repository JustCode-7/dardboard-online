import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslationService } from '../../core/i18n/translation';
import { HistoryDialog, HistoryDialogData } from '../dialogs/history-dialog';
import { RulesDialog } from '../dialogs/rules-dialog';
import { gameModeInfo, LobbyDoc } from '../game.models';

/** Lobby action bar: game mode label, throw history and rules dialogs. */
@Component({
  selector: 'app-game-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './game-actions.html',
})
export class GameActions {
  protected readonly i18n = inject(TranslationService);
  private readonly dialog = inject(MatDialog);

  readonly lobby = input.required<LobbyDoc>();

  protected readonly modeLabel = computed(() => this.i18n.t(gameModeInfo(this.lobby().gameMode).labelKey));

  protected openHistory(): void {
    const lobby = this.lobby();
    this.dialog.open<HistoryDialog, HistoryDialogData>(HistoryDialog, {
      data: { lobbyId: lobby.lobbyId, players: lobby.players },
      maxWidth: '95vw',
    });
  }

  protected openRules(): void {
    this.dialog.open(RulesDialog, { data: this.lobby().gameMode });
  }
}
