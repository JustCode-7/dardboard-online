import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslationService } from '../../../core/i18n/translation';
import { Multiplier } from '../../game.models';

/** Single / Double / Triple selector (template `MultiplierToggleComponent`), two-way bound via `[(value)]`. */
@Component({
  selector: 'app-multiplier-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonToggleModule],
  templateUrl: './multiplier-toggle.html',
})
export class MultiplierToggle {
  protected readonly i18n = inject(TranslationService);

  readonly value = model<Multiplier>(1);
  readonly disabled = input(false);
  /** Vertical column next to the pad (template layout). */
  readonly vertical = input(true);

  protected onChange(change: MatButtonToggleChange): void {
    const value = Number(change.value);
    this.value.set(value === 2 || value === 3 ? value : 1);
  }
}
