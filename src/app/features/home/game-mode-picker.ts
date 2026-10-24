import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { TranslationService } from '../../core/i18n/translation';
import { ShapeMorphDirective } from '../../shared/shape-morph.directive';
import { DEFAULT_ROUNDS, GAME_MODES, GameMode, gameModeInfo, ROUND_OPTIONS } from '../../game/game.models';

export interface NewGameRequest {
  readonly gameMode: GameMode;
  /** Only for round-limited modes. */
  readonly maxRounds?: number;
}

const STORAGE_KEY = 'dartboard.lastGameMode';

/**
 * Game selection (template `GameSelectionComponent`): all template modes plus the round limit
 * (3..45) for Cricket, Highscore and Random-Hit. The server validates both again.
 */
@Component({
  selector: 'app-game-mode-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatFormFieldModule, MatSelectModule, ShapeMorphDirective],
  templateUrl: './game-mode-picker.html',
  styleUrl: './game-mode-picker.scss',
})
export class GameModePicker {
  protected readonly i18n = inject(TranslationService);

  readonly busy = input(false);
  readonly create = output<NewGameRequest>();

  protected readonly modes = GAME_MODES;
  protected readonly roundOptions = ROUND_OPTIONS;
  protected readonly gameMode = signal<GameMode>(GameModePicker.restoreMode());
  protected readonly maxRounds = signal(DEFAULT_ROUNDS);
  protected readonly info = computed(() => gameModeInfo(this.gameMode()));

  protected onModeChange(change: MatSelectChange<GameMode>): void {
    this.gameMode.set(change.value);
    try {
      localStorage.setItem(STORAGE_KEY, change.value);
    } catch {
      // Storage unavailable: the choice is simply not remembered.
    }
  }

  protected onRoundsChange(change: MatSelectChange<number>): void {
    this.maxRounds.set(change.value);
  }

  protected submit(): void {
    const info = this.info();
    this.create.emit(info.roundLimited ? { gameMode: info.mode, maxRounds: this.maxRounds() } : { gameMode: info.mode });
  }

  private static restoreMode(): GameMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const known = GAME_MODES.find(m => m.mode === stored);
      if (known) {
        return known.mode;
      }
    } catch {
      // ignore
    }
    return 'X01_501';
  }
}
