import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslationService } from '../../core/i18n/translation';
import { GameMode, gameModeInfo } from '../game.models';

/** Game rules info per mode (template's `DartInfoDialogComponent` / `CricketWinInstructionsDialog`). */
@Component({
  selector: 'app-rules-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './rules-dialog.html',
})
export class RulesDialog {
  protected readonly i18n = inject(TranslationService);
  protected readonly info = gameModeInfo(inject<GameMode>(MAT_DIALOG_DATA));
}
