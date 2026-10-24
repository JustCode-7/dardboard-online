import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslationService } from '../../core/i18n/translation';
import { ShapeMorphDirective } from '../../shared/shape-morph.directive';
import { BULL_SEGMENT, DartInput, MISS_SEGMENT, Multiplier } from '../game.models';
import { BullButtons } from './input/bull-buttons';
import { MissButton } from './input/miss-button';
import { MultiplierToggle } from './input/multiplier-toggle';
import { PadThrow } from './input/pad-throw';

type ButtonColor = 'primary' | 'accent' | 'warn';

/** 1-20 in groups of five, exactly like the template's `InputButtonRowComponent`. */
const SEGMENT_GROUPS: readonly (readonly number[])[] = [0, 1, 2, 3].map(group =>
  Array.from({ length: 5 }, (_, i) => group * 5 + i + 1),
);

/**
 * Dart entry pad for x01, Elimination, Highscore and Random-Hit (template look: 3D fab buttons,
 * Single/Double/Triple toggle, Bull, Bullseye, Miss). Pure input component: emits the claimed dart;
 * validation and scoring happen on the server.
 */
@Component({
  selector: 'app-dart-pad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BullButtons, MatButtonModule, MissButton, MultiplierToggle, ShapeMorphDirective],
  templateUrl: './dart-pad.html',
  styleUrl: './dart-pad.scss',
})
export class DartPad {
  protected readonly i18n = inject(TranslationService);

  readonly disabled = input(false);
  readonly dart = output<PadThrow>();

  protected readonly groups = SEGMENT_GROUPS;
  protected readonly multiplier = signal<Multiplier>(1);
  protected readonly buttonColor = computed<ButtonColor>(() => {
    const m = this.multiplier();
    return m === 3 ? 'warn' : m === 2 ? 'accent' : 'primary';
  });
  protected readonly multiplierLabel = computed(() => {
    const m = this.multiplier();
    return this.i18n.t(m === 3 ? 'game.triple' : m === 2 ? 'game.double' : 'game.single');
  });

  protected throwSegment(segment: number, origin: HTMLElement): void {
    const multiplier = this.multiplier();
    // Template behavior: the multiplier resets to Single after every dart.
    this.multiplier.set(1);
    this.emit({ segment, multiplier }, origin);
  }

  protected throwBull(multiplier: 1 | 2, origin: HTMLElement): void {
    this.multiplier.set(1);
    this.emit({ segment: BULL_SEGMENT, multiplier }, origin);
  }

  protected throwMiss(origin: HTMLElement): void {
    this.multiplier.set(1);
    this.emit({ segment: MISS_SEGMENT, multiplier: 1 }, origin);
  }

  private emit(dart: DartInput, origin: HTMLElement): void {
    if (!this.disabled()) {
      this.dart.emit({ dart, origin });
    }
  }
}
