import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslationService } from '../../core/i18n/translation';
import { ShapeMorphDirective } from '../../shared/shape-morph.directive';
import {
  BULL_SEGMENT,
  CRICKET_MARKS_TO_CLOSE,
  DartInput,
  marksOn,
  MISS_SEGMENT,
  Multiplier,
  PlayerView,
} from '../game.models';
import { BullButtons } from './input/bull-buttons';
import { MissButton } from './input/miss-button';
import { MultiplierToggle } from './input/multiplier-toggle';
import { PadThrow } from './input/pad-throw';

type ButtonColor = 'primary' | 'accent' | 'warn';

/** Template `InputButtonRowCricketComponent` rows: 15-17 and 18-20, bull on top. */
const FIELD_ROWS: readonly (readonly number[])[] = [
  [15, 16, 17],
  [18, 19, 20],
];

interface FieldState {
  readonly field: number;
  /** Own marks incl. the pending darts (UX preview). */
  readonly marks: number;
  /** Closed by every player: no further marks or points possible (template `isCricketNumberClosed`). */
  readonly closedForAll: boolean;
  /** Own field closed but at least one opponent is open: extra marks score. */
  readonly scoring: boolean;
}

/**
 * Cricket entry pad: 15-20 + Bull/Bullseye with the own mark count above each field. Fields closed by
 * all players are disabled (as in the template). Marks shown here are a preview; the server counts.
 */
@Component({
  selector: 'app-cricket-pad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BullButtons, MatButtonModule, MissButton, MultiplierToggle, ShapeMorphDirective],
  templateUrl: './cricket-pad.html',
  styleUrl: './cricket-pad.scss',
})
export class CricketPad {
  protected readonly i18n = inject(TranslationService);

  readonly disabled = input(false);
  readonly players = input.required<readonly PlayerView[]>();
  readonly myIndex = input.required<number>();
  /** Own marks including the pending darts. */
  readonly previewMarks = input<Readonly<Record<string, number>> | null>(null);
  readonly dart = output<PadThrow>();

  protected readonly multiplier = signal<Multiplier>(1);
  protected readonly buttonColor = computed<ButtonColor>(() => {
    const m = this.multiplier();
    return m === 3 ? 'warn' : m === 2 ? 'accent' : 'primary';
  });
  protected readonly rows = computed<readonly (readonly FieldState[])[]>(() =>
    FIELD_ROWS.map(row => row.map(field => this.fieldState(field))),
  );
  protected readonly bull = computed(() => this.fieldState(BULL_SEGMENT));

  protected throwField(field: number, origin: HTMLElement): void {
    const multiplier = this.multiplier();
    this.multiplier.set(1);
    this.emit({ segment: field, multiplier }, origin);
  }

  protected throwBull(multiplier: 1 | 2, origin: HTMLElement): void {
    this.multiplier.set(1);
    this.emit({ segment: BULL_SEGMENT, multiplier }, origin);
  }

  protected throwMiss(origin: HTMLElement): void {
    this.multiplier.set(1);
    this.emit({ segment: MISS_SEGMENT, multiplier: 1 }, origin);
  }

  private fieldState(field: number): FieldState {
    const players = this.players();
    const me = players[this.myIndex()];
    const preview = this.previewMarks();
    const marks = preview ? (preview[String(field)] ?? 0) : me ? marksOn(me, field) : 0;
    const opponents = players.filter((_, i) => i !== this.myIndex());
    const opponentsClosed = opponents.every(p => marksOn(p, field) >= CRICKET_MARKS_TO_CLOSE);
    const closed = marks >= CRICKET_MARKS_TO_CLOSE;
    return {
      field,
      marks,
      closedForAll: closed && opponents.length > 0 && opponentsClosed,
      scoring: closed && !opponentsClosed,
    };
  }

  private emit(dart: DartInput, origin: HTMLElement): void {
    if (!this.disabled()) {
      this.dart.emit({ dart, origin });
    }
  }
}
