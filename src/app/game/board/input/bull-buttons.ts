import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TranslationService } from '../../../core/i18n/translation';
import { ShapeMorphDirective } from '../../../shared/shape-morph.directive';

/** Bull (25) and Bullseye (50) buttons (template `BullButtonsComponent`); emit the pressed element. */
@Component({
  selector: 'app-bull-buttons',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, ShapeMorphDirective],
  templateUrl: './bull-buttons.html',
})
export class BullButtons {
  protected readonly i18n = inject(TranslationService);

  readonly disabled = input(false);
  readonly bull = output<HTMLElement>();
  readonly bullseye = output<HTMLElement>();
}
